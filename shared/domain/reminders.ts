import { z } from 'zod';
import { addDays, daysBetween, formatMinutes, type LocalDate } from './time';
import type { PlanCategory } from '../schemas';

/* ---------- settings ---------- */

export const ReminderSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Minutes before an activity starts. */
  leadMinutes: z.number().int().min(0).max(120),
  activities: z.object({
    training: z.boolean(), // workouts, recovery, sport skill work
    study: z.boolean(),
    commitments: z.boolean(), // practices, games, appointments (not school/work hours)
    care: z.boolean(),
    meals: z.boolean(),
  }),
  deadlines: z.boolean(),
  morningSummary: z.boolean(),
  flashcards: z.boolean(),
  /** "Still want to do X?" after a study/training session passes without being marked done. */
  missedNudges: z.boolean(),
});
export type ReminderSettings = z.infer<typeof ReminderSettingsSchema>;

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  leadMinutes: 10,
  activities: { training: true, study: true, commitments: true, care: false, meals: false },
  deadlines: true,
  morningSummary: true,
  flashcards: true,
  missedNudges: true,
};

/* ---------- inputs ---------- */

export interface ReminderItem {
  id: string;
  date: LocalDate;
  start: number;
  end: number;
  title: string;
  category: PlanCategory;
  source: 'fixed' | 'generated' | 'locked';
  status: 'planned' | 'done' | 'skipped' | 'missed';
  commitmentKind?: string;
}

export interface ReminderAssignment {
  id: string;
  title: string;
  type: string;
  dueDate: LocalDate;
  status: 'open' | 'done';
  courseName: string | null;
}

export interface ReminderInput {
  today: LocalDate;
  nowMinute: number;
  awake: { start: number; end: number };
  clock: '12h' | '24h';
  settings: ReminderSettings;
  items: ReminderItem[]; // today's plan items
  assignments: ReminderAssignment[];
  cardsDue: number;
}

export interface Reminder {
  /** Stable id: the same reminder is never sent twice. */
  key: string;
  kind: 'activity' | 'deadline' | 'morning' | 'flashcards' | 'missed';
  /** Minute of the day when it becomes due. */
  at: number;
  title: string;
  body: string;
  url: string;
}

/** How late a reminder may still be sent (e.g. after the server was off). Deadlines stay valid all day. */
const CATCH_UP: Record<Reminder['kind'], number> = { activity: 15, missed: 60, morning: 120, flashcards: 180, deadline: 24 * 60 };

const TRAINING: PlanCategory[] = ['workout', 'recovery', 'sport'];

function activityEnabled(it: ReminderItem, s: ReminderSettings): boolean {
  if (it.source === 'fixed') {
    // School and work hours are routine — never remind about them.
    if (it.commitmentKind === 'school' || it.commitmentKind === 'work' || it.commitmentKind === 'class') return false;
    return s.activities.commitments;
  }
  if (TRAINING.includes(it.category)) return s.activities.training;
  if (it.category === 'study') return s.activities.study;
  if (it.category === 'care') return s.activities.care;
  if (it.category === 'meal' || it.category === 'meal_prep') return s.activities.meals;
  return false;
}

const isTest = (type: string) => type === 'test' || type === 'exam' || type === 'quiz';

/**
 * All reminders that should go out at `nowMinute`, deterministically.
 * The caller de-duplicates by key, so it's safe to call every minute.
 */
export function dueReminders(input: ReminderInput): Reminder[] {
  const { settings: s, today, nowMinute, awake, clock } = input;
  if (!s.enabled) return [];
  const all: Reminder[] = [];
  const t = (m: number) => formatMinutes(m, clock);
  const open = input.items.filter((i) => i.date === today && i.status === 'planned');

  if (s.morningSummary) {
    const flexible = open.filter((i) => i.source !== 'fixed' && i.category !== 'meal' && i.category !== 'care');
    const first = flexible[0];
    const due = input.assignments.filter((a) => a.status === 'open' && a.dueDate === today);
    if (flexible.length || due.length) {
      const parts = [];
      if (flexible.length) parts.push(`${flexible.length} planned: first is ${first!.title} at ${t(first!.start)}`);
      if (due.length) parts.push(`due today: ${due.map((a) => a.title).join(', ')}`);
      all.push({ key: `morning:${today}`, kind: 'morning', at: awake.start + 15, title: 'Your day', body: `${parts.join('. ')}.`, url: '/' });
    }
  }

  for (const it of open) {
    if (!activityEnabled(it, s)) continue;
    all.push({
      key: `act:${it.id}:${it.date}:${it.start}`,
      kind: 'activity',
      at: Math.max(0, it.start - s.leadMinutes),
      title: s.leadMinutes ? `In ${s.leadMinutes} min: ${it.title}` : `Now: ${it.title}`,
      body: `${t(it.start)}–${t(it.end)}`,
      url: '/',
    });
    if (s.missedNudges && it.source !== 'fixed' && (it.category === 'study' || TRAINING.includes(it.category))) {
      all.push({
        key: `missed:${it.id}:${it.date}`,
        kind: 'missed',
        at: it.end + 30,
        title: `Still want to do ${it.title}?`,
        body: 'Mark it done, move it, or skip it — no catch-up pile-up.',
        url: '/',
      });
    }
  }

  if (s.deadlines) {
    for (const a of input.assignments) {
      if (a.status !== 'open') continue;
      const days = daysBetween(today, a.dueDate);
      const label = `${a.title}${a.courseName ? ` (${a.courseName})` : ''}`;
      const guide = `/school/study?assignmentId=${a.id}`;
      if (days === 0) all.push({ key: `due0:${a.id}:${a.dueDate}`, kind: 'deadline', at: awake.start + 20, title: `Due today: ${label}`, body: 'Finish it and mark it done in School.', url: '/school' });
      if (days === 1) all.push({ key: `due1:${a.id}:${a.dueDate}`, kind: 'deadline', at: Math.min(18 * 60, awake.end - 60), title: `Due tomorrow: ${label}`, body: isTest(a.type) ? 'Do a practice test or review flashcards tonight.' : 'Make sure it’s ready to hand in.', url: isTest(a.type) ? guide : '/school' });
      if (days === 3 && (isTest(a.type) || a.type === 'project' || a.type === 'essay')) {
        all.push({ key: `due3:${a.id}:${a.dueDate}`, kind: 'deadline', at: Math.min(17 * 60, awake.end - 60), title: `${isTest(a.type) ? 'Test' : 'Due'} in 3 days: ${label}`, body: 'Open the study guide to see what to focus on.', url: guide });
      }
    }
  }

  if (s.flashcards && input.cardsDue > 0) {
    const firstStudy = open.find((i) => i.category === 'study');
    all.push({ key: `cards:${today}`, kind: 'flashcards', at: firstStudy ? firstStudy.start : Math.min(17 * 60, awake.end - 90), title: `${input.cardsDue} flashcard${input.cardsDue === 1 ? '' : 's'} due`, body: 'A 10-minute review keeps them from slipping.', url: '/school/review' });
  }

  return all.filter(
    (r) =>
      r.at <= nowMinute &&
      nowMinute - r.at <= CATCH_UP[r.kind] &&
      // Quiet hours: nothing outside your waking hours.
      nowMinute >= awake.start &&
      nowMinute <= awake.end,
  );
}

/** Keys from earlier days can be pruned after this many days. */
export const REMINDER_RETENTION_DAYS = 14;
export const pruneBefore = (today: LocalDate) => addDays(today, -REMINDER_RETENTION_DAYS);
