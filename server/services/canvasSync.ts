import type { UserStore } from '../repos/store';
import { addDays, todayIn, type LocalDate } from '../../shared/domain/time';
import { guessAssignmentType } from '../../shared/domain/school/ics';
import { DEFAULT_MINUTES } from '../../shared/schemas/onboarding';
import type { AssignmentInput } from '../../shared/schemas';
import type { CanvasAssignment, CanvasAssignmentGroup, CanvasClient, CanvasCourse, CanvasSubmission } from '../integrations/canvas';

export const CANVAS_SOURCE = 'canvas';
/** Assignments due before this many days ago are not imported (grades still are). */
const HISTORY_DAYS = 30;
const MAX_COURSES = 25;

export interface SyncSummary {
  courses: number;
  coursesCreated: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  grades: number;
  skippedCourses: number;
}

function assignmentType(a: CanvasAssignment): AssignmentInput['type'] {
  const guessed = guessAssignmentType(a.name);
  if (a.submission_types?.includes('online_quiz') && guessed !== 'test' && guessed !== 'exam') return 'quiz';
  return guessed === 'other' ? 'homework' : guessed;
}

function isDone(s: CanvasSubmission | undefined): boolean {
  if (!s) return false;
  return !!s.excused || !!s.submitted_at || s.workflow_state === 'submitted' || s.workflow_state === 'graded' || s.workflow_state === 'pending_review';
}

/**
 * Pull active courses, upcoming assignments, grading groups and scores.
 * All writes go through the user's own UserStore, keyed by Canvas ids, so
 * syncing again updates instead of duplicating.
 */
export async function syncCanvas(store: UserStore, client: CanvasClient, timeZone: string, now: Date): Promise<SyncSummary> {
  const today: LocalDate = todayIn(timeZone, now);
  const earliest = addDays(today, -HISTORY_DAYS);
  const summary: SyncSummary = { courses: 0, coursesCreated: 0, assignmentsCreated: 0, assignmentsUpdated: 0, grades: 0, skippedCourses: 0 };

  const courses = (
    await client.getAll<CanvasCourse>('/api/v1/courses', { enrollment_state: 'active', 'include[]': ['total_scores'] }, 5)
  ).filter((c) => !c.access_restricted_by_date && (c.name || c.course_code) && (c.enrollments ?? []).some((e) => e.type === 'student' || e.type === 'StudentEnrollment'));

  // Fetch everything first so a network failure part-way doesn't leave a half-written sync.
  const fetched: { course: CanvasCourse; groups: CanvasAssignmentGroup[] }[] = [];
  for (const course of courses.slice(0, MAX_COURSES)) {
    try {
      const groups = await client.getAll<CanvasAssignmentGroup>(`/api/v1/courses/${course.id}/assignment_groups`, { 'include[]': ['assignments', 'submission'] }, 10);
      fetched.push({ course, groups });
    } catch {
      // Some courses (e.g. concluded or restricted) refuse API access; skip them rather than failing the sync.
      summary.skippedCourses++;
    }
  }
  summary.skippedCourses += Math.max(0, courses.length - MAX_COURSES);

  store.tx(() => {
    for (const { course, groups } of fetched) {
      const score = (course.enrollments ?? []).find((e) => e.computed_current_score != null)?.computed_current_score ?? null;
      const name = (course.name || course.course_code || `Course ${course.id}`).slice(0, 80);
      const { id: courseId, created } = store.upsertExternalCourse(CANVAS_SOURCE, String(course.id), name, score);
      summary.courses++;
      if (created) summary.coursesCreated++;

      // Weighted courses: one category per Canvas assignment group, weights confirmed by Canvas.
      // Unweighted (points-based) courses: a single 100% category reproduces Canvas's maths exactly.
      const weighted = !!course.apply_assignment_group_weights;
      const keep: string[] = [];
      const pointsCategory = weighted ? null : store.upsertExternalCategory(CANVAS_SOURCE, courseId, `course:${course.id}:points`, 'All graded work (points-based)', 100, true);
      if (pointsCategory) keep.push(pointsCategory);

      for (const g of groups) {
        const categoryId = weighted ? store.upsertExternalCategory(CANVAS_SOURCE, courseId, `group:${g.id}`, g.name.slice(0, 60), g.group_weight ?? 0, true) : pointsCategory!;
        if (weighted) keep.push(categoryId);
        for (const a of g.assignments ?? []) {
          if (a.published === false) continue;
          const s = a.submission;
          if (s && s.score != null && !s.excused && (a.points_possible ?? 0) > 0 && !a.omit_from_final_grade) {
            store.upsertExternalGrade(CANVAS_SOURCE, { courseId, categoryId, externalId: `submission:${a.id}`, title: a.name.slice(0, 100), pointsEarned: s.score, pointsPossible: a.points_possible! });
            summary.grades++;
          }
          if (!a.due_at) continue;
          const due = todayIn(timeZone, new Date(a.due_at));
          if (due < earliest) continue;
          const type = assignmentType(a);
          const result = store.upsertExternalAssignment(CANVAS_SOURCE, String(a.id), {
            courseId,
            title: a.name.slice(0, 140),
            type,
            dueDate: due,
            estimatedMinutes: DEFAULT_MINUTES[type],
            done: isDone(s),
          });
          if (result === 'created') summary.assignmentsCreated++;
          else summary.assignmentsUpdated++;
        }
      }
      store.pruneExternalCategories(CANVAS_SOURCE, courseId, keep);
    }
  });
  return summary;
}
