import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { CommitmentInput, GoalSchema, ItemUpdateInput, MAX_GOALS, SETTINGS_SCHEMAS, localDate, type SettingsKey } from '../../shared/schemas';
import { addDays, hhmmToMin, isLocalDate as isDate, startOfWeek, todayIn } from '../../shared/domain/time';
import { conflictsFor } from '../../shared/domain/planner/engine';
import { awakeWindow } from '../../shared/domain/planner/build';
import { agePolicy } from '../../shared/domain/age';
import { applyProposal, generateIfEmpty, previewPlan } from '../services/planning';
import { loadContext, requireSettings, weekOf } from '../services/context';
import { parseJson } from '../db';
import type { ItemView, UserStore } from '../repos/store';

export const planRoutes = new Hono<AppEnv>();

/** Display status: planned items whose time has passed are shown as missed (not written). */
function withDisplayStatus(items: ItemView[], today: string, nowMinute: number) {
  return items.map((it) => ({
    ...it,
    displayStatus: it.status === 'planned' && (it.date < today || (it.date === today && it.end <= nowMinute)) && it.source !== 'fixed' ? 'missed' : it.status,
  }));
}

function invalidate(store: UserStore, tz: string, now: Date) {
  store.markStale(startOfWeek(todayIn(tz, now)));
}

/* ---------- settings & goals ---------- */

planRoutes.get('/settings', (c) => c.json({ settings: c.var.store.getSettings(), goals: c.var.store.listGoals() }));

planRoutes.put('/settings/:key', async (c) => {
  const key = c.req.param('key') as SettingsKey;
  const schema = SETTINGS_SCHEMAS[key];
  if (!schema) throw new HttpError(404, 'not_found', 'Unknown settings section.');
  const value = await body(c, schema as z.ZodType<unknown>);
  const store = c.var.store;
  if (key === 'profile') {
    const p = value as z.infer<typeof SETTINGS_SCHEMAS.profile>;
    const pol = agePolicy(p.birthday, todayIn(p.timezone, c.var.now()));
    if (p.birthday && !pol.canSelfRegister) throw new HttpError(403, 'age_restricted', 'Waypoint isn’t available for people under 13 yet.');
  }
  store.setSetting(key, value);
  // Reminder preferences don't change the plan, so don't ask the user to review it.
  if (key !== 'reminders') {
    const tz = store.getSettings().profile?.timezone ?? 'UTC';
    invalidate(store, tz, c.var.now());
  }
  return c.json({ ok: true });
});

planRoutes.put('/goals', async (c) => {
  const goals = await body(c, z.array(GoalSchema.omit({ id: true })).max(MAX_GOALS));
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  if (goals.some((g) => g.kind === 'body_composition') && !ctx.policy.allowWeightLossGoal) {
    throw new HttpError(422, 'validation', 'Body-composition goals aren’t available for your age.', { fields: { goals: 'Not available for your age' } });
  }
  store.replaceGoals(goals);
  invalidate(store, ctx.settings.profile.timezone, c.var.now());
  return c.json({ goals: store.listGoals() });
});

/* ---------- commitments ---------- */

planRoutes.get('/commitments', (c) => c.json({ commitments: c.var.store.listCommitments() }));

planRoutes.post('/commitments', async (c) => {
  const input = await body(c, CommitmentInput);
  const store = c.var.store;
  const settings = requireSettings(store);
  const id = store.createCommitment(input);
  invalidate(store, settings.profile.timezone, c.var.now());
  return c.json({ id }, 201);
});

planRoutes.put('/commitments/:id', async (c) => {
  const input = await body(c, CommitmentInput);
  const store = c.var.store;
  const settings = requireSettings(store);
  if (!store.updateCommitment(c.req.param('id'), input)) throw new HttpError(404, 'not_found', 'Commitment not found.');
  invalidate(store, settings.profile.timezone, c.var.now());
  return c.json({ ok: true });
});

