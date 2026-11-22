import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { loadContext } from '../services/context';
import { anthropicCoachAI, geminiCoachAI, type CoachTool, type CoachTurn } from '../services/coachAI';
import { decryptSecret } from '../auth/crypto';
import { researchVideos, type VideoResearch } from '../services/videoResearch';
import { YouTubeError } from '../integrations/youtube';
import { coachProfile, coachSuggestions, coachSystem } from '../services/coachContext';
import { provider } from './looks';

export const coachRoutes = new Hono<AppEnv>();

const DAY = 24 * 3_600_000;
export const DEFAULT_COACH_LIMIT = 40;
const DEMO_COACH_LIMIT = 5;
/** Characters of past conversation sent with each question (older turns are dropped first). */
const HISTORY_CHARS = 40_000;

function limitFor(c: Context<AppEnv>) {
  const max = c.var.isDemo ? DEMO_COACH_LIMIT : c.var.config.coachDailyLimit ?? DEFAULT_COACH_LIMIT;
  const used = c.var.store.coachQuestionsSince(c.var.now().getTime() - DAY);
  return { used, max };
}

/** The YouTube key Compass can research with: the student's own (Settings → Connections), else the server's. */
function youtubeKey(c: Context<AppEnv>): string | null {
  const enc = c.var.store.integrationToken('youtube');
  if (enc && c.var.config.encryptionKey) {
    try {
      return decryptSecret(enc, c.var.config.encryptionKey);
    } catch {
      /* fall through */
    }
  }
  return c.var.config.youtubeApiKey ?? null;
}

const VIDEO_TTL = 24 * 3_600_000;
const MAX_VIDEO_LOOKUPS = 2;

/** Compass's YouTube research tool: search, stats and a comment check, cached for a day per query. */
export function youtubeTool(c: Context<AppEnv>, key: string): CoachTool {
  let used = 0;
  return {
    name: 'youtube_research',
    kind: 'youtube',
    description:
      'Search YouTube for training videos (drills, technique, workouts, routines) and get, for the best few: views, like rate, and a check of the top viewer comments (how many report real results, doubt it, or mention pain or injury, with short quotes). Use it to see what athletes actually use and whether it works for them. Query like a player would search, specific to the sport and position.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What to search on YouTube, e.g. "point guard decision making drills"' } }, required: ['query'], additionalProperties: false },
    async run(input) {
      const query = String(input.query ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!query) return { content: 'Give a search query.' };
      if (used >= MAX_VIDEO_LOOKUPS) return { content: `YouTube research limit for this answer reached (${MAX_VIDEO_LOOKUPS} searches). Answer with what you have.` };
      used++;
      const cacheKey = `coach-yt:${query.toLowerCase()}`;
      const cached = c.var.store.cacheGet<VideoResearch>(cacheKey, VIDEO_TTL);
      if (cached) return { content: cached.report, sources: cached.sources };
      try {
        const r = await researchVideos(query, key, c.var.config.fetch ?? fetch);
        c.var.store.cacheSet(cacheKey, r);
        return { content: r.report, sources: r.sources };
      } catch (e) {
        if (e instanceof YouTubeError) return { content: `YouTube research isn't available right now: ${e.message} Use web search instead.` };
        throw e;
      }
    },
  };
}

coachRoutes.get('/coach', (c) => {
  const ctx = loadContext(c.var.store, c.var.now()); // onboarding must be finished
  const p = provider(c);
  const consent = c.var.store.coachConsent();
  return c.json({
    aiReady: !!p,
    provider: p?.name ?? null,
    consent: !!p && consent?.provider === p.name,
    threads: c.var.store.coachThreads(),
    limit: limitFor(c),
    suggestions: coachSuggestions(c.var.store, ctx),
    youtube: !!youtubeKey(c) && p?.name === 'claude',
  });
});

coachRoutes.post('/coach/consent', async (c) => {
  await body(c, z.object({ consent: z.literal(true, { error: 'Please confirm' }) }));
  const p = provider(c);
  if (!p) throw new HttpError(409, 'ai_not_connected', 'Add an AI key first.');
  c.var.store.setCoachConsent(p.name);
  return c.json({ ok: true });
});

