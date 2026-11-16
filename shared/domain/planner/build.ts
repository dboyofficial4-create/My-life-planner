import type { AgePolicy } from '../age';
import { addDays, hhmmToMin, weekdayOf, type LocalDate } from '../time';
import type { Commitment, Goal, SettingsBundle, TimePref } from '../../schemas';
import type { Program } from '../fitness/generator';
import { SPORT_LABELS } from '../fitness/sports';
import type { MealEntry } from '../nutrition/mealplan';
import { recipeById } from '../nutrition/recipes';
import type { Routine } from '../care/routines';
import { washDays } from '../care/routines';
import { studyRequests, type AssignmentLike } from '../school/study';
import type { ActivityRequest, FixedBlock, Interval, PlanInput } from './types';

export interface BuildContext {
  dates: LocalDate[];
  today: LocalDate;
  settings: SettingsBundle;
  goals: Goal[];
  commitments: Commitment[];
  policy: AgePolicy;
  program?: Program | null;
  meals?: MealEntry[];
  assignments?: AssignmentLike[];
  skin?: Routine | null;
  hair?: Routine | null;
  /** User-locked items carried over from the current plan. */
  locked?: FixedBlock[];
  notBefore?: PlanInput['notBefore'];
}

const isWeekend = (d: LocalDate) => {
  const w = weekdayOf(d);
  return w === 0 || w === 6;
};

export function awakeWindow(settings: SettingsBundle, date: LocalDate): Interval {
  const s = settings.schedule;
  const wake = hhmmToMin(isWeekend(date) ? s.wakeWeekend : s.wakeWeekday);
  const sleep = hhmmToMin(isWeekend(date) ? s.sleepWeekend : s.sleepWeekday);
  return { start: wake, end: sleep <= wake ? 1440 : sleep };
}

function prefWindow(pref: TimePref, awake: Interval, kind: 'workout' | 'study'): Interval {
  switch (pref) {
    case 'morning':
      return { start: awake.start + 30, end: 12 * 60 };
    case 'afternoon':
      return kind === 'study' ? { start: 15 * 60, end: 18 * 60 } : { start: 14 * 60, end: 17 * 60 + 30 };
    case 'evening':
      return { start: 17 * 60 + 30, end: Math.max(18 * 60 + 30, awake.end - 60) };
    default:
      return { start: awake.start + 60, end: awake.end - 90 };
  }
}

/** Expand commitments into dated fixed blocks, applying cancelled-date exceptions. */
export function expandCommitments(commitments: Commitment[], dates: LocalDate[]): FixedBlock[] {
  const out: FixedBlock[] = [];
  for (const c of commitments) {
    for (const date of dates) {
      const occurs = c.recurrence.type === 'weekly' ? c.recurrence.days.includes(weekdayOf(date)) : c.recurrence.date === date;
      if (!occurs || c.exceptions.includes(date)) continue;
      const sport = c.kind === 'practice' || c.kind === 'game';
      out.push({
        id: `${c.id}:${date}`,
        date,
        start: hhmmToMin(c.start),
        end: hhmmToMin(c.end),
        title: c.title,
        category: sport ? 'sport' : 'commitment',
        kind: c.kind,
        travelBefore: c.travelBefore,
        travelAfter: c.travelAfter,
        load: sport ? c.intensity : 0,
        refId: c.id,
      });
    }
  }
  return out;
}

export interface BuildResult {
  input: PlanInput;
  notes: string[];
}

