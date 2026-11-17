import { describe, expect, it } from 'vitest';
import { addDays, ageOn, dayLengthMinutes, formatMinutes, hhmmToMin, startOfWeek, todayIn, zonedToInstant } from '../shared/domain/time';
import { agePolicy } from '../shared/domain/age';
import { generateProgram, hasEquipmentFor } from '../shared/domain/fitness/generator';
import { EXERCISES } from '../shared/domain/fitness/exercises';
import { convert, formatQuantity, cmToFeetInches, feetInchesToCm } from '../shared/domain/nutrition/units';
import { buildGroceryList } from '../shared/domain/nutrition/grocery';
import { generateMealPlan, recipeFit } from '../shared/domain/nutrition/mealplan';
import { INGREDIENTS, RECIPES, recipeById } from '../shared/domain/nutrition/recipes';
import { currentGrade, gradeNeeded } from '../shared/domain/school/grades';
import { parseIcs, guessAssignmentType } from '../shared/domain/school/ics';
import { studyRequests, splitIntoSteps } from '../shared/domain/school/study';
import { skinRoutine } from '../shared/domain/care/routines';
import { ScheduleSchema, CommitmentInput } from '../shared/schemas';
import { WEEK, fitness, goal, nutrition, settings } from './fixtures';
import type { MealEntry } from '../shared/domain/nutrition/mealplan';

