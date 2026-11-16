import type { HairPrefs, SkinPrefs } from '../../schemas';
import type { AgePolicy } from '../age';

export interface RoutineStep {
  category: string;
  purpose: string;
  how: string;
  frequency: string;
  /** Introduced in week N of the gradual plan (1 = from the start). */
  startWeek: number;
  optional?: boolean;
}

export interface Routine {
  kind: 'skin' | 'hair' | 'grooming';
  title: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  weekly: RoutineStep[];
  minutesAm: number;
  minutesPm: number;
  cautions: string[];
  seeAClinicianIf: string[];
  basis: string;
}

export const CARE_BASIS =
  'General cosmetic guidance consistent with common dermatology-association advice (gentle cleansing, moisturising, daily sunscreen, introducing one new product at a time). It is not a diagnosis or medical advice.';

export function skinRoutine(p: SkinPrefs, policy: AgePolicy): Routine {
  const fragrance = p.fragranceSensitive ? ' Choose fragrance-free.' : '';
  const sensitive = p.type === 'not_sure' || p.concerns.includes('sensitivity') || p.fragranceSensitive;
  const moisturizerHow =
    p.type === 'oily' ? 'A light gel or lotion labelled non-comedogenic.' : p.type === 'dry' ? 'A richer cream; apply to slightly damp skin.' : 'A simple lotion labelled non-comedogenic.';
  const am: RoutineStep[] = [
    { category: 'Gentle cleanser (or water rinse)', purpose: 'Remove sweat and oil without stripping your skin.', how: `Lukewarm water, 30 seconds, pat dry.${fragrance}`, frequency: 'Daily', startWeek: 1 },
    { category: 'Moisturiser', purpose: 'Support your skin barrier.', how: moisturizerHow + fragrance, frequency: 'Daily', startWeek: 1 },
    { category: 'Broad-spectrum sunscreen, SPF 30+', purpose: 'Protects against UV, which worsens dark marks and long-term skin damage.', how: 'Two finger-lengths for face and neck; reapply every 2 hours outdoors or after sweating.', frequency: 'Daily, including cloudy days', startWeek: 1 },
  ];
  const pm: RoutineStep[] = [
    { category: 'Gentle cleanser', purpose: 'Remove sunscreen, sweat and dirt from the day.', how: `Massage for 30–60 seconds, rinse, pat dry.${fragrance}`, frequency: 'Daily, and after workouts', startWeek: 1 },
    { category: 'Moisturiser', purpose: 'Replenish moisture overnight.', how: moisturizerHow, frequency: 'Daily', startWeek: 1 },
  ];
  const cautions: string[] = [
    'Introduce one new product at a time, about two weeks apart, so you can tell what helps or irritates.',
    'Patch test new products: apply a small amount behind the ear or on the inner arm for several days before using on your face.',
  ];
  if (p.routineSize === 'standard') {
    if (p.concerns.includes('acne')) {
      pm.push({
        category: 'Acne-targeting product (e.g. benzoyl peroxide or adapalene)',
        purpose: 'Common over-the-counter options for breakouts.',
        how: 'Thin layer on dry skin, starting every other night. Expect mild dryness at first.',
        frequency: 'Every other night, then nightly if tolerated',
        startWeek: 3,
      });
      cautions.push('Don’t combine several strong actives at once (e.g. benzoyl peroxide, retinoids, and exfoliating acids on the same night) — that commonly causes irritation.');
      cautions.push('Benzoyl peroxide can bleach towels and pillowcases.');
    }
    if (p.concerns.includes('uneven_tone') && !sensitive) {
      am.splice(1, 0, { category: 'Niacinamide serum (optional)', purpose: 'Often used for uneven tone and oiliness; generally well tolerated.', how: 'A few drops before moisturiser.', frequency: 'Daily', startWeek: 5, optional: true });
    }
    if (p.concerns.includes('dryness') || p.type === 'dry') {
      pm.push({ category: 'Richer moisturiser or balm on dry patches', purpose: 'Extra barrier support for dry areas.', how: 'Thin layer after your usual moisturiser.', frequency: 'As needed', startWeek: 2, optional: true });
    }
  }
  if (sensitive) cautions.push('With sensitive skin, keep the routine short and skip scrubs and strong acids.');
  const seeAClinicianIf = [
    'Painful, deep, or scarring breakouts.',
    'A rash, swelling, or burning that does not settle after stopping a product.',
    'A mole or spot that changes shape, colour, or size, bleeds, or doesn’t heal.',
    'No improvement after about 8–12 weeks of a consistent routine.',
  ];
  if (policy.band === 'teen') seeAClinicianIf.push('Talk to a parent/guardian and your doctor before starting prescription products.');
  return {
    kind: 'skin',
    title: p.routineSize === 'minimal' ? 'Essential skin routine' : 'Skin routine',
    am,
    pm,
    weekly: [],
    minutesAm: am.length * 1 + 2,
    minutesPm: pm.length * 1 + 2,
    cautions,
    seeAClinicianIf,
    basis: CARE_BASIS,
  };
}

