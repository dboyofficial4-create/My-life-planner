import { z } from 'zod';
import { isLocalDate, isValidTimeZone, hhmmToMin } from '../domain/time';

export { isLocalDate };

/* ---------- primitives ---------- */

export const localDate = z.string().refine(isLocalDate, 'Enter a valid date');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
export const weekday = z.number().int().min(0).max(6);
export const timeZone = z.string().refine(isValidTimeZone, 'Unknown time zone');
export const id = z.string().min(1).max(64);

export const MODULES = ['fitness', 'sports', 'school', 'nutrition', 'skincare', 'haircare', 'style'] as const;
export const ModuleId = z.enum(MODULES);
export type ModuleId = z.infer<typeof ModuleId>;
/** Modules that are functional in this release. Others are shown as "planned", never as working. */
export const AVAILABLE_MODULES: readonly ModuleId[] = ['fitness', 'sports', 'school', 'nutrition', 'skincare', 'haircare'];

export const TimePref = z.enum(['morning', 'afternoon', 'evening', 'any']);
export type TimePref = z.infer<typeof TimePref>;

/* ---------- profile ---------- */

export const ProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Add a name').max(60),
  birthday: localDate.nullable(),
  timezone: timeZone,
  units: z.enum(['metric', 'imperial']),
  clock: z.enum(['12h', '24h']),
  heightCm: z.number().min(90).max(250).nullable(),
  weightKg: z.number().min(25).max(300).nullable(),
  activityLevel: z.enum(['low', 'moderate', 'high', 'very_high']),
  budget: z.enum(['tight', 'moderate', 'flexible']),
  accessibilityNotes: z.string().max(500),
  modules: z.array(ModuleId).min(1, 'Choose at least one area'),
});
export type Profile = z.infer<typeof ProfileSchema>;

/* ---------- goals ---------- */

export const GOAL_KINDS = {
  fitness: ['general_fitness', 'strength', 'muscle', 'endurance', 'mobility', 'body_composition'],
  sports: ['sport_performance'],
  school: ['improve_grades', 'study_consistency', 'test_prep'],
  nutrition: ['eat_consistently', 'fuel_training', 'budget_cooking', 'body_composition'],
  skincare: ['simple_skin_routine', 'skin_concerns'],
  haircare: ['healthier_hair', 'low_maintenance_hair'],
  style: ['better_outfits'],
} as const satisfies Record<ModuleId, readonly string[]>;

export const GOAL_LABELS: Record<string, string> = {
  general_fitness: 'Get generally fitter',
  strength: 'Build strength',
  muscle: 'Build muscle',
  endurance: 'Improve endurance',
  mobility: 'Move better (mobility)',
  body_composition: 'Change body composition',
  sport_performance: 'Perform better in my sport',
  improve_grades: 'Raise my grades',
  study_consistency: 'Study more consistently',
  test_prep: 'Prepare for a big test',
  eat_consistently: 'Eat regular, balanced meals',
  fuel_training: 'Fuel training and recovery',
  budget_cooking: 'Cook more on a budget',
  simple_skin_routine: 'Build a simple skin routine',
  skin_concerns: 'Work on a specific skin concern',
  healthier_hair: 'Healthier hair and scalp',
  low_maintenance_hair: 'A low-maintenance hair routine',
  better_outfits: 'Dress better day to day',
};

export const GoalSchema = z.object({
  id,
  module: ModuleId,
  kind: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  targetDate: localDate.nullable(),
  /** 1 = most important */
  priority: z.number().int().min(1).max(20),
});
export type Goal = z.infer<typeof GoalSchema>;

/* ---------- schedule ---------- */

