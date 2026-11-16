import type { Commitment, FitnessPrefs, Goal, NutritionPrefs, SettingsBundle } from '../shared/schemas';

export const WEEK = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

export function settings(overrides: Partial<SettingsBundle> = {}): SettingsBundle {
  return {
    profile: {
      displayName: 'Test',
      birthday: '2009-05-01',
      timezone: 'America/New_York',
      units: 'imperial',
      clock: '12h',
      heightCm: null,
      weightKg: null,
      activityLevel: 'moderate',
      budget: 'moderate',
      accessibilityNotes: '',
      modules: ['fitness', 'school', 'nutrition'],
    },
    schedule: {
      lifeStage: 'student',
      wakeWeekday: '06:30',
      sleepWeekday: '22:30',
      wakeWeekend: '08:00',
      sleepWeekend: '23:00',
      preferredWorkoutTime: 'evening',
      preferredStudyTime: 'afternoon',
      restDays: [0],
      busyDays: [],
      commuteMinutes: 20,
    },
    ...overrides,
  };
}

export const fitness = (o: Partial<FitnessPrefs> = {}): FitnessPrefs => ({
  experience: 'some',
  sessionsPerWeek: 3,
  sessionMinutes: 45,
  locations: ['home'],
  equipment: [],
  accessNotes: '',
  limitations: [],
  limitationNotes: '',
  ...o,
});

export const nutrition = (o: Partial<NutritionPrefs> = {}): NutritionPrefs => ({
  diet: 'omnivore',
  allergies: [],
  avoid: [],
  kitchen: ['stove', 'oven', 'microwave'],
  cookingSkill: 'comfortable',
  weekdayCookMinutes: 40,
  householdSize: 1,
  mealPrepDay: null,
  schoolLunch: 'pack',
  ...o,
});

export const school = (id = 'school'): Commitment => ({
  id,
  kind: 'school',
  title: 'School',
  recurrence: { type: 'weekly', days: [1, 2, 3, 4, 5] },
  start: '08:00',
  end: '15:00',
  travelBefore: 20,
  travelAfter: 20,
  location: '',
  intensity: 0,
  exceptions: [],
});

export const goal = (module: Goal['module'], kind: string, priority: number): Goal => ({ id: `${module}-${kind}`, module, kind, title: kind, targetDate: null, priority });
