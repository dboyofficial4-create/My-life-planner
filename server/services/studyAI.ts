/**
 * AI study-set generation (Claude via the Anthropic API).
 *
 * Input: the student's own uploaded material (PDF, images, Word, PowerPoint,
 * text). Output: a study sheet, flashcards, a practice test and topics —
 * validated against a schema before anything is saved.
 *
 * Privacy: only the material itself plus the course/assignment name is sent.
 * No name, email, grades or other account data. Uploaded files are not stored.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { unzipSync, strFromU8 } from 'fflate';
import { z } from 'zod';
import { HttpError } from '../http';

export const AI_MODEL = 'claude-opus-5-5';
/** Published per-token prices for the model above (USD per token), used only for the cost note shown to the user. */
const PRICE_IN = 4 / 1_000_000;
const PRICE_OUT = 20 / 1_000_000;

/* ---------- output schema ---------- */

export const StudySetSchema = z.object({
  title: z.string(),
  overview: z.string(),
  /** True when the material was unreadable or too thin to study from. */
  insufficient: z.boolean(),
  insufficientReason: z.string(),
  studySheet: z.string(),
  topics: z.array(z.object({ title: z.string(), keyPoints: z.array(z.string()) })),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })),
  questions: z.array(
    z.object({
      kind: z.enum(['multiple_choice', 'true_false', 'short_answer']),
      topic: z.string(),
      question: z.string(),
      choices: z.array(z.string()),
      answer: z.string(),
      explanation: z.string(),
    }),
  ),
});
export type StudySet = z.infer<typeof StudySetSchema>;

/* ---------- uploaded files → content blocks ---------- */

export interface UploadedFile {
  name: string;
  mediaType: string;
  /** base64 */
  data: string;
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function xmlText(xml: string, paragraphTag: string): string {
  return xml
    .replace(new RegExp(`</${paragraphTag}>`, 'g'), '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Text from .docx / .pptx (both are zip archives of XML). */
export function officeText(bytes: Uint8Array, kind: 'docx' | 'pptx'): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => (kind === 'docx' ? f.name === 'word/document.xml' : /^ppt\/slides\/slide\d+\.xml$/.test(f.name)) });
  } catch {
    throw new HttpError(422, 'bad_file', 'That file couldn’t be opened. Try saving it again, or export it as PDF.');
  }
  if (kind === 'docx') {
    const doc = files['word/document.xml'];
    if (!doc) throw new HttpError(422, 'bad_file', 'That Word file has no readable text.');
    return xmlText(strFromU8(doc), 'w:p');
  }
  const slides = Object.keys(files).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  return slides.map((name, i) => `--- Slide ${i + 1} ---\n${xmlText(strFromU8(files[name]!), 'a:p')}`).join('\n\n');
}

function kindOf(f: UploadedFile): 'pdf' | 'image' | 'docx' | 'pptx' | 'text' | null {
  const n = f.name.toLowerCase();
  if (f.mediaType === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (IMAGE_TYPES.has(f.mediaType)) return 'image';
  if (f.mediaType === DOCX || n.endsWith('.docx')) return 'docx';
  if (f.mediaType === PPTX || n.endsWith('.pptx')) return 'pptx';
  if (f.mediaType.startsWith('text/') || /\.(txt|md|markdown|csv)$/.test(n)) return 'text';
  return null;
}

export function toContentBlocks(files: UploadedFile[], pastedText: string): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  let total = 0;
  for (const f of files) {
    const kind = kindOf(f);
    const bytes = Buffer.from(f.data, 'base64');
    total += bytes.length;
    if (total > MAX_UPLOAD_BYTES) throw new HttpError(413, 'too_large', 'Files are too large together (20 MB max). Upload fewer pages at a time.');
    switch (kind) {
      case 'pdf':
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data }, title: f.name.slice(0, 200) });
        break;
      case 'image':
        blocks.push({ type: 'image', source: { type: 'base64', media_type: f.mediaType as 'image/png', data: f.data } });
        break;
      case 'docx':
      case 'pptx': {
        const text = officeText(bytes, kind);
        if (!text.trim()) throw new HttpError(422, 'bad_file', `“${f.name}” has no readable text. If it’s mostly pictures, export it as PDF instead.`);
        blocks.push({ type: 'text', text: `File: ${f.name}\n\n${text}` });
        break;
      }
      case 'text':
        blocks.push({ type: 'text', text: `File: ${f.name}\n\n${bytes.toString('utf8')}` });
        break;
      default:
        throw new HttpError(422, 'unsupported_file', `“${f.name}” isn’t a supported type. Use PDF, Word (.docx), PowerPoint (.pptx), a photo (PNG/JPG), or text.`);
    }
  }
  if (pastedText.trim()) blocks.push({ type: 'text', text: `Pasted notes:\n\n${pastedText}` });
  if (!blocks.length) throw new HttpError(422, 'validation', 'Add a file or paste some notes first.');
  return blocks;
}

