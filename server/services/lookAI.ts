/**
 * Skin product finder and build planner (Claude via the Anthropic API).
 *
 * Privacy: photos (adults only) and the student's answers are sent once and never stored;
 * only the written result is saved. No name, email or other account data is sent.
 * Safety: never rates looks, never identifies people, no weight or body-fat numbers and
 * no dieting for anyone under 18, and real medical warning signs go to a doctor.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { ZodType } from 'zod';
import { HttpError } from '../http';
import { AI_MODEL } from './studyAI';
import { BuildPlanSchema, SkinAdviceSchema, type BuildPlan, type PhotoInput, type SkinAdvice } from '../../shared/schemas/looks';

export interface LookAI {
  skin(photos: PhotoInput[], brief: string): Promise<SkinAdvice>;
  build(photos: { label: string; photo: PhotoInput }[], brief: string): Promise<BuildPlan>;
}
export type LookAIFactory = (apiKey: string) => LookAI;

const COMMON = `Ground rules (always):
- Never comment on attractiveness, never rate or score a face or body, and never compare the person to anyone else's looks. Talk only about skin health or training.
- Never try to identify a person in any photo, and never guess race, ethnicity or anything not needed for the advice.
- If a photo is not a real photo of what was asked for, is too blurry or dark to use, shows nudity or underwear, or seems to be of someone other than the user (for example a child when the user is an adult), set usable to false, explain why in usableReason in one kind sentence, and leave the other fields as short or empty as the schema allows. If no photos were sent, work from the answers and set usable to true.
- Write in plain, friendly language a teenager understands. No jargon without a short explanation.`;

const SKIN = `You help a student build a simple, affordable skin-care routine.
${COMMON}
- Describe what you can see (or what they told you) in neutral, factual terms ("some small bumps on the forehead", "shine on the nose"), never as flaws.
- Routine: morning and evening steps in the order they are used, 2 to 4 steps each (fewer is better for beginners). For each step give the product type, the ingredients to look for and avoid, why it helps, and one or two widely available drugstore examples that fit their budget, written as examples, not endorsements.
- Always include broad-spectrum SPF 30 or higher in the morning.
- Under 18: gentle routine only. No prescription products, no strong peels; benzoyl peroxide 2.5 to 5% or salicylic acid up to 2% are fine for breakouts, introduced slowly.
- Fragrance-sensitive or sensitive skin: fragrance-free products only.
- weekly: optional once-a-week extras (can be empty). habits: 3 to 5 everyday habits (washing pillowcases, not picking, etc.).
- seeADoctorIf: concrete warning signs (painful deep cysts, scarring, a mole that changes, a rash that spreads, anything that bleeds or won't heal). Advice here is general, not a diagnosis.`;

const BUILD = `You help a student plan training toward the physique or athletic build they want.
${COMMON}
- Photos, when sent, are labelled "current" and "goal". Compare them only in training terms, body area by body area (shoulders, arms, chest, back, core, legs, posture): what is developed now, what the goal shows, and what to focus on.
- Be honest about what is realistic: genetics, height and frame can't be trained; goal photos are often of professional athletes, posed, pumped, lit and edited. Give a realistic timeline in months for noticeable change with consistent training, and say plainly when a goal will take years.
- Build the weekly plan to the stated sessions per week, session length, equipment and experience. Use well-known exercises with sets, reps and a short form cue. Work around any listed injuries or limitations, and leave days for their sport practice if they play one.
- Progression: how to add weight or reps safely each week.
- Under 18: never give body-weight or body-fat numbers, never suggest eating less, dieting or cutting; focus on technique, gradual progress, eating enough (regular meals with protein and carbs) and sleep. No max-effort lifts.
- 18 and over: nutrition can mention a modest calorie surplus or deficit and protein targets in grams per kilogram if it fits the goal, never crash diets or supplements beyond protein and creatine.
- safety: warm-ups, stopping with sharp pain, and seeing a doctor or physical therapist for injuries.`;

function aiError(e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new HttpError(409, 'ai_bad_key', 'The Anthropic API key was rejected. Check it in Settings → Connections.');
  if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, 'ai_rate_limited', 'The AI service is busy or your usage limit was reached. Try again in a minute.');
  if (e instanceof Anthropic.BadRequestError) throw new HttpError(422, 'ai_bad_request', 'The AI couldn’t read those photos. Try a clear JPEG or PNG.');
  if (e instanceof Anthropic.APIConnectionError) throw new HttpError(503, 'ai_unreachable', 'Couldn’t reach the AI service. Check your internet connection.');
  if (e instanceof Anthropic.APIError) throw new HttpError(503, 'ai_error', 'The AI service had a problem. Please try again.');
  throw e;
}

export const anthropicLookAI: LookAIFactory = (apiKey) => {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60_000 });
  async function ask<T>(system: string, schema: ZodType<T>, images: { label: string; photo: PhotoInput }[], brief: string): Promise<T> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const { label, photo } of images) {
      content.push({ type: 'text', text: `Photo: ${label}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: photo.mediaType, data: photo.data } });
    }
    content.push({ type: 'text', text: brief });
    let response;
    try {
      response = await client.beta.messages.parse({
        model: AI_MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
        system,
        messages: [{ role: 'user', content }],
      });
    } catch (e) {
      aiError(e);
    }
    if (response.stop_reason === 'refusal') throw new HttpError(422, 'ai_refused', 'The AI couldn’t help with those photos. Try different photos, or answer the questions instead.');
    if (!response.parsed_output) throw new HttpError(503, 'ai_bad_output', 'The AI returned something unexpected. Please try again.');
    return response.parsed_output as T;
  }
  return {
    skin: (photos, brief) => ask(SKIN, SkinAdviceSchema, photos.map((photo, i) => ({ label: `face ${i + 1}`, photo })), brief),
    build: (photos, brief) => ask(BUILD, BuildPlanSchema, photos, brief),
  };
};

/* ---------- never trust model output blindly ---------- */

