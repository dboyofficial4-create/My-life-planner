import type { UserStore } from '../repos/store';
import { DEFAULT_MINUTES, type OnboardingComplete } from '../../shared/schemas/onboarding';
import { agePolicy } from '../../shared/domain/age';
import { todayIn } from '../../shared/domain/time';
import { HttpError } from '../http';

/**
 * Persist a completed onboarding. Only data for the modules the user chose is
 * stored (data minimisation): sections for unselected modules are discarded.
 */
export function applyOnboarding(store: UserStore, data: OnboardingComplete, now: Date) {
  const modules = new Set(data.profile.modules);
  const today = todayIn(data.profile.timezone, now);
  const policy = agePolicy(data.profile.birthday, today);
  if (data.profile.birthday && !policy.canSelfRegister) {
    throw new HttpError(403, 'age_restricted', 'Waypoint isn’t available for people under 13 yet.');
  }
  const disallowed = data.goals.filter((g) => g.kind === 'body_composition' && !policy.allowWeightLossGoal);
  if (disallowed.length) {
    throw new HttpError(422, 'validation', 'Body-composition goals aren’t available for your age. Try strength, fitness or sport goals instead.', { fields: { goals: 'Not available for your age' } });
  }

  store.tx(() => {
    store.setSetting('profile', data.profile);
    store.setSetting('schedule', data.schedule);
    store.replaceGoals(data.goals.filter((g) => modules.has(g.module)));

    for (const c of store.listCommitments()) store.deleteCommitment(c.id);
    const commute = data.schedule.commuteMinutes;
    if (data.schoolHours.enabled && (data.schedule.lifeStage === 'student' || data.schedule.lifeStage === 'both')) {
      store.createCommitment({ kind: 'school', title: 'School', recurrence: { type: 'weekly', days: data.schoolHours.days }, start: data.schoolHours.start, end: data.schoolHours.end, travelBefore: commute, travelAfter: commute, location: '', intensity: 0 });
    }
    if (data.workHours.enabled && (data.schedule.lifeStage === 'working' || data.schedule.lifeStage === 'both')) {
      store.createCommitment({ kind: 'work', title: 'Work', recurrence: { type: 'weekly', days: data.workHours.days }, start: data.workHours.start, end: data.workHours.end, travelBefore: commute, travelAfter: commute, location: '', intensity: 0 });
    }
    for (const c of data.commitments) store.createCommitment(c);

    const optional = [
      ['fitness', modules.has('fitness') || modules.has('sports') ? data.fitness : undefined],
      ['sports', modules.has('sports') ? data.sports : undefined],
      ['school', modules.has('school') ? data.school : undefined],
      ['nutrition', modules.has('nutrition') ? data.nutrition : undefined],
      ['skin', modules.has('skincare') ? data.skin : undefined],
      ['hair', modules.has('haircare') ? data.hair : undefined],
    ] as const;
    for (const [key, value] of optional) {
      if (value) store.setSetting(key, value);
      else store.deleteSetting(key);
    }

    if (modules.has('school')) {
      const existing = new Map(store.courses().map((c) => [c.name.toLowerCase(), c.id]));
      for (const course of data.courses ?? []) {
        if (!existing.has(course.name.toLowerCase())) existing.set(course.name.toLowerCase(), store.createCourse(course));
      }
      for (const a of data.assessments ?? []) {
        store.createAssignment({
          courseId: existing.get(a.courseName.toLowerCase()) ?? null,
          title: a.title,
          type: a.type,
          dueDate: a.dueDate,
          estimatedMinutes: DEFAULT_MINUTES[a.type],
          notes: '',
        });
      }
    }
    store.completeOnboarding();
  });
}
