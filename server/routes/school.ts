import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { AssignmentInput, CourseInput, GradeCategoryInput, GradeEntryInput } from '../../shared/schemas';
import { DEFAULT_MINUTES } from '../../shared/schemas/onboarding';
import { currentGrade, gradeNeeded } from '../../shared/domain/school/grades';
import { splitIntoSteps } from '../../shared/domain/school/study';
import { guessAssignmentType, isScheduleNote, parseIcs } from '../../shared/domain/school/ics';
import { startOfWeek } from '../../shared/domain/time';
import { loadContext } from '../services/context';

export const schoolRoutes = new Hono<AppEnv>();

schoolRoutes.use('*', async (c, next) => {
  const ctx = loadContext(c.var.store, c.var.now());
  if (!ctx.modules.has('school')) throw new HttpError(404, 'module_disabled', 'School is turned off. You can enable it in Settings.');
  await next();
});

const stale = (c: { var: AppEnv['Variables'] }) => {
  const ctx = loadContext(c.var.store, c.var.now());
  c.var.store.markStale(startOfWeek(ctx.today));
};

schoolRoutes.get('/', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const courses = store.courses().map((course) => {
    const categories = store.gradeCategories(course.id);
    const entries = store.gradeEntries(course.id);
    return { ...course, categories, entries, grade: currentGrade(categories, entries) };
  });
  const names = new Map(courses.map((x) => [x.id, x.name]));
  const assignments = store.assignments().map((a) => ({ ...a, courseName: a.courseId ? (names.get(a.courseId) ?? null) : null, steps: splitIntoSteps(a) }));
  return c.json({ today: ctx.today, school: ctx.settings.school ?? null, courses, assignments });
});

schoolRoutes.post('/courses', async (c) => {
  const id = c.var.store.createCourse(await body(c, CourseInput));
  stale(c);
  return c.json({ id }, 201);
});

schoolRoutes.put('/courses/:id', async (c) => {
  if (!c.var.store.updateCourse(c.req.param('id'), await body(c, CourseInput))) throw new HttpError(404, 'not_found', 'Course not found.');
  stale(c);
  return c.json({ ok: true });
});

schoolRoutes.delete('/courses/:id', (c) => {
  if (!c.var.store.deleteCourse(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Course not found.');
  stale(c);
  return c.json({ ok: true });
});

schoolRoutes.post('/assignments', async (c) => {
  const id = c.var.store.createAssignment(await body(c, AssignmentInput));
  if (!id) throw new HttpError(404, 'not_found', 'Course not found.');
  stale(c);
  return c.json({ id }, 201);
});

schoolRoutes.put('/assignments/:id', async (c) => {
  if (!c.var.store.updateAssignment(c.req.param('id'), await body(c, AssignmentInput))) throw new HttpError(404, 'not_found', 'Assignment not found.');
  stale(c);
  return c.json({ ok: true });
});

schoolRoutes.patch('/assignments/:id/status', async (c) => {
  const { status } = await body(c, z.object({ status: z.enum(['open', 'done']) }));
  if (!c.var.store.setAssignmentStatus(c.req.param('id'), status)) throw new HttpError(404, 'not_found', 'Assignment not found.');
  stale(c);
  return c.json({ ok: true });
});

schoolRoutes.delete('/assignments/:id', (c) => {
  if (!c.var.store.deleteAssignment(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Assignment not found.');
  stale(c);
  return c.json({ ok: true });
});

schoolRoutes.post('/categories', async (c) => {
  const input = await body(c, GradeCategoryInput);
  const id = c.var.store.createGradeCategory(input.courseId, input);
  if (!id) throw new HttpError(404, 'not_found', 'Course not found.');
  return c.json({ id }, 201);
});

schoolRoutes.delete('/categories/:id', (c) => {
  if (!c.var.store.deleteGradeCategory(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Category not found.');
  return c.json({ ok: true });
});

schoolRoutes.post('/grades', async (c) => {
  const input = await body(c, GradeEntryInput);
  const id = c.var.store.createGradeEntry(input);
  if (!id) throw new HttpError(404, 'not_found', 'Course or category not found.');
  return c.json({ id }, 201);
});

schoolRoutes.delete('/grades/:id', (c) => {
  if (!c.var.store.deleteGradeEntry(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Grade not found.');
  return c.json({ ok: true });
});

schoolRoutes.post('/grade-needed', async (c) => {
  const input = await body(
    c,
    z.object({
      courseId: z.string(),
      target: z.number().min(0).max(110),
      remaining: z.array(z.object({ categoryId: z.string(), pointsPossible: z.number().positive() })).min(1, 'Add at least one upcoming graded item'),
    }),
  );
  const store = c.var.store;
  if (!store.course(input.courseId)) throw new HttpError(404, 'not_found', 'Course not found.');
  const cats = store.gradeCategories(input.courseId);
  if (input.remaining.some((r) => !cats.some((x) => x.id === r.categoryId))) throw new HttpError(422, 'validation', 'Unknown category.');
  return c.json(gradeNeeded(cats, store.gradeEntries(input.courseId), input.remaining, input.target));
});

/** Import due dates from an .ics calendar export the user uploads. No credentials involved. */
schoolRoutes.post('/import-ics', async (c) => {
  const input = await body(c, z.object({ text: z.string().min(1).max(400_000), dryRun: z.boolean() }));
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  let parsed;
  try {
    parsed = parseIcs(input.text, ctx.settings.profile.timezone);
  } catch (e) {
    throw new HttpError(422, 'bad_file', (e as Error).message);
  }
  const courses = new Map(store.courses().map((x) => [x.name.toLowerCase(), x.id]));
  const upcoming = parsed.events.filter((e) => e.date >= ctx.today);
  // Schedule notes ("A Day", "B Day", "No School" …) are not work — never import them.
  const events = upcoming.filter((e) => !isScheduleNote(e.summary));
  const scheduleDays = upcoming.length - events.length;
  const preview = events.map((e) => ({ ...e, type: guessAssignmentType(e.summary), duplicate: store.hasExternalAssignment('import:ics', e.uid) }));
  if (input.dryRun) return c.json({ events: preview, skipped: parsed.skipped, past: parsed.events.length - upcoming.length, scheduleDays });
  let created = 0;
  store.tx(() => {
    store.deleteImportedScheduleNotes();
    for (const e of preview) {
      if (e.duplicate) continue;
      let courseId: string | null = null;
      if (e.course) {
        courseId = courses.get(e.course.toLowerCase()) ?? null;
        if (!courseId) {
          courseId = store.createCourse({ name: e.course, difficulty: 3, targetGrade: null }, 'import:ics');
          courses.set(e.course.toLowerCase(), courseId);
        }
      }
      store.createAssignment({ courseId, title: e.summary.slice(0, 140), type: e.type, dueDate: e.date, estimatedMinutes: DEFAULT_MINUTES[e.type], notes: e.description }, 'import:ics', e.uid);
      created++;
    }
  });
  store.upsertIntegration('ics_import', { status: 'used', lastSyncAt: new Date().toISOString(), meta: { lastImported: created } });
  stale(c);
  return c.json({ created });
});
