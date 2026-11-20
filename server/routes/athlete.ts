import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { loadContext } from '../services/context';
import { fetchCalendar } from '../integrations/calendarFetch';
import { readiness, ReadinessInput } from '../../shared/domain/fitness/readiness';
import { classifyEvent, parseTeamIcs } from '../../shared/domain/sports/schedule';
import { expandCommitments } from '../../shared/domain/planner/build';
import { addDays, startOfWeek, minToHhmm } from '../../shared/domain/time';

export const athleteRoutes = new Hono<AppEnv>();

const requireModule = (modules: Set<string>, ...names: string[]) => {
  if (!names.some((n) => modules.has(n))) throw new HttpError(404, 'module_disabled', 'This area is turned off. You can enable it in Settings.');
};

/* ---------- morning readiness check-in ---------- */

athleteRoutes.get('/readiness', (c) => {
  const ctx = loadContext(c.var.store, c.var.now());
  requireModule(ctx.modules, 'fitness', 'sports');
  return c.json({ today: ctx.today, entry: c.var.store.readinessOn(ctx.today), recent: c.var.store.readinessSince(addDays(ctx.today, -6)) });
});

athleteRoutes.post('/readiness', async (c) => {
  const input = await body(c, ReadinessInput);
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  requireModule(ctx.modules, 'fitness', 'sports');
  const result = readiness(input, { adult: ctx.policy.band === 'adult' });
  const before = store.readinessOn(ctx.today);
  store.saveReadiness(ctx.today, input, result);
  // Only a change in what today's training should be needs the plan to adapt.
  if (before?.plan !== result.plan) store.markStale(startOfWeek(ctx.today));
  return c.json({ entry: store.readinessOn(ctx.today), result, planChanged: before?.plan !== result.plan && !(before === null && result.plan === 'normal') }, 201);
});

/* ---------- team schedule import ---------- */

const PreviewInput = z.object({ url: z.string().trim().max(2000).optional(), text: z.string().max(2_000_000).optional() }).refine((v) => !!(v.url || v.text), 'Paste a calendar link or choose a file.');

athleteRoutes.post('/sports/schedule/preview', async (c) => {
  const input = await body(c, PreviewInput);
  const ctx = loadContext(c.var.store, c.var.now());
  requireModule(ctx.modules, 'sports');
  const text = input.text ?? (await fetchCalendar(input.url!, c.var.config.fetch ?? fetch));
  let parsed;
  try {
    parsed = parseTeamIcs(text, ctx.settings.profile.timezone);
  } catch (e) {
    throw new HttpError(422, 'not_ics', (e as Error).message);
  }
  const imported = c.var.store.importedUids();
  const until = addDays(ctx.today, 183);
  const events = parsed.events
    .filter((e) => e.date >= ctx.today && e.date <= until)
    .map((e) => ({ ...e, ...classifyEvent(e.title), alreadyImported: imported.has(e.uid) }));
  return c.json({ events, past: parsed.events.length - events.length, skipped: parsed.skipped });
});

const ImportInput = z.object({
  events: z
    .array(
      z.object({
        uid: z.string().min(1).max(300),
        title: z.string().trim().min(1).max(80),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start: z.number().int().min(0).max(1439),
        end: z.number().int().min(1).max(1440),
        location: z.string().max(80),
        kind: z.enum(['game', 'practice']),
        away: z.boolean(),
      }),
    )
    .min(1, 'Choose at least one event')
    .max(400),
  travelAway: z.number().int().min(0).max(180),
  travelHome: z.number().int().min(0).max(180),
});

athleteRoutes.post('/sports/schedule/import', async (c) => {
  const input = await body(c, ImportInput);
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  requireModule(ctx.modules, 'sports');
  let added = 0;
  let updated = 0;
  store.tx(() => {
    for (const e of input.events) {
      const end = Math.max(e.start + 15, Math.min(e.end, 1439));
      const travel = e.kind === 'game' ? (e.away ? input.travelAway : input.travelHome) : 0;
      const r = store.upsertImportedCommitment(e.uid, {
        kind: e.kind,
        title: e.title,
        recurrence: { type: 'once', date: e.date },
        start: minToHhmm(e.start),
        end: minToHhmm(end),
        travelBefore: travel,
        travelAfter: travel,
        location: e.location,
        intensity: e.kind === 'game' ? 3 : 2,
      });
      if (r === 'added') added++;
      else updated++;
    }
  });
  store.markStale(startOfWeek(ctx.today));
  return c.json({ added, updated }, 201);
});

/* ---------- upcoming games and their game-day plan ---------- */

athleteRoutes.get('/sports/games', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  requireModule(ctx.modules, 'sports');
  const dates = Array.from({ length: 60 }, (_, i) => addDays(ctx.today, i));
  const games = expandCommitments(store.listCommitments().filter((x) => x.kind === 'game'), dates)
    .filter((g) => g.date > ctx.today || g.end > ctx.nowMinute)
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1))
    .slice(0, 20);
  const next = games[0];
  let gameDay: { title: string; date: string; start: number; end: number; category: string; reason: string }[] = [];
  if (next) {
    const plan = store.getPlan(startOfWeek(next.date));
    const nextWeek = store.getPlan(startOfWeek(addDays(next.date, 1)));
    const items = [...(plan ? store.items(plan.id) : []), ...(nextWeek && nextWeek.id !== plan?.id ? store.items(nextWeek.id) : [])];
    gameDay = items
      .filter((i) => (i.meta as { gameRef?: string } | undefined)?.gameRef === next.id || (i.refId === next.refId && i.date === next.date))
      .map((i) => ({ title: i.title, date: i.date, start: i.start, end: i.end, category: i.category, reason: i.reason }))
      .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  }
  return c.json({
    today: ctx.today,
    games: games.map((g) => ({ id: g.id, commitmentId: g.refId, title: g.title, date: g.date, start: g.start, end: g.end, travelBefore: g.travelBefore, travelAfter: g.travelAfter })),
    nextGameDay: gameDay,
  });
});