export function hairRoutine(p: HairPrefs): Routine {
  const textured = p.texture === 'curly' || p.texture === 'coily';
  const washes = p.washesPerWeek || (textured ? 1 : p.scalp === 'oily' ? 4 : 3);
  const weekly: RoutineStep[] = [
    {
      category: p.scalp === 'oily' ? 'Shampoo (focus on the scalp)' : textured ? 'Gentle or sulfate-free shampoo' : 'Mild shampoo',
      purpose: 'Clean the scalp; the lengths get cleaned as it rinses through.',
      how: p.scalp === 'flaky_or_itchy' ? 'Massage into the scalp. An anti-dandruff shampoo (e.g. zinc pyrithione or ketoconazole) can help flaking; leave on for a few minutes before rinsing.' : 'Massage into the scalp with fingertips, not nails, and rinse well.',
      frequency: `${washes}× per week`,
      startWeek: 1,
    },
    { category: 'Conditioner', purpose: 'Reduces friction, tangles and breakage.', how: 'Mid-lengths to ends; detangle with fingers or a wide-tooth comb while it’s in, then rinse.', frequency: 'Every wash', startWeek: 1 },
  ];
  if (textured || p.concerns.includes('dryness') || p.chemicallyTreated) {
    weekly.push({ category: 'Deep conditioner / mask', purpose: 'Extra moisture for dry, textured or treated hair.', how: 'Leave on 10–20 minutes, then rinse.', frequency: 'Once a week', startWeek: 2 });
  }
  const between: RoutineStep[] = [];
  if (textured || p.concerns.includes('frizz') || p.concerns.includes('definition')) {
    between.push({ category: 'Leave-in conditioner or cream', purpose: 'Moisture and definition between washes.', how: 'Small amount on damp hair, scrunch or smooth in.', frequency: 'After washing; refresh as needed', startWeek: 1 });
  }
  if (p.heat !== 'never') {
    between.push({ category: 'Heat protectant', purpose: 'Reduces damage from styling tools.', how: 'Apply before any blow-drying, straightening or curling. Use the lowest effective temperature.', frequency: 'Every time you use heat', startWeek: 1 });
  }
  if (p.concerns.includes('breakage') || p.concerns.includes('tangles')) {
    between.push({ category: 'Night protection', purpose: 'Less friction while you sleep.', how: 'Satin/silk pillowcase or bonnet; loose braid or pineapple for longer hair.', frequency: 'Nightly', startWeek: 1 });
  }
  const grooming: RoutineStep[] = [];
  if (p.facialHair === 'shave') grooming.push({ category: 'Shave', purpose: 'Clean shave with less irritation.', how: 'Shave after a warm shower, use shaving gel, go with the grain, rinse cold, moisturise.', frequency: 'As preferred', startWeek: 1 });
  if (p.facialHair === 'beard') grooming.push({ category: 'Beard care', purpose: 'Keep the beard soft and the skin underneath healthy.', how: 'Wash with your face routine, a few drops of beard oil, trim the neckline weekly.', frequency: 'Daily / weekly trim', startWeek: 1 });

  const cautions = ['Tight hairstyles worn for long stretches can stress the hairline — alternate styles.'];
  if (p.chemicallyTreated) cautions.push('Space out chemical services (colour, relaxers, perms) and avoid doing them at home on the same day.');
  return {
    kind: 'hair',
    title: 'Hair & grooming routine',
    am: [...between.filter((s) => s.category !== 'Night protection'), ...grooming],
    pm: between.filter((s) => s.category === 'Night protection'),
    weekly,
    minutesAm: Math.max(2, between.length * 2 + grooming.length * 4),
    minutesPm: 2,
    cautions,
    seeAClinicianIf: ['Sudden or patchy hair loss.', 'A painful, red, or scaly scalp that doesn’t improve with gentle care.', 'Persistent itching or flaking despite an anti-dandruff shampoo.'],
    basis: 'General cosmetic haircare guidance. Hair and scalp conditions should be assessed by a clinician.',
  };
}

/** Wash days spread across the week (weekday numbers, 0 = Sunday). */
export function washDays(washesPerWeek: number): number[] {
  if (washesPerWeek <= 0) return [];
  if (washesPerWeek >= 7) return [0, 1, 2, 3, 4, 5, 6];
  const step = 7 / washesPerWeek;
  const days = Array.from({ length: washesPerWeek }, (_, i) => (1 + Math.round(i * step)) % 7);
  return [...new Set(days)].sort();
}
