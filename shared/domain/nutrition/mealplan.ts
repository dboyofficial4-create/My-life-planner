import type { NutritionPrefs } from '../../schemas';
import type { AgePolicy } from '../age';
import { weekdayOf, type LocalDate } from '../time';
import { RECIPES, recipeAllergens, recipeSources, type MealSlot, type Recipe, type Source } from './recipes';

export interface MealEntry {
  date: LocalDate;
  slot: MealSlot;
  /** null = eaten out / school lunch (no groceries). */
  recipeId: string | null;
  servings: number;
  /** Leftovers reuse an earlier cooked entry and add no groceries. */
  leftoverOf: { date: LocalDate; slot: MealSlot } | null;
  label?: string;
}

const ALLOWED_SOURCES: Record<NutritionPrefs['diet'], Source[]> = {
  vegan: ['plant'],
  vegetarian: ['plant', 'dairy', 'egg'],
  pescatarian: ['plant', 'dairy', 'egg', 'fish', 'shellfish'],
  omnivore: ['plant', 'dairy', 'egg', 'fish', 'shellfish', 'poultry', 'beef', 'pork'],
};

const SKILL_RANK = { beginner: 1, comfortable: 2, confident: 3 } as const;

export interface FitResult {
  ok: boolean;
  reasons: string[];
}

/** Why a recipe does or does not fit. Used for filtering and for explaining swaps. */
export function recipeFit(r: Recipe, prefs: NutritionPrefs): FitResult {
  const reasons: string[] = [];
  const allowed = ALLOWED_SOURCES[prefs.diet];
  const bad = recipeSources(r).filter((s) => !allowed.includes(s));
  if (bad.length) reasons.push(`Contains ${bad.join(', ')} (${prefs.diet})`);
  if (prefs.avoid.includes('pork') && recipeSources(r).includes('pork')) reasons.push('Contains pork');
  if (prefs.avoid.includes('beef') && recipeSources(r).includes('beef')) reasons.push('Contains beef');
  const allergens = recipeAllergens(r).filter((a) => prefs.allergies.includes(a));
  if (allergens.length) reasons.push(`Contains ${allergens.join(', ').replace('_', ' ')} (allergy)`);
  const kitchen = new Set(prefs.kitchen);
  const noKitchen = kitchen.has('no_kitchen');
  const missingTools = r.tools.filter((t) => noKitchen || !kitchen.has(t));
  if (missingTools.length) reasons.push(`Needs ${missingTools.join(', ')}`);
  if (SKILL_RANK[r.skill] > SKILL_RANK[prefs.cookingSkill] + 1) reasons.push('Above your cooking experience');
  return { ok: reasons.length === 0, reasons };
}

export function compatibleRecipes(prefs: NutritionPrefs, slot?: MealSlot): Recipe[] {
  return RECIPES.filter((r) => (!slot || r.slots.includes(slot)) && recipeFit(r, prefs).ok);
}

export interface MealPlanInput {
  dates: LocalDate[];
  prefs: NutritionPrefs;
  budget: 'tight' | 'moderate' | 'flexible';
  /** Dates with school/work covering lunch. */
  schoolDates: LocalDate[];
  /** Include a planned snack (sport, high activity). */
  includeSnack: boolean;
  policy: AgePolicy;
  /** Varies rotation week to week. */
  seed: number;
}

export interface MealPlanResult {
  entries: MealEntry[];
  notes: string[];
}

export function generateMealPlan(input: MealPlanInput): MealPlanResult {
  const { prefs, dates } = input;
  const notes: string[] = [];
  const household = prefs.householdSize;
  const byCost = (list: Recipe[]) => (input.budget === 'tight' ? [...list].sort((a, b) => a.cost - b.cost) : list);
  const pool = (slot: MealSlot, maxMinutes?: number) =>
    byCost(compatibleRecipes(prefs, slot).filter((r) => maxMinutes === undefined || r.prepMinutes + r.cookMinutes <= maxMinutes));

  const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner', ...(input.includeSnack ? (['snack'] as const) : [])];
  const entries: MealEntry[] = [];
  const pendingLeftover = new Map<LocalDate, { date: LocalDate; recipeId: string }>();
  const missing = new Set<MealSlot>();

  dates.forEach((date, dayIdx) => {
    for (const slot of slots) {
      if (slot === 'lunch') {
        if (input.schoolDates.includes(date) && prefs.schoolLunch === 'buy') {
          entries.push({ date, slot, recipeId: null, servings: 1, leftoverOf: null, label: 'School lunch' });
          continue;
        }
        const lo = pendingLeftover.get(date);
        if (lo) {
          entries.push({ date, slot, recipeId: lo.recipeId, servings: household, leftoverOf: { date: lo.date, slot: 'dinner' } });
          pendingLeftover.delete(date);
          continue;
        }
      }
      const weekday = weekdayOf(date) !== 0 && weekdayOf(date) !== 6;
      const maxMinutes = slot === 'dinner' && weekday && prefs.weekdayCookMinutes > 0 ? Math.max(prefs.weekdayCookMinutes, 15) : undefined;
      let candidates = pool(slot, maxMinutes);
      if (slot === 'lunch' && input.schoolDates.includes(date)) candidates = candidates.filter((r) => r.packable);
      if (!candidates.length) candidates = pool(slot);
      if (!candidates.length) {
        missing.add(slot);
        continue;
      }
      const offset = { breakfast: 0, lunch: 2, dinner: 1, snack: 3 }[slot];
      const recipe = candidates[(dayIdx + offset + input.seed) % candidates.length]!;
      const cookExtra = slot === 'dinner' && recipe.leftoverFriendly && dayIdx < dates.length - 1;
      entries.push({ date, slot, recipeId: recipe.id, servings: cookExtra ? household * 2 : household, leftoverOf: null });
      if (cookExtra) {
        const next = dates[dayIdx + 1]!;
        if (!pendingLeftover.has(next)) pendingLeftover.set(next, { date, recipeId: recipe.id });
      }
    }
  });

  for (const slot of missing) {
    notes.push(`No recipe in the current library fits all your settings for ${slot}. Those slots are left open rather than suggesting something unsuitable.`);
  }
  if (input.policy.band !== 'adult') {
    notes.push('Meals are planned for regular, adequate fuel — not calorie restriction. Eat to appetite, especially around training.');
  }
  return { entries, notes };
}