coachRoutes.get('/coach/threads/:id', (c) => {
  const thread = c.var.store.coachThread(c.req.param('id'));
  if (!thread) throw new HttpError(404, 'not_found', 'Conversation not found.');
  return c.json({ thread, messages: c.var.store.coachMessages(thread.id) });
});

coachRoutes.delete('/coach/threads/:id', (c) => {
  if (!c.var.store.deleteCoachThread(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Conversation not found.');
  return c.json({ ok: true });
});

coachRoutes.delete('/coach/threads', (c) => c.json({ deleted: c.var.store.deleteAllCoachThreads() }));

const ChatInput = z.object({
  threadId: z.string().max(40).nullable().default(null),
  message: z.string().trim().min(1, 'Type a question').max(4000, 'Keep it under 4,000 characters'),
  research: z.boolean().default(true),
});

/** Past turns in API shape: newest kept within the budget, same-role turns merged, starting with the student. */
export function historyFor(messages: { role: 'user' | 'assistant'; content: string }[], budget = HISTORY_CHARS): CoachTurn[] {
  const kept: CoachTurn[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (used + m.content.length > budget && kept.length) break;
    used += m.content.length;
    kept.unshift({ role: m.role, content: m.content });
  }
  const merged: CoachTurn[] = [];
  for (const t of kept) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.content += `\n\n${t.content}`;
    else merged.push({ ...t });
  }
  while (merged.length && merged[0]!.role !== 'user') merged.shift();
  return merged;
}

coachRoutes.post('/coach/chat', async (c) => {
  const input = await body(c, ChatInput);
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const p = provider(c);
  if (!p) throw new HttpError(409, 'ai_not_connected', 'Add an AI key to use Compass: ANTHROPIC_API_KEY or GEMINI_API_KEY in the .env file, or an Anthropic key in Settings → Connections.');
  if (store.coachConsent()?.provider !== p.name) throw new HttpError(409, 'coach_consent', 'Confirm how Compass uses your information first.');
  const limit = limitFor(c);
  if (limit.used >= limit.max) throw new HttpError(429, 'coach_limit', `You’ve asked ${limit.max} questions in the last 24 hours, the daily limit. Try again tomorrow.`);

  let thread = input.threadId ? store.coachThread(input.threadId) : null;
  if (input.threadId && !thread) throw new HttpError(404, 'not_found', 'Conversation not found.');
  thread ??= store.createCoachThread(input.message.replace(/\s+/g, ' ').slice(0, 70));
  const question = store.addCoachMessage(thread.id, 'user', input.message);
  const history = historyFor(store.coachMessages(thread.id, 40));
  const system = coachSystem(coachProfile(store, ctx));
  const ai = (c.var.config.coachAI ?? (p.name === 'gemini' ? geminiCoachAI : anthropicCoachAI))(p.key);
  const threadInfo = thread;
  const ytKey = input.research && p.name === 'claude' ? youtubeKey(c) : null;

  return streamSSE(c, async (stream) => {
    const ac = new AbortController();
    stream.onAbort(() => ac.abort());
    await stream.writeSSE({ event: 'thread', data: JSON.stringify({ thread: threadInfo, question }) });
    let pending = Promise.resolve();
    const send = (event: string, data: unknown) => {
      pending = pending.then(() => stream.writeSSE({ event, data: JSON.stringify(data) })).catch(() => {});
    };
    try {
      const reply = await ai.reply(system, history, { research: input.research, tools: ytKey ? [youtubeTool(c, ytKey)] : [] }, {
        signal: ac.signal,
        onText: (t) => send('text', { t }),
        onSearch: (q, kind) => send('search', { q, kind: kind ?? 'web' }),
      });
      await pending;
      const saved = store.addCoachMessage(threadInfo.id, 'assistant', reply.text, reply.sources);
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ message: saved }) });
    } catch (e) {
      await pending;
      const err = e instanceof HttpError ? { code: e.code, message: e.message } : { code: 'ai_error', message: 'Compass had a problem. Please try again.' };
      if (!(e instanceof HttpError)) console.error('coach', e);
      if (!ac.signal.aborted) await stream.writeSSE({ event: 'error', data: JSON.stringify(err) });
    }
  });
});
