import { z } from 'zod';
import {
  ASSIGNMENT_TYPES, CommitmentInput, CourseInput, FitnessSchema, GoalSchema, HairSchema, NutritionSchema, ProfileSchema,
  ScheduleSchema, SchoolSchema, SkinSchema, SportsSchema, hhmm, localDate, weekday,
} from './index';

export const ONBOARDING_STEPS = ['welcome', 'about', 'goals', 'schedule', 'commitments', 'fitness', 'sports', 'school', 'food', 'care', 'review'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const HoursBlock = z
  .object({ enabled: z.boolean(), days: z.array(weekday), start: hhmm, end: hhmm })
  .refine((b) => !b.enabled || b.days.length > 0, { path: ['days'], message: 'Pick at least one day' })
  .refine((b) => !b.enabled || b.end > b.start, { path: ['end'], message: 'End must be after start' });

export const AssessmentInput = z.object({
  title: z.string().trim().min(1, 'Add a title').max(140),
  courseName: z.string().max(80),
  type: z.enum(ASSIGNMENT_TYPES),
  dueDate: localDate,
});

export const OnboardingComplete = z.object({
  profile: ProfileSchema,
  goals: z.array(GoalSchema.omit({ id: true })).max(12),
  schedule: ScheduleSchema,
  schoolHours: HoursBlock,
  workHours: HoursBlock,
  commitments: z.array(CommitmentInput).max(40),
  fitness: FitnessSchema.optional(),
  sports: SportsSchema.optional(),
  school: SchoolSchema.optional(),
  courses: z.array(CourseInput).max(15).optional(),
  assessments: z.array(AssessmentInput).max(30).optional(),
  nutrition: NutritionSchema.optional(),
  skin: SkinSchema.optional(),
  hair: HairSchema.optional(),
});
export type OnboardingComplete = z.infer<typeof OnboardingComplete>;

export const OnboardingSave = z.object({
  step: z.enum(ONBOARDING_STEPS),
  draft: z.record(z.string(), z.unknown()),
});

export const DEFAULT_MINUTES: Record<(typeof ASSIGNMENT_TYPES)[number], number> = {
  homework: 45, reading: 40, quiz: 90, test: 180, exam: 300, essay: 240, project: 300, other: 60,
};
