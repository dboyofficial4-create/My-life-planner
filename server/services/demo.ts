import type { Db } from '../db';
import { UserStore } from '../repos/store';
import { applyOnboarding } from './onboarding';
import { generateIfEmpty } from './planning';
import { addDays, startOfWeek, todayIn } from '../../shared/domain/time';

/**
 * Seeds a clearly-labelled demo account. Demo users are flagged is_demo,
 * cannot sign in with a password, and are deleted after 24 hours.
 * Demo data never mixes with real accounts.
 */
export function seedDemo(db: Db, userId: string, now: Date) {
  const store = new UserStore(db, userId);
  const tz = 'America/New_York';
  const today = todayIn(tz, now);
  const d = (n: number) => addDays(today, n);
  applyOnboarding(
    store,
    {
      profile: { displayName: 'Alex', birthday: '2009-03-14', timezone: tz, units: 'imperial', clock: '12h', heightCm: null, weightKg: null, activityLevel: 'high', budget: 'moderate', accessibilityNotes: '', modules: ['fitness', 'sports', 'school', 'nutrition', 'skincare', 'haircare'] },
      goals: [
        { module: 'sports', kind: 'sport_performance', title: 'Earn more minutes on varsity', targetDate: null, priority: 1 },
        { module: 'school', kind: 'improve_grades', title: 'Raise Chemistry to a B+', targetDate: null, priority: 2 },
        { module: 'fitness', kind: 'strength', title: 'Get stronger for the season', targetDate: null, priority: 3 },
        { module: 'nutrition', kind: 'fuel_training', title: 'Fuel practice properly', targetDate: null, priority: 4 },
        { module: 'skincare', kind: 'simple_skin_routine', title: 'Keep a simple skin routine', targetDate: null, priority: 5 },
      ],
      schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:30', sleepWeekend: '23:00', preferredWorkoutTime: 'evening', preferredStudyTime: 'evening', restDays: [0], busyDays: [3], commuteMinutes: 20 },
      schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' },
      workHours: { enabled: false, days: [], start: '09:00', end: '17:00' },
      commitments: [
        { kind: 'practice', title: 'Soccer practice', recurrence: { type: 'weekly', days: [1, 2, 4] }, start: '15:45', end: '17:45', travelBefore: 10, travelAfter: 15, location: 'School field', intensity: 2 },
        { kind: 'game', title: 'Soccer game', recurrence: { type: 'weekly', days: [6] }, start: '10:00', end: '12:00', travelBefore: 30, travelAfter: 30, location: 'Away', intensity: 3 },
        { kind: 'other', title: 'Tutoring (Chemistry)', recurrence: { type: 'weekly', days: [3] }, start: '16:00', end: '17:00', travelBefore: 0, travelAfter: 0, location: 'Library', intensity: 0 },
      ],
      fitness: { experience: 'some', sessionsPerWeek: 3, sessionMinutes: 45, locations: ['home', 'school_gym'], equipment: ['dumbbells', 'bench', 'resistance_bands', 'pullup_bar'], accessNotes: 'School gym open until 6pm', limitations: [], limitationNotes: '' },
      sports: { sports: [{ sport: 'soccer', position: 'Midfielder', level: 'school_team', seasonPhase: 'in', goal: 'Better first touch under pressure' }] },
      school: { stage: 'high_school', gradeLevel: '11', dailyStudyMinutes: 45, academicGoal: 'B+ or better in every class' },
      courses: [
        { name: 'Chemistry', difficulty: 4, targetGrade: 87 },
        { name: 'Algebra II', difficulty: 3, targetGrade: 90 },
        { name: 'English 11', difficulty: 2, targetGrade: 90 },
      ],
      assessments: [
        { title: 'Unit 4 test: stoichiometry', courseName: 'Chemistry', type: 'test', dueDate: d(4) },
        { title: 'Problem set 7', courseName: 'Algebra II', type: 'homework', dueDate: d(2) },
        { title: 'Gatsby analytical essay', courseName: 'English 11', type: 'essay', dueDate: d(9) },
      ],
      nutrition: { diet: 'omnivore', allergies: ['tree_nut'], avoid: [], kitchen: ['stove', 'oven', 'microwave'], cookingSkill: 'beginner', weekdayCookMinutes: 30, householdSize: 1, mealPrepDay: 0, schoolLunch: 'pack' },
      skin: { type: 'oily', concerns: ['acne', 'sun_protection'], fragranceSensitive: false, sensitivities: '', currentProducts: 'Bar soap', routineSize: 'standard' },
      hair: { texture: 'curly', scalp: 'normal', washesPerWeek: 2, heat: 'never', chemicallyTreated: false, concerns: ['frizz', 'definition'], facialHair: 'none', currentProducts: '' },
    },
    now,
  );
  // Grading rules for one course so the grade tools have something to show.
  const chem = store.courses().find((c) => c.name === 'Chemistry')!;
  const labs = store.createGradeCategory(chem.id, { name: 'Labs', weight: 30, confirmed: true })!;
  const tests = store.createGradeCategory(chem.id, { name: 'Tests', weight: 50, confirmed: true })!;
  const hw = store.createGradeCategory(chem.id, { name: 'Homework', weight: 20, confirmed: false })!;
  store.createGradeEntry({ courseId: chem.id, categoryId: labs, title: 'Lab 1', pointsEarned: 18, pointsPossible: 20 });
  store.createGradeEntry({ courseId: chem.id, categoryId: tests, title: 'Unit 3 test', pointsEarned: 74, pointsPossible: 100 });
  store.createGradeEntry({ courseId: chem.id, categoryId: hw, title: 'HW set 1–5', pointsEarned: 46, pointsPossible: 50 });
  store.createAssignment({ courseId: chem.id, title: 'Lab report: titration', type: 'project', dueDate: d(6), estimatedMinutes: 120, notes: '' });
  generateIfEmpty(store, startOfWeek(today), now);
}

export function purgeExpiredDemos(db: Db, maxAgeHours = 24) {
  const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
  return db.run('DELETE FROM users WHERE is_demo = 1 AND created_at < ?', cutoff).changes;
}