export function buildPlanInput(ctx: BuildContext): BuildResult {
  const { settings, dates, goals } = ctx;
  const sched = settings.schedule;
  const modules = new Set(settings.profile.modules);
  const notes: string[] = [];
  const awake: Record<LocalDate, Interval> = {};
  for (const d of dates) awake[d] = awakeWindow(settings, d);

  const fixed = [...expandCommitments(ctx.commitments, dates), ...(ctx.locked ?? [])];
  const restDates = dates.filter((d) => sched.restDays.includes(weekdayOf(d)));
  const busyDates = dates.filter((d) => sched.busyDays.includes(weekdayOf(d)));
  const gameDates = new Set(fixed.filter((f) => f.kind === 'game').map((f) => f.date));
  const hardAvoid = dates.filter((d) => gameDates.has(d) || gameDates.has(addDays(d, 1)));

  const requests: ActivityRequest[] = [];
  const rank = (module: string) => {
    const sorted = [...goals].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((g) => g.module === module);
    return idx < 0 ? 4 : idx === 0 ? 2 : idx <= 2 ? 3 : 4;
  };

  /* ---- Meals ---- */
  const mealsByDate = new Map<string, MealEntry>();
  for (const m of ctx.meals ?? []) mealsByDate.set(`${m.date}:${m.slot}`, m);
  const mealTitle = (date: LocalDate, slot: 'breakfast' | 'lunch' | 'dinner', fallback: string) => {
    const e = mealsByDate.get(`${date}:${slot}`);
    if (!e) return { title: fallback, cook: 0, meta: undefined };
    if (!e.recipeId) return { title: `${fallback}: ${e.label ?? 'eating out'}`, cook: 0, meta: { mealSlot: slot } };
    const r = recipeById(e.recipeId);
    const cook = e.leftoverOf || !r ? 0 : Math.min(45, r.prepMinutes + r.cookMinutes);
    return { title: `${fallback}: ${r?.name ?? 'meal'}${e.leftoverOf ? ' (leftovers)' : ''}`, cook, meta: { mealSlot: slot, recipeId: e.recipeId } };
  };
  const coversLunch = new Set(fixed.filter((f) => (f.kind === 'school' || f.kind === 'work') && f.start <= 12 * 60 && f.end >= 13 * 60).map((f) => f.date));
  for (const date of dates) {
    const a = awake[date]!;
    const b = mealTitle(date, 'breakfast', 'Breakfast');
    requests.push({ key: `meal:breakfast:${date}`, title: b.title, category: 'meal', idealMinutes: 20, minMinutes: 10, count: 1, perDay: true, eligibleDates: [date], priority: 1, window: { start: a.start, end: a.start + 100 }, hardWindow: true, explain: 'A regular breakfast keeps your energy steady through the morning.', meta: b.meta });
    if (!coversLunch.has(date)) {
      const l = mealTitle(date, 'lunch', 'Lunch');
      requests.push({ key: `meal:lunch:${date}`, title: l.title, category: 'meal', idealMinutes: 30, minMinutes: 15, count: 1, perDay: true, eligibleDates: [date], priority: 1, window: { start: 11 * 60 + 30, end: 14 * 60 + 30 }, hardWindow: true, explain: 'Midday fuel.', meta: l.meta });
    }
    const dn = mealTitle(date, 'dinner', 'Dinner');
    const dinnerMinutes = 30 + (modules.has('nutrition') ? dn.cook : 0);
    requests.push({ key: `meal:dinner:${date}`, title: dn.title, category: 'meal', idealMinutes: dinnerMinutes, minMinutes: 20, count: 1, perDay: true, eligibleDates: [date], priority: 1, window: { start: 17 * 60 + 15, end: Math.min(21 * 60, a.end) }, hardWindow: true, explain: dn.cook ? `Includes about ${dn.cook} min to cook.` : 'Evening meal.', meta: dn.meta });
  }
  if (coversLunch.size) notes.push('Lunch on school or work days happens during that commitment, so it isn’t scheduled separately.');

  if (modules.has('nutrition') && settings.nutrition?.mealPrepDay != null) {
    const prepDate = dates.find((d) => weekdayOf(d) === settings.nutrition!.mealPrepDay);
    if (prepDate) {
      requests.push({ key: 'meal_prep', title: 'Meal prep', category: 'meal_prep', idealMinutes: 75, minMinutes: 40, count: 1, eligibleDates: [prepDate], priority: 3, window: { start: 13 * 60, end: 18 * 60 }, explain: 'Batch-cook staples so weekday meals are quick.' });
    }
  }

  /* ---- Fitness ---- */
  if (modules.has('fitness') && ctx.program && settings.fitness) {
    const pr = rank('fitness');
    const strengthCount = ctx.program.workouts.filter((w) => w.main.length > 0).length;
    for (const w of ctx.program.workouts) {
      const sampleAwake = awake[dates[0]!]!;
      requests.push({
        key: `workout:${w.key}`,
        title: `${w.title} workout`,
        category: w.focus === 'mobility' ? 'recovery' : 'workout',
        idealMinutes: w.minutes,
        minMinutes: Math.min(w.minutes, w.expressMinutes),
        count: 1,
        priority: pr,
        window: prefWindow(sched.preferredWorkoutTime, sampleAwake, 'workout'),
        group: w.main.length ? 'strength' : w.focus === 'mobility' ? undefined : 'conditioning',
        minGapDays: w.main.length ? (strengthCount <= 3 ? 1 : 0) : 0,
        load: w.load,
        avoidDates: w.load > 0 ? hardAvoid : undefined,
        explain: `${w.purpose}`,
        meta: { workoutKey: w.key },
      });
    }
    if (hardAvoid.length) notes.push('Harder workouts are kept off game days and the day before games.');
  }

  /* ---- Sports skill work ---- */
  if (modules.has('sports') && settings.sports?.sports.length) {
    for (const s of settings.sports.sports) {
      const count = s.seasonPhase === 'in' ? 1 : 2;
      requests.push({
        key: `sport:${s.sport}`,
        title: `${SPORT_LABELS[s.sport]} skill practice`,
        category: 'sport',
        idealMinutes: 30,
        minMinutes: 20,
        count,
        priority: rank('sports'),
        window: prefWindow(sched.preferredWorkoutTime, awake[dates[0]!]!, 'workout'),
        load: 1,
        avoidDates: dates.filter((d) => gameDates.has(d)),
        group: `sport:${s.sport}`,
        minGapDays: 0,
        explain: `Focused solo practice for ${s.position || 'your role'}${s.goal ? ` toward: ${s.goal}` : ''}. ${s.seasonPhase === 'in' ? 'Kept light because you are in season.' : ''}`.trim(),
        meta: { sport: s.sport },
      });
    }
  }

  /* ---- School ---- */
  if (modules.has('school')) {
    const window = prefWindow(sched.preferredStudyTime, awake[dates[0]!]!, 'study');
    const fromAssignments = studyRequests(ctx.assignments ?? [], { today: ctx.today, horizon: dates, window });
    requests.push(...fromAssignments);
    const target = settings.school?.dailyStudyMinutes ?? 0;
    if (target > 0) {
      const schoolDays = dates.filter((d) => !isWeekend(d));
      const assignmentMinutes = fromAssignments.reduce((s, r) => s + r.idealMinutes * r.count, 0);
      const remaining = Math.max(0, target * schoolDays.length - assignmentMinutes);
      const sessions = Math.min(schoolDays.length, Math.round(remaining / Math.max(20, target)));
      if (sessions > 0) {
        requests.push({ key: 'study:review', title: 'Review & practice', category: 'study', idealMinutes: Math.max(20, target), minMinutes: 20, count: sessions, eligibleDates: schoolDays, priority: rank('school') + 1, window, explain: 'Regular review — flashcards, practice problems, re-reading notes — keeps you ahead instead of catching up.' });
      }
    }
  }

  /* ---- Personal care ---- */
  for (const routine of [ctx.skin, ctx.hair]) {
    if (!routine) continue;
    if (routine.am.length) {
      for (const date of dates) {
        const a = awake[date]!;
        requests.push({ key: `care:${routine.kind}:am:${date}`, title: routine.kind === 'skin' ? 'Morning skincare' : 'Hair styling & grooming', category: 'care', idealMinutes: Math.max(5, routine.minutesAm), minMinutes: 3, count: 1, perDay: true, eligibleDates: [date], priority: 2, window: { start: a.start, end: a.start + 75 }, hardWindow: true, explain: routine.am.map((s) => s.category).join(' → ') });
      }
    }
    if (routine.pm.length) {
      for (const date of dates) {
        const a = awake[date]!;
        requests.push({ key: `care:${routine.kind}:pm:${date}`, title: routine.kind === 'skin' ? 'Evening skincare' : 'Night hair care', category: 'care', idealMinutes: Math.max(5, routine.minutesPm), minMinutes: 3, count: 1, perDay: true, eligibleDates: [date], priority: 2, window: { start: a.end - 90, end: a.end }, hardWindow: true, explain: routine.pm.map((s) => s.category).join(' → ') });
      }
    }
    if (routine.kind === 'hair' && settings.hair) {
      const days = washDays(settings.hair.washesPerWeek || 2);
      const washDates = dates.filter((d) => days.includes(weekdayOf(d)));
      for (const date of washDates) {
        requests.push({ key: `care:hair:wash:${date}`, title: 'Wash day', category: 'care', idealMinutes: settings.hair.texture === 'curly' || settings.hair.texture === 'coily' ? 45 : 20, minMinutes: 15, count: 1, perDay: true, eligibleDates: [date], priority: 3, window: { start: 18 * 60, end: awake[date]!.end - 30 }, explain: routine.weekly.map((s) => s.category).join(' → ') });
      }
    }
  }

  return {
    input: {
      dates,
      awake,
      fixed,
      requests,
      restDates,
      busyDates,
      dailyLoadCap: 3,
      transitionMinutes: 10,
      notBefore: ctx.notBefore,
    },
    notes,
  };
}
