/**
 * The skin product finder and build planner on Google's Gemini API, for servers that set
 * GEMINI_API_KEY and no Anthropic key. Same instructions, same output schema, same checks
 * as the Claude version (lookAI.ts). Note: on Gemini's free tier Google may use what is
 * sent to improve its products; the consent text in the app says so.
 */
// Loaded only when Gemini is used, so the server still starts if the package is missing.
type GenAI = typeof import('@google/genai');
let sdk: Promise<GenAI> | null = null;
const loadSdk = () => (sdk ??= import('@google/genai').catch(() => {
  sdk = null;
  throw new HttpError(503, 'ai_unavailable', 'The Gemini package isn’t installed. Run npm install, then restart Waypoint.');
}));
import { z, type ZodType } from 'zod';
import { HttpError } from '../http';
import { BUILD_PROMPT, SKIN_PROMPT, type LookAIFactory } from './lookAI';
import { BuildPlanSchema, SkinAdviceSchema, type PhotoInput } from '../../shared/schemas/looks';

/** Google's alias for its current fast model (the one AI Studio's own sample uses). */
export const GEMINI_MODEL = 'gemini-flash-latest';

export function jsonSchema(schema: ZodType) {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

function geminiError(e: unknown, ApiError: GenAI['ApiError']): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof ApiError) {
    if (e.status === 400 && /api key/i.test(e.message)) throw new HttpError(409, 'ai_bad_key', 'Google rejected the Gemini API key. Check GEMINI_API_KEY in the .env file.');
    if (e.status === 401 || e.status === 403) throw new HttpError(409, 'ai_bad_key', 'Google rejected the Gemini API key. Check GEMINI_API_KEY in the .env file.');
    if (e.status === 429) throw new HttpError(429, 'ai_rate_limited', 'Gemini’s free limit was reached. Wait a minute (or until tomorrow for the daily limit) and try again.');
    if (e.status === 400) throw new HttpError(422, 'ai_bad_request', 'Gemini couldn’t read those photos. Try a clear JPEG or PNG.');
    throw new HttpError(503, 'ai_error', 'The Gemini service had a problem. Please try again.');
  }
  if (e instanceof TypeError) throw new HttpError(503, 'ai_unreachable', 'Couldn’t reach the Gemini service. Check your internet connection.');
  throw e;
}

export const geminiLookAI: LookAIFactory = (apiKey) => {
  async function ask<T>(system: string, schema: ZodType<T>, images: { label: string; photo: PhotoInput }[], brief: string): Promise<T> {
    const parts = [
      ...images.flatMap(({ label, photo }) => [{ text: `Photo: ${label}` }, { inlineData: { mimeType: photo.mediaType, data: photo.data } }]),
      { text: brief },
    ];
    const { GoogleGenAI, ApiError } = await loadSdk();
    const client = new GoogleGenAI({ apiKey });
    let res;
    try {
      res = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: jsonSchema(schema), maxOutputTokens: 8000 },
      });
    } catch (e) {
      geminiError(e, ApiError);
    }
    if (res.promptFeedback?.blockReason) throw new HttpError(422, 'ai_refused', 'Gemini couldn’t help with those photos. Try different photos, or answer the questions instead.');
    let data: unknown;
    try {
      data = JSON.parse(res.text ?? '');
    } catch {
      throw new HttpError(503, 'ai_bad_output', 'Gemini returned something unexpected. Please try again.');
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new HttpError(503, 'ai_bad_output', 'Gemini returned something unexpected. Please try again.');
    return parsed.data;
  }
  return {
    skin: (photos, brief) => ask(SKIN_PROMPT, SkinAdviceSchema, photos.map((photo, i) => ({ label: `face ${i + 1}`, photo })), brief),
    build: (photos, brief) => ask(BUILD_PROMPT, BuildPlanSchema, photos, brief),
  };
};
