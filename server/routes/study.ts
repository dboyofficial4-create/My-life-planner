import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { splitIntoSteps } from '../../shared/domain/school/study';
import { LOW_UTILITY_NOTE, STUDY_METHODS, STUDY_SOURCES, methodsForStep, nextSteps, reviewCard } from '../../shared/domain/school/studyguide';
import { daysBetween, startOfWeek } from '../../shared/domain/time';
import { loadContext } from '../services/context';
import { decryptSecret } from '../auth/crypto';
import { anthropicStudyAI, sanitizeStudySet, toContentBlocks } from '../services/studyAI';

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
  const questionCount = store.questions(scope).length;
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
    questions: questionCount,
    next: [
      ...(questionCount ? [{ title: `Take the ${questionCount}-question practice test`, detail: 'Answer before you look. Topics you miss are marked so your next steps focus on them.', method: 'retrieval' as const }] : []),
      ...nextSteps({ dueDate: assignment?.dueDate ?? null, today: ctx.today, topics, cardsDue, cardsTotal: cards.length, materials: materials.length, isTest: isTest || !assignment }),
    ].slice(0, 4),
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

/* ---------- AI: upload material → study set ---------- */

/** The key to use: the server's (if configured) or the student's own. */
export function aiKeyFor(c: Context<AppEnv>): string | null {
  if (c.var.config.anthropicApiKey) return c.var.config.anthropicApiKey;
  const enc = c.var.store.integrationToken('anthropic');
  return enc && c.var.config.encryptionKey ? decryptSecret(enc, c.var.config.encryptionKey) : null;
}

const GenerateInput = Scope.extend({
  files: z
    .array(z.object({ name: z.string().max(200), mediaType: z.string().max(120), data: z.string().max(28_000_000) }))
    .max(10, 'Upload up to 10 files at a time'),
  text: z.string().max(100_000),
  flashcards: z.number().int().min(5).max(40),
  questions: z.number().int().min(3).max(25),
  consent: z.literal(true, { error: 'Please confirm the material can be sent to the AI service' }),
});

studyRoutes.post('/generate', async (c) => {
  const input = await body(c, GenerateInput);
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const scope = scopeOf(c, input);
  if (!scope.courseId && !scope.assignmentId) throw new HttpError(422, 'validation', 'Choose which test or course this is for.');
  const key = aiKeyFor(c);
  if (!key) throw new HttpError(409, 'ai_not_connected', 'Add an Anthropic API key in Settings → Connections to generate study sets.');

  const content = toContentBlocks(input.files, input.text);
  const assignment = scope.assignmentId ? store.assignments().find((a) => a.id === scope.assignmentId) : undefined;
  const course = scope.courseId ? store.course(scope.courseId) : undefined;
  const ai = (c.var.config.studyAI ?? anthropicStudyAI)(key);
  const result = await ai.generate(content, {
    subject: course?.name ?? null,
    assessment: assignment?.title ?? null,
    assessmentType: assignment?.type ?? null,
    flashcards: input.flashcards,
    questions: input.questions,
  });
  if (result.set.insufficient) {
    throw new HttpError(422, 'ai_insufficient', result.set.insufficientReason || 'There wasn’t enough readable material to make a study set.');
  }
  const set = sanitizeStudySet(result.set, input);
  if (!set.flashcards.length && !set.questions.length) throw new HttpError(422, 'ai_insufficient', 'Couldn’t make study material from that. Try clearer or longer notes.');

  const counts = store.tx(() => {
    store.createMaterial(scope, { kind: 'generated', title: `AI study sheet: ${set.title}`, body: set.overview ? `${set.overview}\n\n${set.studySheet}` : set.studySheet, url: null });
    // Keep the student's own pasted/text notes too (uploaded files themselves are not stored).
    if (input.text.trim()) store.createMaterial(scope, { kind: 'notes', title: 'Pasted notes', body: input.text.slice(0, 50_000), url: null });
    const topics = store.createTopics(scope, set.topics.map((t) => t.title));
    const cards = store.createCards(scope, set.flashcards, ctx.today);
    const questions = store.createQuestions(scope, set.questions);
    return { topics, cards, questions };
  });
  store.markStale(startOfWeek(ctx.today));
  return c.json({ ok: true, title: set.title, ...counts, usage: result.usage, model: result.model }, 201);
});

/* ---------- practice tests ---------- */

studyRoutes.get('/questions', (c) => {
  const scope = scopeOf(c, { courseId: c.req.query('courseId') || null, assignmentId: c.req.query('assignmentId') || null });
  return c.json({ questions: c.var.store.questions(scope) });
});

studyRoutes.delete('/questions/:id', (c) => {
  if (!c.var.store.deleteQuestion(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Question not found.');
  return c.json({ ok: true });
});

/** Record a finished practice test and update topic confidence from the results. */
studyRoutes.post('/test-results', async (c) => {
  const input = await body(c, Scope.extend({ results: z.array(z.object({ questionId: z.string(), correct: z.boolean() })).min(1).max(100) }));
  const store = c.var.store;
  const scope = scopeOf(c, input);
  const byTopic = new Map<string, { right: number; total: number }>();
  let right = 0;
  store.tx(() => {
    for (const r of input.results) {
      const q = store.recordAnswer(r.questionId, r.correct);
      if (!q) continue;
      if (r.correct) right++;
      if (!q.topic) continue;
      const t = byTopic.get(q.topic) ?? { right: 0, total: 0 };
      t.total++;
      if (r.correct) t.right++;
      byTopic.set(q.topic, t);
    }
    for (const [topic, t] of byTopic) {
      // All right → got it; most right → shaky; otherwise not yet.
      const confidence = t.right === t.total ? 2 : t.right / t.total >= 0.5 ? 1 : 0;
      store.setTopicConfidenceByTitle(scope, topic, confidence);
    }
  });
  const weak = [...byTopic.entries()].filter(([, t]) => t.right < t.total).map(([topic]) => topic);
  return c.json({ right, total: input.results.length, weakTopics: weak });
});
