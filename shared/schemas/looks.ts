/**
 * Skin product finder and build planner: what the student sends and what comes back.
 * Photos are optional: face photos from 14 (AgePolicy.allowFacePhotos), body photos for adults only
 * (AgePolicy.allowAppearancePhotos);
 * everyone can use the short questions instead. Photos are never stored.
 */
import { z } from 'zod';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** After the browser shrinks a photo it is well under this. */
export const MAX_PHOTO_BASE64 = 4_000_000;

export const PhotoInput = z.object({
  mediaType: z.enum(PHOTO_TYPES),
  data: z.string().min(100).max(MAX_PHOTO_BASE64),
});
export type PhotoInput = z.infer<typeof PhotoInput>;

/* ---------- skin ---------- */

export const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive', 'not_sure'] as const;
export const SKIN_CONCERNS = ['breakouts', 'blackheads', 'dryness', 'oiliness', 'redness', 'dark_spots', 'sensitivity', 'dullness', 'sun_protection'] as const;
export const SKIN_CONCERN_LABELS: Record<(typeof SKIN_CONCERNS)[number], string> = {
  breakouts: 'Breakouts',
  blackheads: 'Blackheads',
  dryness: 'Dry or flaky patches',
  oiliness: 'Shine by midday',
  redness: 'Redness',
  dark_spots: 'Dark spots or marks',
  sensitivity: 'Stinging or reactions',
  dullness: 'Dull or uneven',
  sun_protection: 'Sun protection',
};

export const SkinAdviceInput = z.object({
  photos: z.array(PhotoInput).max(3),
  skinType: z.enum(SKIN_TYPES),
  concerns: z.array(z.enum(SKIN_CONCERNS)).max(SKIN_CONCERNS.length),
  currentProducts: z.string().trim().max(500),
  budget: z.enum(['low', 'medium', 'high']),
  notes: z.string().trim().max(500),
  consent: z.literal(true, { error: 'Please confirm the details can be sent to the AI service' }),
  /** Required when photos are sent: they follow the photo rules in the Terms. */
  photoRules: z.boolean().default(false),
});
export type SkinAdviceInput = z.infer<typeof SkinAdviceInput>;

const RoutineStep = z.object({
  step: z.string(),
  productType: z.string(),
  lookFor: z.array(z.string()),
  avoid: z.array(z.string()),
  why: z.string(),
  examples: z.array(z.string()),
});

export const SkinAdviceSchema = z.object({
  /** False when the photos can't be used (blurry, not a face, not appropriate); the reason says why. */
  usable: z.boolean(),
  usableReason: z.string(),
  summary: z.string(),
  observations: z.array(z.object({ area: z.string(), note: z.string() })),
  morning: z.array(RoutineStep),
  evening: z.array(RoutineStep),
  weekly: z.array(z.string()),
  habits: z.array(z.string()),
  seeADoctorIf: z.array(z.string()),
});
export type SkinAdvice = z.infer<typeof SkinAdviceSchema>;

/* ---------- build ---------- */

export const BUILD_GOALS = ['more_muscle_overall', 'upper_body', 'stronger_legs', 'athletic_lean', 'sport_power', 'endurance_build', 'posture'] as const;
export const BUILD_GOAL_LABELS: Record<(typeof BUILD_GOALS)[number], string> = {
  more_muscle_overall: 'More muscle overall',
  upper_body: 'Bigger, stronger upper body',
  stronger_legs: 'Stronger legs and glutes',
  athletic_lean: 'Lean and athletic',
  sport_power: 'Faster and more powerful for my sport',
  endurance_build: 'Runner or endurance build',
  posture: 'Better posture and core',
};

export const BuildPlanInput = z.object({
  currentPhoto: PhotoInput.nullable(),
  goalPhoto: PhotoInput.nullable(),
  goals: z.array(z.enum(BUILD_GOALS)).max(BUILD_GOALS.length),
  /** One of BUILD_ARCHETYPES (shared/domain/fitness/builds.ts). */
  archetype: z.string().max(40).nullable().default(null),
  description: z.string().trim().max(600),
  consent: z.literal(true, { error: 'Please confirm the details can be sent to the AI service' }),
  photoRules: z.boolean().default(false),
});
export type BuildPlanInput = z.infer<typeof BuildPlanInput>;

export const BuildPlanSchema = z.object({
  usable: z.boolean(),
  usableReason: z.string(),
  summary: z.string(),
  /** Training-relevant differences between now and the goal, by body area. */
  focusAreas: z.array(z.object({ area: z.string(), now: z.string(), goal: z.string(), focus: z.string() })),
  realistic: z.string(),
  timeline: z.string(),
  days: z.array(
    z.object({
      day: z.string(),
      focus: z.string(),
      exercises: z.array(z.object({ name: z.string(), sets: z.string(), reps: z.string(), notes: z.string() })),
    }),
  ),
  progression: z.array(z.string()),
  nutrition: z.array(z.string()),
  recovery: z.array(z.string()),
  safety: z.array(z.string()),
});
export type BuildPlan = z.infer<typeof BuildPlanSchema>;

export interface LookReport<T> {
  id: string;
  kind: 'skin' | 'build';
  usedPhotos: boolean;
  result: T;
  createdAt: number;
}
