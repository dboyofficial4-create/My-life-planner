import { INGREDIENTS, recipeById, type Section } from './recipes';
import type { MealEntry } from './mealplan';
import { formatQuantity, toBase, dimensionOf, type UnitSystem } from './units';

export interface GroceryLine {
  key: string;
  name: string;
  section: Section;
  /** Total in base units (g, ml or count). */
  baseQty: number;
  display: string;
  owned: boolean;
  usedIn: string[];
  budgetSwap?: string;
}

export const SECTION_ORDER: Section[] = ['Produce', 'Protein', 'Dairy & eggs', 'Grains & bread', 'Pantry', 'Frozen', 'Spices & oils'];

/**
 * Combine ingredient quantities across all non-leftover meal entries.
 * Pure and deterministic: change an entry's recipe or servings and the list
 * is recomputed from scratch.
 */
export function buildGroceryList(entries: MealEntry[], pantry: ReadonlySet<string>, system: UnitSystem): GroceryLine[] {
  const totals = new Map<string, { base: number; usedIn: Set<string> }>();
  for (const e of entries) {
    if (!e.recipeId || e.leftoverOf) continue;
    const recipe = recipeById(e.recipeId);
    if (!recipe) continue;
    const scale = e.servings / recipe.servings;
    for (const ing of recipe.ingredients) {
      const meta = INGREDIENTS[ing.key];
      if (!meta) throw new Error(`Unknown ingredient ${ing.key} in ${recipe.id}`);
      if (dimensionOf(ing.unit) !== meta.dim) throw new Error(`${recipe.id}: ${ing.key} uses ${ing.unit} but is measured by ${meta.dim}`);
      const t = totals.get(ing.key) ?? { base: 0, usedIn: new Set<string>() };
      t.base += toBase(ing.qty, ing.unit) * scale;
      t.usedIn.add(recipe.name);
      totals.set(ing.key, t);
    }
  }
  const lines: GroceryLine[] = [];
  for (const [key, t] of totals) {
    const meta = INGREDIENTS[key]!;
    lines.push({
      key,
      name: meta.name,
      section: meta.section,
      baseQty: t.base,
      display: formatQuantity(t.base, meta.dim, system).text,
      owned: pantry.has(key),
      usedIn: [...t.usedIn].sort(),
      budgetSwap: meta.budgetSwap,
    });
  }
  return lines.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.name.localeCompare(b.name));
}

export function dailyNutrition(entries: MealEntry[], householdSize: number) {
  // Per-person estimate: each entry's servings are shared across the household.
  let kcal = 0;
  let protein = 0;
  for (const e of entries) {
    if (!e.recipeId) continue;
    const r = recipeById(e.recipeId);
    if (!r) continue;
    const perPerson = e.leftoverOf ? 1 : Math.min(e.servings / householdSize, 1);
    kcal += r.nutrition.kcal * perPerson;
    protein += r.nutrition.proteinG * perPerson;
  }
  return { kcal: Math.round(kcal / 10) * 10, proteinG: Math.round(protein) };
}
