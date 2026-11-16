import { addDays, daysBetween, type LocalDate } from '../time';
import type { ActivityRequest, Interval } from '../planner/types';

export interface AssignmentLike {
  id: string;
  title: string;
  type: 'homework' | 'project' | 'essay' | 'quiz' | 'test' | 'exam' | 'reading' | 'other';
  dueDate: LocalDate;
  estimatedMinutes: number;
  completedMinutes: number;
  status: 'open' | 'done';
  courseName: string | null;
  courseDifficulty: number; // 1–5
}

export interface StepSuggestion {
  name: string;
  minutes: number;
}

/** Break large work into manageable steps. Deterministic, editable by the user later. */
export function splitIntoSteps(a: Pick<AssignmentLike, 'type' | 'estimatedMinutes'>): StepSuggestion[] {
  const m = a.estimatedMinutes;
  const pct = (p: number) => Math.max(10, Math.round((m * p) / 5) * 5);
  switch (a.type) {
    case 'essay':
      return [
        { name: 'Understand the prompt and gather sources', minutes: pct(0.2) },
        { name: 'Outline your argument', minutes: pct(0.15) },
        { name: 'Write the first draft', minutes: pct(0.4) },
        { name: 'Revise for clarity and evidence', minutes: pct(0.2) },
        { name: 'Proofread, cite and submit', minutes: pct(0.05) },
      ];
    case 'project':
      return [
        { name: 'Clarify requirements and plan tasks', minutes: pct(0.15) },
        { name: 'Research / build the first part', minutes: pct(0.35) },
        { name: 'Finish the main work', minutes: pct(0.35) },
        { name: 'Review against the rubric and submit', minutes: pct(0.15) },
      ];
    case 'test':
    case 'exam':
    case 'quiz':
      return [
        { name: 'List topics and find weak spots', minutes: pct(0.15) },
        { name: 'Active recall: practice questions', minutes: pct(0.4) },
        { name: 'Review mistakes and re-learn', minutes: pct(0.25) },
        { name: 'Mixed practice under time pressure', minutes: pct(0.2) },
      ];
    default:
      return [{ name: 'Complete the work', minutes: m }];
  }
}

const LEAD_DAYS: Record<AssignmentLike['type'], number> = {
  homework: 3, reading: 3, other: 4, quiz: 4, project: 10, essay: 10, test: 7, exam: 12,
};

/**
 * Convert open assignments into study requests for the planner.
 * Study is spread before the due date (spaced practice), never on it unless
 * it is already due today.
 */
export function studyRequests(assignments: AssignmentLike[], opts: { today: LocalDate; horizon: LocalDate[]; window: Interval; busyLimitMinutes?: number }): ActivityRequest[] {
  const first = opts.horizon[0]!;
  const last = opts.horizon[opts.horizon.length - 1]!;
  const reqs: ActivityRequest[] = [];
  for (const a of assignments) {
    if (a.status === 'done') continue;
    const remaining = a.estimatedMinutes - a.completedMinutes;
    if (remaining <= 0) continue;
    if (a.dueDate < opts.today) continue; // overdue: shown in School, not auto-crammed
    const lead = LEAD_DAYS[a.type];
    const earliest = addDays(a.dueDate, -lead);
    if (earliest > last) continue; // starts after this plan
    const latest = a.dueDate <= opts.today ? a.dueDate : addDays(a.dueDate, -1);
    const daysAvailable = Math.max(1, daysBetween(earliest < opts.today ? opts.today : earliest, latest) + 1);
    const chunk = a.type === 'test' || a.type === 'exam' || a.type === 'quiz' ? 40 : a.type === 'homework' || a.type === 'reading' ? Math.min(60, Math.max(20, remaining)) : 50;
    // Share of the remaining work that belongs in this plan's window.
    const inWindowDays = Math.max(1, daysBetween(earliest < first ? first : earliest, latest < last ? latest : last) + 1);
    const minutesThisPlan = Math.ceil((remaining * Math.min(1, inWindowDays / daysAvailable)) / 5) * 5;
    const count = Math.max(1, Math.min(5, Math.ceil(minutesThisPlan / chunk)));
    const daysUntilDue = daysBetween(opts.today, a.dueDate);
    const priority = Math.max(1, (daysUntilDue <= 2 ? 1 : daysUntilDue <= 5 ? 2 : 3) - (a.courseDifficulty >= 4 && daysUntilDue <= 7 ? 1 : 0));
    const ideal = Math.min(chunk, Math.max(20, Math.ceil(minutesThisPlan / count / 5) * 5));
    reqs.push({
      key: `study:${a.id}`,
      title: `${a.type === 'test' || a.type === 'exam' || a.type === 'quiz' ? 'Study for' : 'Work on'} ${a.title}`,
      category: 'study',
      idealMinutes: ideal,
      minMinutes: Math.min(ideal, 25),
      count,
      priority,
      window: opts.window,
      earliestDate: earliest,
      latestDate: latest,
      refId: a.id,
      explain: `${a.courseName ? `${a.courseName}: ` : ''}due ${a.dueDate}. About ${remaining} min of work left, spread out so you are not cramming the night before.`,
      meta: { assignmentId: a.id, steps: splitIntoSteps(a).map((s) => s.name) },
    });
  }
  return reqs;
}