/* ---------- prompt ---------- */

export interface GenerateContext {
  subject: string | null;
  assessment: string | null;
  assessmentType: string | null;
  flashcards: number;
  questions: number;
}

const SYSTEM = `You turn a student's own class material into study aids: a study sheet, flashcards and a practice test.

Ground everything in the material provided. Don't add facts the material doesn't support; if something important is clearly implied but missing, you may include it only in the study sheet, marked "(not in your material — check with your teacher)". Write for a student studying on their own: plain language, short sentences, concrete examples from the material.

Study sheet: Markdown. One "# Topic" heading per topic, then the key ideas as short bullet points, including definitions, formulas, dates and worked steps that appear in the material.

Flashcards: one fact, term or formula per card. The front is a question or term; the back is a short answer a student could say from memory. No duplicates.

Practice test: questions a teacher would plausibly ask about this material, at mixed difficulty, spread across the topics. For multiple_choice, give 4 choices with exactly one correct, and put the correct choice's exact text in "answer". For true_false, choices are ["True", "False"] and the answer is one of them. For short_answer, choices is an empty array and the answer is a model answer of 1–3 sentences. Every question gets an explanation of why the answer is right. Each question's "topic" must match one of your topic titles.

If the material is a graded assignment the student must turn in (for example homework questions or a take-home test), do not answer those specific questions. Create study aids about the underlying concepts instead.

If the material is unreadable, empty, or too short to study from, set insufficient to true, explain why in insufficientReason in one sentence, and return empty arrays.`;

/* ---------- generator ---------- */

export interface GenerationResult {
  set: StudySet;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  model: string;
}

export interface StudyAI {
  /** Cheap check that the key works (no tokens used). */
  validate(): Promise<void>;
  generate(content: Anthropic.Beta.BetaContentBlockParam[], ctx: GenerateContext): Promise<GenerationResult>;
}

export type StudyAIFactory = (apiKey: string) => StudyAI;

/** Map SDK errors to clear messages, most specific first. */
function aiError(e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    throw new HttpError(422, 'ai_bad_key', 'Anthropic rejected the API key. Check it in Settings → Connections.', { fields: { key: 'Key rejected' } });
  }
  if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, 'ai_rate_limited', 'The AI service is busy or your usage limit was reached. Try again in a minute.');
  if (e instanceof Anthropic.BadRequestError) throw new HttpError(422, 'ai_bad_request', 'The AI couldn’t read these files. Try fewer pages, or a PDF instead.');
  if (e instanceof Anthropic.APIConnectionError) throw new HttpError(503, 'ai_unreachable', 'Couldn’t reach the AI service. Check your internet connection.');
  if (e instanceof Anthropic.APIError) throw new HttpError(503, 'ai_error', 'The AI service had a problem. Please try again.');
  throw e;
}