describe('time & time zones', () => {
  it('parses and formats wall-clock times', () => {
    expect(hhmmToMin('07:30')).toBe(450);
    expect(formatMinutes(13 * 60 + 5)).toBe('1:05 PM');
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(() => hhmmToMin('25:00')).toThrow();
  });

  it('knows real day lengths across daylight-saving changes', () => {
    expect(dayLengthMinutes('2026-03-08', 'America/New_York')).toBe(1380);
    expect(dayLengthMinutes('2026-11-01', 'America/New_York')).toBe(1500);
    expect(dayLengthMinutes('2026-11-02', 'America/New_York')).toBe(1440);
    expect(dayLengthMinutes('2026-03-08', 'Asia/Tokyo')).toBe(1440);
  });

  it('shifts non-existent spring-forward times and resolves ambiguous fall-back times', () => {
    const gap = zonedToInstant('2026-03-08', 2 * 60 + 30, 'America/New_York');
    expect(gap.shifted).toBe(true);
    const fallback = zonedToInstant('2026-11-01', 60 + 30, 'America/New_York');
    expect(fallback.shifted).toBe(false);
    expect(fallback.instant.toISOString()).toBe('2026-11-01T05:30:00.000Z'); // first (EDT) occurrence
    const normal = zonedToInstant('2026-07-01', 9 * 60, 'Europe/London');
    expect(normal.instant.toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });

  it('computes "today" in the user time zone, not the server time zone', () => {
    const instant = new Date('2026-11-16T03:00:00Z');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-11-15');
    expect(todayIn('Asia/Tokyo', instant)).toBe('2026-11-16');
  });

  it('handles week and age arithmetic', () => {
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(ageOn('2008-11-17', '2026-11-16')).toBe(17);
    expect(ageOn('2008-11-16', '2026-11-16')).toBe(18);
  });
});

describe('age-dependent restrictions', () => {
  it('blocks self-registration under 13', () => {
    expect(agePolicy('2015-01-01', '2026-11-16').canSelfRegister).toBe(false);
  });
  it('disables deficits and weight-loss goals for teens', () => {
    const p = agePolicy('2010-01-01', '2026-11-16');
    expect(p.band).toBe('teen');
    expect(p.allowEnergyDeficit).toBe(false);
    expect(p.allowWeightLossGoal).toBe(false);
    expect(p.allowMaximalLoading).toBe(false);
  });
  it('applies protective defaults when birthday is missing', () => {
    expect(agePolicy(null, '2026-11-16').allowEnergyDeficit).toBe(false);
  });
  it('caps prescribed effort for teens', () => {
    const program = generateProgram({ fitness: fitness({ experience: 'experienced', equipment: ['barbell', 'squat_rack', 'bench', 'dumbbells'] }), goals: [goal('fitness', 'strength', 1)], policy: agePolicy('2010-01-01', '2026-11-16') });
    for (const w of program.workouts) for (const m of w.main) expect(m.effort).not.toMatch(/RPE \d+–9/);
    expect(program.workouts[0]!.main[0]!.reps).toBe('6–10');
  });
});

describe('fitness: equipment restrictions', () => {
  const adult = agePolicy('1995-01-01', '2026-11-16');
  const allUsed = (p: ReturnType<typeof generateProgram>) => p.workouts.flatMap((w) => w.main.map((m) => EXERCISES.find((e) => e.id === m.exerciseId)!));

  it('uses only bodyweight exercises when no equipment is available', () => {
    const p = generateProgram({ fitness: fitness({ equipment: [] }), goals: [goal('fitness', 'strength', 1)], policy: adult });
    for (const ex of allUsed(p)) expect(hasEquipmentFor(ex, new Set())).toBe(true);
    expect(p.notes.join(' ')).toMatch(/bodyweight/);
  });

  it('switches to loaded exercises when equipment is added', () => {
    const p = generateProgram({ fitness: fitness({ equipment: ['dumbbells', 'bench'] }), goals: [goal('fitness', 'strength', 1)], policy: adult });
    const ids = allUsed(p).map((e) => e.id);
    expect(ids).toContain('goblet_squat');
    expect(ids.some((i) => i === 'db_bench' || i === 'floor_press')).toBe(true);
  });

  it('never prescribes exercises needing equipment the user lacks', () => {
    const owned = new Set(['resistance_bands'] as const);
    const p = generateProgram({ fitness: fitness({ equipment: [...owned] }), goals: [], policy: adult });
    for (const ex of allUsed(p)) expect(hasEquipmentFor(ex, owned)).toBe(true);
  });

  it('skips exercises that load a disclosed limitation', () => {
    const p = generateProgram({ fitness: fitness({ limitations: ['knee'], equipment: ['dumbbells'] }), goals: [], policy: adult });
    for (const ex of allUsed(p)) expect(ex.stresses).not.toContain('knee');
  });

  it('caps gym sessions in season', () => {
    const p = generateProgram({ fitness: fitness({ sessionsPerWeek: 5 }), sports: { sports: [{ sport: 'soccer', position: 'Mid', level: 'school_team', seasonPhase: 'in', goal: '' }] }, goals: [goal('sports', 'sport_performance', 1)], policy: adult });
    expect(p.sessionsPerWeek).toBe(2);
    expect(p.notes.join(' ')).toMatch(/in season/);
  });
});

describe('units & groceries', () => {
  it('converts within a dimension and refuses cross-dimension conversions', () => {
    expect(convert(1, 'lb', 'g')).toBeCloseTo(453.592, 2);
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 5);
    expect(() => convert(1, 'cup', 'g')).toThrow();
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
    expect(feetInchesToCm(5, 11)).toBeCloseTo(180.3, 1);
  });

  it('formats quantities for the chosen unit system', () => {
    expect(formatQuantity(600, 'mass', 'metric').text).toBe('600 g');
    expect(formatQuantity(1200, 'mass', 'metric').text).toBe('1¼ kg');
    expect(formatQuantity(600, 'mass', 'imperial').text).toBe('1¼ lb');
    expect(formatQuantity(15, 'volume', 'imperial').text).toBe('1 tbsp');
  });

  it('every recipe uses units compatible with its ingredients', () => {
    for (const r of RECIPES) {
      expect(() => buildGroceryList([{ date: WEEK[0]!, slot: r.slots[0]!, recipeId: r.id, servings: r.servings, leftoverOf: null }], new Set(), 'metric')).not.toThrow();
      for (const i of r.ingredients) expect(INGREDIENTS[i.key], `${r.id}:${i.key}`).toBeDefined();
    }
  });

  it('combines quantities across recipes and updates when servings or meals change', () => {
    const entries: MealEntry[] = [
      { date: WEEK[0]!, slot: 'dinner', recipeId: 'chicken_rice_bowl', servings: 4, leftoverOf: null },
      { date: WEEK[1]!, slot: 'dinner', recipeId: 'bean_burrito_bowl', servings: 4, leftoverOf: null },
    ];
    const rice = (list: ReturnType<typeof buildGroceryList>) => list.find((l) => l.key === 'rice')!.baseQty;
    const before = buildGroceryList(entries, new Set(), 'metric');
    expect(rice(before)).toBe(600);
    const doubled = buildGroceryList([{ ...entries[0]!, servings: 8 }, entries[1]!], new Set(), 'metric');
    expect(rice(doubled)).toBe(900);
    const swapped = buildGroceryList([{ ...entries[0]!, recipeId: 'turkey_pasta' }, entries[1]!], new Set(), 'metric');
    expect(rice(swapped)).toBe(300);
    expect(swapped.find((l) => l.key === 'chicken_thigh')).toBeUndefined();
    expect(swapped.find((l) => l.key === 'pasta')).toBeDefined();
  });

  it('ignores leftovers and eat-out meals, and marks pantry items as owned', () => {
    const entries: MealEntry[] = [
      { date: WEEK[0]!, slot: 'dinner', recipeId: 'lentil_curry', servings: 2, leftoverOf: null },
      { date: WEEK[1]!, slot: 'lunch', recipeId: 'lentil_curry', servings: 1, leftoverOf: { date: WEEK[0]!, slot: 'dinner' } },
      { date: WEEK[1]!, slot: 'lunch', recipeId: null, servings: 1, leftoverOf: null, label: 'School lunch' },
    ];
    const list = buildGroceryList(entries, new Set(['rice']), 'metric');
    expect(list.find((l) => l.key === 'lentils_red')!.baseQty).toBe(125);
    expect(list.find((l) => l.key === 'rice')!.owned).toBe(true);
  });
});

