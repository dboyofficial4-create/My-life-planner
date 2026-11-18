import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { splitIntoSteps } from '../../shared/domain/school/study';
import { LOW_UTILITY_NOTE, STUDY_METHODS, STUDY_SOURCES, methodsForStep, nextSteps, reviewCard } from '../../shared/domain/school/studyguide';
import { daysBetween, startOfWeek } from '../../shared/domain/time';
import { loadContext } from '../services/context';

/** Mounted under /api/school/study (inherits the School-module check). */
export const studyRoutes = new Hono<AppEnv>();

const Scope = z.object({ courseId: z.string().nullable().optional(), assignmentId: z.string().nullable().optional() });
type ScopeInput = z.infer<typeof Scope>;

function scopeOf(c: Context<AppEnv>, s: ScopeInput) {
  const scope = c.var.store.studyScope({ courseId: s.courseId ?? null, assignmentId: s.assignmentId ?? null });
  if (!scope) throw new HttpError(404, 'not_found', 'Course or assignment not found.');
  return scope;
}

const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => {
    try {
      const p = new URL(u).protocol;
      return p === 'https:' || p === 'http:';
    } catch {
      return false;
    }
  }, 'Enter a full web address starting with https://');

/* ---------- guide ---------- */

studyRoutes.get('/guide', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const scope = scopeOf(c, { courseId: c.req.query('courseId') || null, assignmentId: c.req.query('assignmentId') || null });
  if (!scope.courseId && !scope.assignmentId) throw new HttpError(422, 'validation', 'Choose a course or assignment.');
  const assignment = scope.assignmentId ? store.assignments().find((a) => a.id === scope.assignmentId) ?? null : null;
  const course = scope.courseId ? store.course(scope.courseId) ?? null : null;
  const topics = store.topics(scope);
  const materials = store.materials(scope);
  const cards = store.cards(scope);
  const cardsDue = cards.filter((x) => x.dueDate <= ctx.today).length;
  const isTest = !!assignment && ['test', 'exam', 'quiz'].includes(assignment.type);

  // Study sessions already in the plan for this assignment.
  const sessions = assignment
    ? store
        .itemsBetween(ctx.today, '9999-12-31')
        .filter((i) => (i.meta as { assignmentId?: string } | undefined)?.assignmentId === assignment.id || i.refId === assignment.id)
        .map((i) => ({ id: i.id, date: i.date, start: i.start, end: i.end, status: i.status }))
    : [];

  const steps = assignment
    ? splitIntoSteps(assignment).map((s) => ({ ...s, methods: methodsForStep(s.name) }))
    : [];

  return c.json({
    today: ctx.today,
    clock: ctx.settings.profile.clock,
    scope,
    course: course ? { id: course.id, name: course.name } : null,
    assignment: assignment
      ? { ...assignment, daysLeft: daysBetween(ctx.today, assignment.dueDate), isTest }
      : null,
    steps,
    sessions,
    topics,
    materials,
    cards: { total: cards.length, due: cardsDue, mastered: cards.filter((x) => x.box >= 4).length },
    next: nextSteps({ dueDate: assignment?.dueDate ?? null, today: ctx.today, topics, cardsDue, cardsTotal: cards.length, materials: materials.length, isTest: isTest || !assignment }),
    methods: Object.values(STUDY_METHODS),
    sources: STUDY_SOURCES,
    lowUtilityNote: LOW_UTILITY_NOTE,
  });
});

/** All study material across courses (for the School → Study tab). */
studyRoutes.get('/overview', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const all = store.cards({ courseId: null, assignmentId: null });
  const courses = store.courses().map((co) => {
    const cards = all.filter((x) => x.courseId === co.id);
    return { id: co.id, name: co.name, materials: store.materials({ courseId: co.id, assignmentId: null }).length, cards: cards.length, due: cards.filter((x) => x.dueDate <= ctx.today).length };
  });
  return c.json({ today: ctx.today, totalDue: all.filter((x) => x.dueDate <= ctx.today).length, totalCards: all.length, courses });
});

/* ---------- materials ---------- */