export const ScheduleSchema = z
  .object({
    lifeStage: z.enum(['student', 'working', 'both', 'neither']),
    wakeWeekday: hhmm,
    sleepWeekday: hhmm,
    wakeWeekend: hhmm,
    sleepWeekend: hhmm,
    preferredWorkoutTime: TimePref,
    preferredStudyTime: TimePref,
    restDays: z.array(weekday).max(7),
    busyDays: z.array(weekday).max(7),
    commuteMinutes: z.number().int().min(0).max(180),
  })
  .superRefine((s, ctx) => {
    for (const [w, sl, label] of [
      [s.wakeWeekday, s.sleepWeekday, 'Weekday'],
      [s.wakeWeekend, s.sleepWeekend, 'Weekend'],
    ] as const) {
      const wake = hhmmToMin(w);
      let sleep = hhmmToMin(sl);
      if (sleep <= wake) sleep += 1440; // bedtime after midnight
      const awake = sleep - wake;
      if (awake < 8 * 60) ctx.addIssue({ code: 'custom', path: [label === 'Weekday' ? 'sleepWeekday' : 'sleepWeekend'], message: `${label}: that leaves less than 8 waking hours` });
      if (awake > 20 * 60) ctx.addIssue({ code: 'custom', path: [label === 'Weekday' ? 'sleepWeekday' : 'sleepWeekend'], message: `${label}: that leaves under 4 hours of sleep` });
    }
  });
export type Schedule = z.infer<typeof ScheduleSchema>;

/* ---------- commitments (fixed blocks) ---------- */

export const COMMITMENT_KINDS = ['school', 'work', 'class', 'practice', 'game', 'appointment', 'other'] as const;
export const CommitmentKind = z.enum(COMMITMENT_KINDS);
export type CommitmentKind = z.infer<typeof CommitmentKind>;

export const RecurrenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weekly'), days: z.array(weekday).min(1, 'Pick at least one day') }),
  z.object({ type: z.literal('once'), date: localDate }),
]);

export const CommitmentInput = z
  .object({
    kind: CommitmentKind,
    title: z.string().trim().min(1, 'Add a title').max(80),
    recurrence: RecurrenceSchema,
    start: hhmm,
    end: hhmm,
    travelBefore: z.number().int().min(0).max(180),
    travelAfter: z.number().int().min(0).max(180),
    location: z.string().max(80),
    /** Training load contribution for sport sessions: 0 none, 1 light, 2 moderate, 3 hard. */
    intensity: z.number().int().min(0).max(3),
  })
  .refine((c) => hhmmToMin(c.end) > hhmmToMin(c.start), { path: ['end'], message: 'End must be after start' });
export type CommitmentInput = z.infer<typeof CommitmentInput>;
export type Commitment = CommitmentInput & { id: string; exceptions: string[] /* cancelled dates */ };

/* ---------- equipment & fitness ---------- */

export const EQUIPMENT = [
  'dumbbells', 'barbell', 'squat_rack', 'bench', 'pullup_bar', 'resistance_bands', 'kettlebell',
  'cable_machine', 'leg_press', 'cardio_machine', 'jump_rope', 'box_or_step', 'track_or_field',
] as const;
export const EquipmentId = z.enum(EQUIPMENT);
export type EquipmentId = z.infer<typeof EquipmentId>;
export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  dumbbells: 'Dumbbells', barbell: 'Barbell & plates', squat_rack: 'Squat rack', bench: 'Bench',
  pullup_bar: 'Pull-up bar', resistance_bands: 'Resistance bands', kettlebell: 'Kettlebell',
  cable_machine: 'Cable machine', leg_press: 'Leg press', cardio_machine: 'Treadmill / bike / rower',
  jump_rope: 'Jump rope', box_or_step: 'Sturdy box or step', track_or_field: 'Track or open field',
};
export const LOCATIONS = ['home', 'gym', 'school_gym', 'outdoors'] as const;

export const LIMITATIONS = ['knee', 'shoulder', 'lower_back', 'wrist', 'ankle'] as const;
export const Limitation = z.enum(LIMITATIONS);
export type Limitation = z.infer<typeof Limitation>;

