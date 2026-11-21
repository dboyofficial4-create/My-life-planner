import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { loadContext } from '../services/context';
import { anthropicCoachAI, geminiCoachAI, type CoachTurn } from '../services/coachAI';
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
  if (!p) throw new HttpError(409, 'ai_not_connected', 'Add an AI key to use Coach: ANTHROPIC_API_KEY or GEMINI_API_KEY in the .env file, or an Anthropic key in Settings → Connections.');
  if (store.coachConsent()?.provider !== p.name) throw new HttpError(409, 'coach_consent', 'Confirm how Coach uses your information first.');
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

  return streamSSE(c, async (stream) => {
    const ac = new AbortController();
    stream.onAbort(() => ac.abort());
    await stream.writeSSE({ event: 'thread', data: JSON.stringify({ thread: threadInfo, question }) });
    let pending = Promise.resolve();
    const send = (event: string, data: unknown) => {
      pending = pending.then(() => stream.writeSSE({ event, data: JSON.stringify(data) })).catch(() => {});
    };
    try {
      const reply = await ai.reply(system, history, { research: input.research }, {
        signal: ac.signal,
        onText: (t) => send('text', { t }),
        onSearch: (q) => send('search', { q }),
      });
      await pending;
      const saved = store.addCoachMessage(threadInfo.id, 'assistant', reply.text, reply.sources);
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ message: saved }) });
    } catch (e) {
      await pending;
      const err = e instanceof HttpError ? { code: e.code, message: e.message } : { code: 'ai_error', message: 'Coach had a problem. Please try again.' };
      if (!(e instanceof HttpError)) console.error('coach', e);
      if (!ac.signal.aborted) await stream.writeSSE({ event: 'error', data: JSON.stringify(err) });
    }
  });
});