const MaterialInput = Scope.extend({
  kind: z.enum(['notes', 'link']),
  title: z.string().trim().min(1, 'Add a title').max(140),
  body: z.string().max(50_000),
  url: httpUrl.nullable(),
}).refine((m) => m.kind !== 'link' || !!m.url, { path: ['url'], message: 'Add the link' }).refine((m) => m.kind !== 'notes' || m.body.trim().length > 0, { path: ['body'], message: 'Add some notes' });

studyRoutes.post('/materials', async (c) => {
  const input = await body(c, MaterialInput);
  const id = c.var.store.createMaterial(scopeOf(c, input), { kind: input.kind, title: input.title, body: input.body, url: input.kind === 'link' ? input.url : null });
  return c.json({ id }, 201);
});

studyRoutes.put('/materials/:id', async (c) => {
  const input = await body(c, z.object({ title: z.string().trim().min(1, 'Add a title').max(140), body: z.string().max(50_000), url: httpUrl.nullable() }));
  if (!c.var.store.updateMaterial(c.req.param('id'), input)) throw new HttpError(404, 'not_found', 'Material not found.');
  return c.json({ ok: true });
});

studyRoutes.delete('/materials/:id', (c) => {
  if (!c.var.store.deleteMaterial(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Material not found.');
  return c.json({ ok: true });
});

/* ---------- topics ---------- */

studyRoutes.post('/topics', async (c) => {
  const input = await body(c, Scope.extend({ titles: z.array(z.string().trim().min(1).max(100)).min(1, 'Add a topic').max(50) }));
  const created = c.var.store.createTopics(scopeOf(c, input), input.titles);
  return c.json({ created }, 201);
});

studyRoutes.patch('/topics/:id', async (c) => {
  const { confidence } = await body(c, z.object({ confidence: z.number().int().min(0).max(2) }));
  if (!c.var.store.setTopicConfidence(c.req.param('id'), confidence)) throw new HttpError(404, 'not_found', 'Topic not found.');
  return c.json({ ok: true });
});

studyRoutes.delete('/topics/:id', (c) => {
  if (!c.var.store.deleteTopic(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Topic not found.');
  return c.json({ ok: true });
});

/* ---------- flashcards ---------- */

const CardText = z.object({ front: z.string().trim().min(1, 'Add the front').max(500), back: z.string().trim().min(1, 'Add the back').max(2000) });

studyRoutes.get('/cards', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const scope = scopeOf(c, { courseId: c.req.query('courseId') || null, assignmentId: c.req.query('assignmentId') || null });
  const all = store.cards(scope);
  const dueOnly = c.req.query('due') === '1';
  return c.json({ today: ctx.today, cards: dueOnly ? all.filter((x) => x.dueDate <= ctx.today) : all });
});

studyRoutes.post('/cards', async (c) => {
  const input = await body(c, Scope.extend({ cards: z.array(CardText).min(1, 'Add at least one card').max(200) }));
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const created = store.createCards(scopeOf(c, input), input.cards, ctx.today);
  store.markStale(startOfWeek(ctx.today));
  return c.json({ created, skippedDuplicates: input.cards.length - created }, 201);
});

studyRoutes.put('/cards/:id', async (c) => {
  if (!c.var.store.updateCard(c.req.param('id'), await body(c, CardText))) throw new HttpError(404, 'not_found', 'Card not found.');
  return c.json({ ok: true });
});

studyRoutes.post('/cards/:id/review', async (c) => {
  const { correct } = await body(c, z.object({ correct: z.boolean() }));
  const store = c.var.store;
  const card = store.card(c.req.param('id'));
  if (!card) throw new HttpError(404, 'not_found', 'Card not found.');
  const ctx = loadContext(store, c.var.now());
  const next = reviewCard(card.box, correct, ctx.today);
  store.recordReview(card.id, { ...next, correct });
  return c.json({ box: next.box, dueDate: next.due });
});

studyRoutes.delete('/cards/:id', (c) => {
  if (!c.var.store.deleteCard(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Card not found.');
  return c.json({ ok: true });
});