export const FitnessSchema = z.object({
  experience: z.enum(['new', 'some', 'experienced']),
  sessionsPerWeek: z.number().int().min(1).max(6),
  sessionMinutes: z.number().int().min(15).max(120),
  locations: z.array(z.enum(LOCATIONS)),
  equipment: z.array(EquipmentId),
  accessNotes: z.string().max(300),
  limitations: z.array(Limitation),
  limitationNotes: z.string().max(300),
});
export type FitnessPrefs = z.infer<typeof FitnessSchema>;

export const SPORTS = ['basketball', 'soccer', 'american_football', 'baseball_softball', 'volleyball', 'track_running', 'swimming', 'tennis', 'other'] as const;
export const SportsSchema = z.object({
  sports: z
    .array(
      z.object({
        sport: z.enum(SPORTS),
        position: z.string().max(40),
        level: z.enum(['recreational', 'school_team', 'club', 'competitive']),
        seasonPhase: z.enum(['off', 'pre', 'in', 'post']),
        goal: z.string().max(140),
        /** Team situation. Anything other than on_team means the plan supplies the skill volume practice normally would. */
        teamStatus: z.enum(['on_team', 'cut', 'tryout_prep', 'no_team']).default('on_team'),
        tryoutDate: localDate.nullable().default(null),
        /** Focus skill ids from the sports catalog. */
        skills: z.array(z.string().max(40)).max(5).default([]),
        /** What a coach said to work on. */
        coachFeedback: z.string().max(500).default(''),
      }),
    )
    .max(3),
});
export type SportsPrefs = z.infer<typeof SportsSchema>;

/* ---------- school ---------- */

export const SchoolSchema = z.object({
  stage: z.enum(['middle_school', 'high_school', 'college', 'graduate', 'other']),
  gradeLevel: z.string().max(20),
  dailyStudyMinutes: z.number().int().min(0).max(360),
  academicGoal: z.string().max(200),
});
export type SchoolPrefs = z.infer<typeof SchoolSchema>;

export const CourseInput = z.object({
  name: z.string().trim().min(1, 'Add a course name').max(80),
  difficulty: z.number().int().min(1).max(5),
  targetGrade: z.number().min(0).max(100).nullable(),
});
export type CourseInput = z.infer<typeof CourseInput>;

export const ASSIGNMENT_TYPES = ['homework', 'project', 'essay', 'quiz', 'test', 'exam', 'reading', 'other'] as const;
export const AssignmentInput = z.object({
  courseId: id.nullable(),
  title: z.string().trim().min(1, 'Add a title').max(140),
  type: z.enum(ASSIGNMENT_TYPES),
  dueDate: localDate,
  estimatedMinutes: z.number().int().min(10).max(1200),
  notes: z.string().max(500),
});
export type AssignmentInput = z.infer<typeof AssignmentInput>;

export const GradeCategoryInput = z.object({
  courseId: id,
  name: z.string().trim().min(1).max(60),
  weight: z.number().min(0).max(100),
  /** Has the user confirmed this weight from a syllabus / teacher? */
  confirmed: z.boolean(),
});
export const GradeEntryInput = z.object({
  courseId: id,
  categoryId: id,
  title: z.string().trim().min(1).max(100),
  pointsEarned: z.number().min(0).nullable(),
  pointsPossible: z.number().positive(),
});

/* ---------- nutrition ---------- */

export const ALLERGENS = ['milk', 'egg', 'peanut', 'tree_nut', 'soy', 'wheat', 'fish', 'shellfish', 'sesame'] as const;
export const Allergen = z.enum(ALLERGENS);
export type Allergen = z.infer<typeof Allergen>;
export const AVOIDABLES = ['pork', 'beef', 'alcohol', 'gelatin'] as const;

