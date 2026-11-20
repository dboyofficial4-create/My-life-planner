import { ageOn, type LocalDate } from './time';

/**
 * Age-dependent product policy. Centralised so every module applies the same
 * rules. These are conservative product defaults, not legal advice — see
 * docs/PRIVACY_AND_SAFETY.md for what still needs legal review.
 */
export type AgeBand = 'under13' | 'teen' | 'adult';

export interface AgePolicy {
  band: AgeBand;
  age: number | null;
  /** Account creation allowed without a guardian flow (not yet implemented). */
  canSelfRegister: boolean;
  /** Calorie-deficit / weight-loss targets may be generated. */
  allowEnergyDeficit: boolean;
  /** Weight-change goals can be set at all. */
  allowWeightLossGoal: boolean;
  /** Maximal-effort testing (1RM) and very heavy loading. */
  allowMaximalLoading: boolean;
  /** Highest RPE the generator will prescribe. */
  maxRpe: number;
  /** Face photos for the skin product finder (14+; face and shoulders only). */
  allowFacePhotos: boolean;
  /** Body photos for the build planner (adults only). */
  allowAppearancePhotos: boolean;
  notes: string[];
}

export const MIN_SELF_REGISTER_AGE = 13;
/** Face photos (skin product finder) from this age; body photos stay 18+. */
export const MIN_FACE_PHOTO_AGE = 14;

export function agePolicy(birthday: LocalDate | null | undefined, today: LocalDate): AgePolicy {
  if (!birthday) {
    // Unknown age: apply the most protective non-blocking defaults.
    return {
      band: 'teen',
      age: null,
      canSelfRegister: true,
      allowEnergyDeficit: false,
      allowWeightLossGoal: false,
      allowMaximalLoading: false,
      maxRpe: 8,
      allowFacePhotos: false,
      allowAppearancePhotos: false,
      notes: ['Add your birthday in Settings to unlock age-appropriate options.'],
    };
  }
  const age = ageOn(birthday, today);
  if (age < MIN_SELF_REGISTER_AGE) {
    return {
      band: 'under13',
      age,
      canSelfRegister: false,
      allowEnergyDeficit: false,
      allowWeightLossGoal: false,
      allowMaximalLoading: false,
      maxRpe: 6,
      allowFacePhotos: false,
      allowAppearancePhotos: false,
      notes: ['Accounts for people under 13 need a parent or guardian, which Waypoint does not support yet.'],
    };
  }
  if (age < 18) {
    return {
      band: 'teen',
      age,
      canSelfRegister: true,
      allowEnergyDeficit: false,
      allowWeightLossGoal: false,
      allowMaximalLoading: false,
      maxRpe: 8,
      allowFacePhotos: age >= MIN_FACE_PHOTO_AGE,
      allowAppearancePhotos: false,
      notes: [
        'Plans focus on fuelling growth, sport and energy rather than calorie deficits.',
        'Training emphasises technique and gradual progress; no max-effort lift testing.',
      ],
    };
  }
  return {
    band: 'adult',
    age,
    canSelfRegister: true,
    allowEnergyDeficit: true,
    allowWeightLossGoal: true,
    allowMaximalLoading: true,
    maxRpe: 9,
    allowFacePhotos: true,
    allowAppearancePhotos: true,
    notes: [],
  };
}