planRoutes.delete('/commitments/:id', (c) => {
  const store = c.var.store;
  const settings = requireSettings(store);
  if (!store.deleteCommitment(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Commitment not found.');
  invalidate(store, settings.profile.timezone, c.var.now());
  return c.json({ ok: true });
});

planRoutes.post('/commitments/:id/exceptions', async (c) => {
  const input = await body(c, z.object({ date: localDate, cancelled: z.boolean() }));
  const store = c.var.store;
  const settings = requireSettings(store);
  if (!store.setException(c.req.param('id'), input.date, input.cancelled)) throw new HttpError(404, 'not_found', 'Commitment not found.');
  invalidate(store, settings.profile.timezone, c.var.now());
  return c.json({ ok: true });
});

/* ---------- plan ---------- */

planRoutes.get('/plan', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const q = c.req.query('week');
  const weekStart = startOfWeek(q && isDate(q) ? q : ctx.today);
  const currentWeek = startOfWeek(ctx.today);
  // The current week is generated automatically the first time it's viewed — there is nothing to overwrite.
  if (weekStart === currentWeek) generateIfEmpty(store, weekStart, c.var.now());
  const plan = store.getPlan(weekStart);
  const items = plan ? store.items(plan.id) : [];
  const week = weekOf(weekStart);
  return c.json({
    weekStart,
    dates: week.dates,
    today: ctx.today,
    nowMinute: ctx.nowMinute,
    awake: Object.fromEntries(week.dates.map((d) => [d, awakeWindow(ctx.settings, d)])),
    canPlan: week.end >= ctx.today && week.start <= addDays(ctx.today, 28),
    plan: plan
      ? {
          id: plan.id,
          version: plan.version,
          stale: !!plan.stale,
          generatedAt: plan.generated_at,
          notes: parseJson<string[]>(plan.notes, []),
          warnings: parseJson<string[]>(plan.warnings, []),
          unscheduled: parseJson<unknown[]>(plan.unscheduled, []),
        }
      : null,
    items: withDisplayStatus(items, ctx.today, ctx.nowMinute),
    clock: ctx.settings.profile.clock,
  });
});

planRoutes.post('/plan/preview', async (c) => {
  const { weekStart } = await body(c, z.object({ weekStart: localDate }));
  return c.json(previewPlan(c.var.store, startOfWeek(weekStart), c.var.now()));
});

planRoutes.post('/plan/apply', async (c) => {
  const { proposalId } = await body(c, z.object({ proposalId: z.string().min(1) }));
  const plan = applyProposal(c.var.store, proposalId);
  return c.json({ ok: true, weekStart: plan.week_start, version: plan.version });
});

/* ---------- item actions ---------- */

planRoutes.patch('/plan/items/:id', async (c) => {
  const input = await body(c, ItemUpdateInput);
  const store = c.var.store;
  const item = store.item(c.req.param('id'));
  if (!item) throw new HttpError(404, 'not_found', 'That activity no longer exists. Refresh to see your latest plan.');
  const ctx = loadContext(store, c.var.now());
  const duration = item.end - item.start;

  switch (input.action) {
    case 'complete': {
      store.updateItem(item.id, { status: 'done', completedAt: c.var.now().toISOString(), effort: input.effort ?? null, discomfort: input.discomfort ?? null, note: input.note ?? null });
      const assignmentId = (item.meta as { assignmentId?: string } | undefined)?.assignmentId;
      if (assignmentId && item.status !== 'done') store.addAssignmentMinutes(assignmentId, duration);
      break;
    }
    case 'skip':
      store.updateItem(item.id, { status: 'skipped', note: input.reason ?? null });
      break;
    case 'reopen':
      store.updateItem(item.id, { status: 'planned', completedAt: null, effort: null, discomfort: null });
      break;
    case 'lock':
      if (item.source === 'fixed') throw new HttpError(400, 'fixed', 'Commitments are always fixed. Edit the commitment to change it.');
      store.updateItem(item.id, { locked: input.locked });
      break;
    case 'move': {
      if (item.source === 'fixed') throw new HttpError(400, 'fixed', 'Commitments are edited from Settings → Schedule, not moved here.');
      if (!isDate(input.date)) throw new HttpError(422, 'validation', 'Invalid date.');
      const start = hhmmToMin(input.start);
      const end = start + duration;
      const plan = store.getPlan(startOfWeek(input.date));
      if (!plan || plan.id !== item.planId) throw new HttpError(400, 'other_week', 'Activities can be moved within the same week.');
      const awake = awakeWindow(ctx.settings, input.date);
      if (start < awake.start || end > awake.end) throw new HttpError(409, 'outside_awake', 'That time is outside your waking hours.');
      const others = store.items(plan.id).filter((o) => o.id !== item.id && o.status !== 'skipped');
      const clashes = conflictsFor({ date: input.date, start, end }, others);
      if (clashes.length) {
        throw new HttpError(409, 'conflict', `That overlaps ${clashes.map((x) => x.title).join(', ')}.`, { conflicts: clashes.map((x) => ({ id: x.id, title: x.title, start: x.start, end: x.end })) });
      }
      // Moved items are locked so a later replan respects the user's choice.
      store.updateItem(item.id, { date: input.date, start, end, locked: true });
      break;
    }
    case 'shorten':
      if (input.minutes >= duration) throw new HttpError(422, 'validation', 'Choose a shorter duration than the current one.');
      store.updateItem(item.id, { end: item.start + input.minutes, shortened: true });
      break;
  }
  store.bumpPlanVersion(item.planId);
  const updated = store.item(item.id)!;
  return c.json({ item: withDisplayStatus([updated], ctx.today, ctx.nowMinute)[0] });
});

/* ---------- today ---------- */

planRoutes.get('/today', (c) => {
  const store = c.var.store;
  const now = c.var.now();
  const ctx = loadContext(store, now);
  const weekStart = startOfWeek(ctx.today);
  const plan = generateIfEmpty(store, weekStart, now);
  const all = withDisplayStatus(store.items(plan.id), ctx.today, ctx.nowMinute);
  const items = all.filter((i) => i.date === ctx.today);

  const next = items.find((i) => i.status === 'planned' && i.end > ctx.nowMinute) ?? null;
  const flexible = all.filter((i) => i.source !== 'fixed' && !['meal', 'care'].includes(i.category) && (i.date < ctx.today || (i.date === ctx.today && i.end <= ctx.nowMinute) || i.status !== 'planned'));
  const byCat = new Map<string, { done: number; total: number }>();
  for (const it of all.filter((i) => i.source !== 'fixed' && !['meal', 'care'].includes(i.category))) {
    const b = byCat.get(it.category) ?? { done: 0, total: 0 };
    b.total++;
    if (it.status === 'done') b.done++;
    byCat.set(it.category, b);
  }

  const courses = new Map(store.courses().map((x) => [x.id, x.name]));
  const upcoming = ctx.modules.has('school')
    ? store
        .assignments()
        .filter((a) => a.status === 'open' && a.dueDate >= ctx.today && a.dueDate <= addDays(ctx.today, 7))
        .slice(0, 5)
        .map((a) => ({ ...a, courseName: a.courseId ? (courses.get(a.courseId) ?? null) : null }))
    : [];
  const overdue = ctx.modules.has('school') ? store.assignments().filter((a) => a.status === 'open' && a.dueDate < ctx.today).length : 0;

  const workoutItem = items.find((i) => i.category === 'workout' || i.category === 'recovery');
  const workoutKey = (workoutItem?.meta as { workoutKey?: string } | undefined)?.workoutKey;
  const workout = workoutKey ? (ctx.program?.workouts.find((w) => w.key === workoutKey) ?? null) : null;

  return c.json({
    today: ctx.today,
    nowMinute: ctx.nowMinute,
    clock: ctx.settings.profile.clock,
    name: ctx.settings.profile.displayName,
    modules: [...ctx.modules],
    stale: !!plan.stale,
    warnings: parseJson<string[]>(plan.warnings, []),
    items,
    next,
    upcoming,
    overdue,
    workout: workout && workoutItem ? { itemId: workoutItem.id, key: workout.key, title: workout.title, purpose: workout.purpose, minutes: workoutItem.end - workoutItem.start, shortened: workoutItem.shortened, exercises: workout.main.map((m) => m.name), blocks: workout.blocks.map((b) => b.name) } : null,
    week: {
      start: weekStart,
      categories: [...byCat.entries()].map(([category, v]) => ({ category, ...v })),
      reviewed: flexible.length,
    },
  });
});