export const NutritionSchema = z.object({
  diet: z.enum(['omnivore', 'pescatarian', 'vegetarian', 'vegan']),
  allergies: z.array(Allergen),
  avoid: z.array(z.enum(AVOIDABLES)),
  kitchen: z.array(z.enum(['stove', 'oven', 'microwave', 'blender', 'no_kitchen'])),
  cookingSkill: z.enum(['beginner', 'comfortable', 'confident']),
  weekdayCookMinutes: z.number().int().min(0).max(120),
  householdSize: z.number().int().min(1).max(10),
  mealPrepDay: weekday.nullable(),
  schoolLunch: z.enum(['pack', 'buy', 'not_applicable']),
});
export type NutritionPrefs = z.infer<typeof NutritionSchema>;

/* ---------- personal care ---------- */

export const SkinSchema = z.object({
  type: z.enum(['oily', 'dry', 'combination', 'normal', 'not_sure']),
  concerns: z.array(z.enum(['acne', 'dryness', 'oiliness', 'sensitivity', 'uneven_tone', 'sun_protection'])),
  fragranceSensitive: z.boolean(),
  sensitivities: z.string().max(300),
  currentProducts: z.string().max(500),
  routineSize: z.enum(['minimal', 'standard']),
});
export type SkinPrefs = z.infer<typeof SkinSchema>;

export const HairSchema = z.object({
  texture: z.enum(['straight', 'wavy', 'curly', 'coily', 'not_sure']),
  scalp: z.enum(['normal', 'oily', 'dry', 'flaky_or_itchy']),
  washesPerWeek: z.number().int().min(0).max(7),
  heat: z.enum(['never', 'sometimes', 'often']),
  chemicallyTreated: z.boolean(),
  concerns: z.array(z.enum(['frizz', 'dryness', 'breakage', 'oily_scalp', 'definition', 'tangles'])),
  facialHair: z.enum(['none', 'shave', 'beard', 'not_applicable']),
  currentProducts: z.string().max(500),
});
export type HairPrefs = z.infer<typeof HairSchema>;

/* ---------- settings bundle ---------- */

export const SETTINGS_SCHEMAS = {
  profile: ProfileSchema,
  schedule: ScheduleSchema,
  fitness: FitnessSchema,
  sports: SportsSchema,
  school: SchoolSchema,
  nutrition: NutritionSchema,
  skin: SkinSchema,
  hair: HairSchema,
} as const;
export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export interface SettingsBundle {
  profile: Profile;
  schedule: Schedule;
  fitness?: FitnessPrefs;
  sports?: SportsPrefs;
  school?: SchoolPrefs;
  nutrition?: NutritionPrefs;
  skin?: SkinPrefs;
  hair?: HairPrefs;
}

/* ---------- auth ---------- */

export const RegisterInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
  birthday: localDate,
});
export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

/* ---------- plan items ---------- */

export const PLAN_CATEGORIES = ['commitment', 'workout', 'sport', 'study', 'meal', 'meal_prep', 'care', 'recovery', 'task'] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];
export const ITEM_STATUSES = ['planned', 'done', 'skipped', 'missed'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ItemUpdateInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('complete'), effort: z.number().int().min(1).max(10).optional(), discomfort: z.number().int().min(0).max(10).optional(), note: z.string().max(300).optional() }),
  z.object({ action: z.literal('skip'), reason: z.string().max(200).optional() }),
  z.object({ action: z.literal('reopen') }),
  z.object({ action: z.literal('lock'), locked: z.boolean() }),
  z.object({ action: z.literal('move'), date: localDate, start: hhmm }),
  z.object({ action: z.literal('shorten'), minutes: z.number().int().min(5).max(240) }),
]);
export type ItemUpdateInput = z.infer<typeof ItemUpdateInput>;

export const ProgressLogInput = z.object({
  date: localDate,
  metric: z.enum(['energy', 'sleep_quality', 'mood', 'stamina', 'strength_note', 'body_weight']),
  value: z.number().min(0).max(1000),
  note: z.string().max(300),
});