export const anthropicStudyAI: StudyAIFactory = (apiKey) => {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 9 * 60_000 });
  return {
    async validate() {
      try {
        await client.models.retrieve(AI_MODEL);
      } catch (e) {
        aiError(e);
      }
    },
    async generate(content, ctx) {
      const instructions = [
        ctx.subject ? `Course: ${ctx.subject}` : null,
        ctx.assessment ? `This is for: ${ctx.assessment}${ctx.assessmentType ? ` (${ctx.assessmentType})` : ''}` : null,
        `Make about ${ctx.flashcards} flashcards and about ${ctx.questions} practice-test questions (fewer if the material is short).`,
        'Use the material above.',
      ]
        .filter(Boolean)
        .join('\n');
      let response;
      try {
        response = await client.beta.messages.parse({
          model: AI_MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(StudySetSchema) },
          system: SYSTEM,
          messages: [{ role: 'user', content: [...content, { type: 'text', text: instructions }] }],
        });
      } catch (e) {
        aiError(e);
      }
      if (response.stop_reason === 'refusal') {
        throw new HttpError(422, 'ai_refused', 'The AI declined to process this material. Check that the files are your class material.');
      }
      if (response.stop_reason === 'max_tokens') {
        throw new HttpError(422, 'ai_too_long', 'That was too much material for one study set. Upload fewer pages at a time.');
      }
      if (!response.parsed_output) throw new HttpError(503, 'ai_bad_output', 'The AI returned something unexpected. Please try again.');
      const inputTokens = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0);
      const outputTokens = response.usage.output_tokens;
      return {
        set: response.parsed_output,
        usage: { inputTokens, outputTokens, estimatedCostUsd: Math.round((inputTokens * PRICE_IN + outputTokens * PRICE_OUT) * 100) / 100 },
        model: response.model,
      };
    },
  };
};

/* ---------- clean-up of model output (never trust it blindly) ---------- */

const clip = (s: string, n: number) => s.trim().slice(0, n);

export function sanitizeStudySet(set: StudySet, limits: { flashcards: number; questions: number }) {
  const topics = set.topics
    .map((t) => ({ title: clip(t.title, 100), keyPoints: t.keyPoints.map((k) => clip(k, 300)).filter(Boolean).slice(0, 12) }))
    .filter((t) => t.title)
    .slice(0, 30);
  const seen = new Set<string>();
  const flashcards = set.flashcards
    .map((c) => ({ front: clip(c.front, 500), back: clip(c.back, 2000) }))
    .filter((c) => c.front && c.back && !seen.has(c.front.toLowerCase()) && seen.add(c.front.toLowerCase()))
    .slice(0, Math.min(80, limits.flashcards * 2));
  const questions = set.questions
    .map((q) => {
      const base = { kind: q.kind, topic: clip(q.topic, 100), question: clip(q.question, 1000), answer: clip(q.answer, 1000), explanation: clip(q.explanation, 1500) };
      if (q.kind === 'true_false') {
        const a = /^t/i.test(base.answer) ? 'True' : /^f/i.test(base.answer) ? 'False' : '';
        return a ? { ...base, choices: ['True', 'False'], answer: a } : null;
      }
      if (q.kind === 'multiple_choice') {
        const choices = [...new Set(q.choices.map((c) => clip(c, 400)).filter(Boolean))].slice(0, 6);
        // The correct answer must be one of the choices, or the question is unusable.
        return choices.length >= 2 && choices.includes(base.answer) ? { ...base, choices } : null;
      }
      return { ...base, choices: [] as string[] };
    })
    .filter((q): q is NonNullable<typeof q> => !!q && !!q.question && !!q.answer)
    .slice(0, Math.min(40, limits.questions * 2));
  return { title: clip(set.title, 140) || 'Study set', overview: clip(set.overview, 1000), studySheet: clip(set.studySheet, 50_000), topics, flashcards, questions };
}