describe('meal planning', () => {
  const policy = agePolicy('2009-01-01', '2026-11-16');
  it('respects allergies, diet and kitchen equipment', () => {
    const prefs = nutrition({ diet: 'vegetarian', allergies: ['peanut', 'milk'], kitchen: ['microwave'] });
    const plan = generateMealPlan({ dates: WEEK, prefs, budget: 'tight', schoolDates: [], includeSnack: true, policy, seed: 0 });
    for (const e of plan.entries) {
      if (!e.recipeId) continue;
      expect(recipeFit(recipeById(e.recipeId)!, prefs).ok).toBe(true);
    }
  });
  it('reuses dinner leftovers for the next day’s lunch', () => {
    const plan = generateMealPlan({ dates: WEEK, prefs: nutrition(), budget: 'moderate', schoolDates: [], includeSnack: false, policy, seed: 1 });
    expect(plan.entries.some((e) => e.leftoverOf)).toBe(true);
  });
  it('does not invent meals when nothing fits', () => {
    const prefs = nutrition({ diet: 'vegan', allergies: ['soy', 'wheat', 'peanut', 'sesame'], kitchen: ['no_kitchen'] });
    const plan = generateMealPlan({ dates: WEEK, prefs, budget: 'moderate', schoolDates: [], includeSnack: false, policy, seed: 0 });
    expect(plan.notes.join(' ')).toMatch(/No recipe in the current library/);
  });
  it('adds a fuelling note instead of a deficit for teens', () => {
    const plan = generateMealPlan({ dates: WEEK, prefs: nutrition(), budget: 'moderate', schoolDates: [], includeSnack: false, policy, seed: 0 });
    expect(plan.notes.join(' ')).toMatch(/not calorie restriction/);
  });
});