const clip = (s: string, n: number) => String(s ?? '').trim().slice(0, n);
const list = (a: string[], items: number, n = 300) => (a ?? []).map((s) => clip(s, n)).filter(Boolean).slice(0, items);

export function sanitizeSkin(r: SkinAdvice): SkinAdvice {
  const step = (s: SkinAdvice['morning'][number]) => ({
    step: clip(s.step, 80), productType: clip(s.productType, 120), lookFor: list(s.lookFor, 6, 80), avoid: list(s.avoid, 6, 80), why: clip(s.why, 400), examples: list(s.examples, 3, 120),
  });
  return {
    usable: !!r.usable,
    usableReason: clip(r.usableReason, 300),
    summary: clip(r.summary, 800),
    observations: (r.observations ?? []).slice(0, 8).map((o) => ({ area: clip(o.area, 60), note: clip(o.note, 300) })),
    morning: (r.morning ?? []).slice(0, 5).map(step),
    evening: (r.evening ?? []).slice(0, 5).map(step),
    weekly: list(r.weekly, 4),
    habits: list(r.habits, 6),
    seeADoctorIf: list(r.seeADoctorIf, 6),
  };
}

export function sanitizeBuild(r: BuildPlan): BuildPlan {
  return {
    usable: !!r.usable,
    usableReason: clip(r.usableReason, 300),
    summary: clip(r.summary, 800),
    focusAreas: (r.focusAreas ?? []).slice(0, 8).map((f) => ({ area: clip(f.area, 60), now: clip(f.now, 300), goal: clip(f.goal, 300), focus: clip(f.focus, 300) })),
    realistic: clip(r.realistic, 800),
    timeline: clip(r.timeline, 300),
    days: (r.days ?? []).slice(0, 7).map((d) => ({
      day: clip(d.day, 40),
      focus: clip(d.focus, 120),
      exercises: (d.exercises ?? []).slice(0, 10).map((e) => ({ name: clip(e.name, 80), sets: clip(e.sets, 20), reps: clip(e.reps, 30), notes: clip(e.notes, 200) })),
    })),
    progression: list(r.progression, 6),
    nutrition: list(r.nutrition, 6),
    recovery: list(r.recovery, 6),
    safety: list(r.safety, 6),
  };
}
