import type { UserStore } from '../repos/store';
import { agePolicy, type AgePolicy } from '../../shared/domain/age';
import { generateProgram, type Program } from '../../shared/domain/fitness/generator';
import { hairRoutine, skinRoutine, type Routine } from '../../shared/domain/care/routines';
import { generateMealPlan } from '../../shared/domain/nutrition/mealplan';
import { addDays, nowMinuteIn, startOfWeek, todayIn, weekDates, weekdayOf, type LocalDate } from '../../shared/domain/time';
import type { AssignmentLike } from '../../shared/domain/school/study';
import type { SettingsBundle } from '../../shared/schemas';
import { expandCommitments } from '../../shared/domain/planner/build';
import { HttpError } from '../http';

export interface UserContext {
  settings: SettingsBundle;
  policy: AgePolicy;
  today: LocalDate;
  nowMinute: number;
  modules: Set<string>;
  program: Program | null;
  skin: Routine | null;
  hair: Routine | null;
}

export function requireSettings(store: UserStore): SettingsBundle {
  const s = store.getSettings();
  if (!s.profile || !s.schedule) throw new HttpError(409, 'onboarding_incomplete', 'Finish setting up your profile first.');
  return s as SettingsBundle;
}

export function loadContext(store: UserStore, now: Date): UserContext {
  const settings = requireSettings(store);
  const today = todayIn(settings.profile.timezone, now);
  const policy = agePolicy(settings.profile.birthday, today);
  const modules = new Set<string>(settings.profile.modules);
  const goals = store.listGoals();
  const program =
    modules.has('fitness') && settings.fitness ? generateProgram({ fitness: settings.fitness, sports: modules.has('sports') ? settings.sports : undefined, goals, policy }) : null;
  return {
    settings,
    policy,
    today,
    nowMinute: nowMinuteIn(settings.profile.timezone, now),
    modules,
    program,
    skin: modules.has('skincare') && settings.skin ? skinRoutine(settings.skin, policy) : null,
    hair: modules.has('haircare') && settings.hair ? hairRoutine(settings.hair) : null,
  };
}

export function weekOf(date: LocalDate) {
  const start = startOfWeek(date);
  return { start, end: addDays(start, 6), dates: weekDates(start) };
}

export function assignmentsForPlanning(store: UserStore): AssignmentLike[] {
  const courses = new Map(store.courses().map((c) => [c.id, c]));
  return store.assignments().map((a) => {
    const c = a.courseId ? courses.get(a.courseId) : undefined;
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate,
      estimatedMinutes: a.estimatedMinutes,
      completedMinutes: a.completedMinutes,
      status: a.status,
      courseName: c?.name ?? null,
      courseDifficulty: c?.difficulty ?? 3,
    };
  });
}

/** Create the week's meal plan on first use. Existing (possibly edited) entries are never overwritten here. */
export function ensureMealPlan(store: UserStore, ctx: UserContext, weekStart: LocalDate, force = false) {
  if (!ctx.modules.has('nutrition') || !ctx.settings.nutrition) return [];
  const { start, end, dates } = weekOf(weekStart);
  const existing = store.mealEntries(start, end);
  if (existing.length && !force) return existing;
  const schoolDates = expandCommitments(store.listCommitments(), dates)
    .filter((f) => (f.kind === 'school' || f.kind === 'work') && f.start <= 12 * 60 && f.end >= 13 * 60)
    .map((f) => f.date);
  const plan = generateMealPlan({
    dates,
    prefs: ctx.settings.nutrition,
    budget: ctx.settings.profile.budget,
    schoolDates,
    includeSnack: ctx.modules.has('sports') || ['high', 'very_high'].includes(ctx.settings.profile.activityLevel),
    policy: ctx.policy,
    seed: Math.floor(new Date(`${start}T00:00:00Z`).getTime() / 604_800_000) + (force ? Math.floor(Math.random() * 7) : 0),
  });
  store.replaceMealEntries(start, end, plan.entries);
  return store.mealEntries(start, end);
}

export const isWeekday = (d: LocalDate) => weekdayOf(d) !== 0 && weekdayOf(d) !== 6;