describe('school', () => {
  const cats = [
    { id: 'hw', name: 'Homework', weight: 40, confirmed: true },
    { id: 'ex', name: 'Exams', weight: 60, confirmed: true },
  ];
  it('computes a weighted current grade', () => {
    const g = currentGrade(cats, [{ categoryId: 'hw', pointsEarned: 90, pointsPossible: 100 }, { categoryId: 'ex', pointsEarned: 70, pointsPossible: 100 }]);
    expect(g.percent).toBe(78);
    expect(g.isEstimate).toBe(false);
  });
  it('labels results as estimates when rules are unconfirmed or incomplete', () => {
    const g = currentGrade([{ ...cats[0]!, confirmed: false }, cats[1]!], [{ categoryId: 'hw', pointsEarned: 90, pointsPossible: 100 }]);
    expect(g.isEstimate).toBe(true);
    expect(g.caveats.join(' ')).toMatch(/not confirmed/);
  });
  it('solves "what do I need on the final" exactly', () => {
    const entries = [{ categoryId: 'hw', pointsEarned: 90, pointsPossible: 100 }, { categoryId: 'ex', pointsEarned: 70, pointsPossible: 100 }];
    const r = gradeNeeded(cats, entries, [{ categoryId: 'ex', pointsPossible: 100 }], 80);
    // final = 0.4*90 + 0.6*((70 + 100x)/200)*100 = 80 → x = 0.7667
    expect(r).toMatchObject({ status: 'ok', requiredPercent: 76.7 });
    expect(gradeNeeded(cats, entries, [{ categoryId: 'ex', pointsPossible: 100 }], 99)).toMatchObject({ status: 'out_of_reach' });
    expect(gradeNeeded(cats, entries, [{ categoryId: 'ex', pointsPossible: 100 }], 50)).toMatchObject({ status: 'secured' });
  });
  it('spreads study before the due date and never on it', () => {
    const reqs = studyRequests(
      [{ id: 'a1', title: 'Bio test', type: 'test', dueDate: WEEK[4]!, estimatedMinutes: 160, completedMinutes: 0, status: 'open', courseName: 'Biology', courseDifficulty: 4 }],
      { today: WEEK[0]!, horizon: WEEK, window: { start: 900, end: 1080 } },
    );
    expect(reqs[0]!.latestDate).toBe(WEEK[3]);
    expect(reqs[0]!.count).toBe(4);
    expect(reqs[0]!.priority).toBeLessThanOrEqual(2);
  });
  it('breaks essays into steps', () => {
    expect(splitIntoSteps({ type: 'essay', estimatedMinutes: 240 }).length).toBe(5);
  });
  it('imports assignments from an .ics file without credentials', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:abc', 'SUMMARY:Unit 3 Quiz [Algebra II]', 'DTSTART:20261119T045900Z', 'END:VEVENT', 'BEGIN:VEVENT', 'SUMMARY:Essay draft', 'DTSTART;VALUE=DATE:20261120', 'DESCRIPTION:Line one\\nline', ' two', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const r = parseIcs(ics, 'America/New_York');
    expect(r.events).toHaveLength(2);
    expect(r.events[0]).toMatchObject({ summary: 'Unit 3 Quiz', course: 'Algebra II', date: '2026-11-18' });
    expect(r.events[1]!.description).toContain('linetwo');
    expect(guessAssignmentType('Unit 3 Quiz')).toBe('quiz');
    expect(() => parseIcs('hello', 'UTC')).toThrow();
  });
});

describe('validation', () => {
  it('rejects schedules with unrealistic sleep', () => {
    const s = settings().schedule;
    expect(ScheduleSchema.safeParse({ ...s, sleepWeekday: '01:00', wakeWeekday: '04:00' }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ ...s, sleepWeekday: '00:30' }).success).toBe(true);
  });
  it('rejects commitments that end before they start', () => {
    const r = CommitmentInput.safeParse({ kind: 'other', title: 'x', recurrence: { type: 'weekly', days: [1] }, start: '10:00', end: '09:00', travelBefore: 0, travelAfter: 0, location: '', intensity: 0 });
    expect(r.success).toBe(false);
  });
});

describe('personal care', () => {
  it('introduces actives gradually and never as week one', () => {
    const r = skinRoutine({ type: 'oily', concerns: ['acne'], fragranceSensitive: false, sensitivities: '', currentProducts: '', routineSize: 'standard' }, agePolicy('2009-01-01', '2026-11-16'));
    const active = r.pm.find((s) => /Acne/.test(s.category))!;
    expect(active.startWeek).toBeGreaterThan(1);
    expect(r.am.some((s) => /sunscreen/i.test(s.category))).toBe(true);
    expect(r.seeAClinicianIf.length).toBeGreaterThan(0);
  });
});

describe('schedule notes (not work)', () => {
  it('recognises A/B days and days off', async () => {
    const { isScheduleNote } = await import('../shared/domain/school/ics');
    for (const t of ['A Day', 'B Day', 'b-day', 'Day A', 'A DAY', 'B Day Schedule', 'A Day (late start)', 'A Day [Biology]', 'Today is a B day', 'No School', 'NO SCHOOL', 'No School - Thanksgiving Break', 'No School: Teacher Workday', 'No Classes', 'School Closed', 'Student Holiday', 'Students not in session']) {
      expect(isScheduleNote(t), t).toBe(true);
    }
  });
  it('keeps real work, even when it mentions a day', async () => {
    const { isScheduleNote } = await import('../shared/domain/school/ics');
    for (const t of ['B Day quiz', 'A day at the museum essay', 'Unit 3 test', 'No school — finish essay draft', 'No School: reading packet due', 'Day A homework', 'Holiday card project', 'Schooling reflection', '']) {
      expect(isScheduleNote(t), t).toBe(false);
    }
  });
});
