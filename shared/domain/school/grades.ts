/**
 * Deterministic grade math. Results are labelled as estimates whenever the
 * grading rules are incomplete or unconfirmed — we never present a guess as
 * an official grade.
 */

export interface GradeCategory {
  id: string;
  name: string;
  weight: number; // percent of final grade
  confirmed: boolean;
}

export interface GradeEntry {
  categoryId: string;
  pointsEarned: number | null; // null = not graded yet
  pointsPossible: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  weight: number;
  earned: number;
  possible: number;
  percent: number | null;
}

export interface CurrentGrade {
  percent: number | null;
  isEstimate: boolean;
  caveats: string[];
  categories: CategorySummary[];
}

function summarize(categories: GradeCategory[], entries: GradeEntry[]): CategorySummary[] {
  return categories.map((c) => {
    const graded = entries.filter((e) => e.categoryId === c.id && e.pointsEarned !== null);
    const earned = graded.reduce((s, e) => s + (e.pointsEarned ?? 0), 0);
    const possible = graded.reduce((s, e) => s + e.pointsPossible, 0);
    return { id: c.id, name: c.name, weight: c.weight, earned, possible, percent: possible > 0 ? (earned / possible) * 100 : null };
  });
}

function rulesCaveats(categories: GradeCategory[]): string[] {
  const caveats: string[] = [];
  const total = categories.reduce((s, c) => s + c.weight, 0);
  if (!categories.length) caveats.push('No grading categories yet. Add them from your syllabus.');
  else if (Math.abs(total - 100) > 0.01) caveats.push(`Category weights add up to ${Math.round(total * 10) / 10}%, not 100%.`);
  const unconfirmed = categories.filter((c) => !c.confirmed).map((c) => c.name);
  if (unconfirmed.length) caveats.push(`Weights not confirmed from your syllabus: ${unconfirmed.join(', ')}.`);
  return caveats;
}

export function currentGrade(categories: GradeCategory[], entries: GradeEntry[]): CurrentGrade {
  const cats = summarize(categories, entries);
  const caveats = rulesCaveats(categories);
  const withGrades = cats.filter((c) => c.percent !== null && c.weight > 0);
  if (!withGrades.length) return { percent: null, isEstimate: true, caveats: [...caveats, 'No graded work yet.'], categories: cats };
  const weightSum = withGrades.reduce((s, c) => s + c.weight, 0);
  const percent = withGrades.reduce((s, c) => s + (c.percent! * c.weight) / weightSum, 0);
  if (withGrades.length < cats.filter((c) => c.weight > 0).length) caveats.push('Some categories have no grades yet, so the current grade is re-weighted over graded categories only.');
  return { percent: Math.round(percent * 100) / 100, isEstimate: caveats.length > 0, caveats, categories: cats };
}

export interface RemainingWork {
  categoryId: string;
  pointsPossible: number;
}

export type NeededResult =
  | { status: 'ok'; requiredPercent: number; isEstimate: boolean; caveats: string[] }
  | { status: 'secured'; isEstimate: boolean; caveats: string[] }
  | { status: 'out_of_reach'; maxPossible: number; isEstimate: boolean; caveats: string[] }
  | { status: 'no_remaining'; isEstimate: boolean; caveats: string[] };

/**
 * "What grade do I need?": the average percent required on all remaining work
 * to finish at `targetPercent`. The final grade is linear in the score on
 * remaining work, so it is solved exactly.
 */
export function gradeNeeded(categories: GradeCategory[], entries: GradeEntry[], remaining: RemainingWork[], targetPercent: number): NeededResult {
  const caveats = rulesCaveats(categories);
  const isEstimate = caveats.length > 0;
  const cats = summarize(categories, entries);
  const remByCat = new Map<string, number>();
  for (const r of remaining) remByCat.set(r.categoryId, (remByCat.get(r.categoryId) ?? 0) + r.pointsPossible);
  if (![...remByCat.values()].some((v) => v > 0)) return { status: 'no_remaining', isEstimate, caveats };

  // final(x) = A + B·x, with x the fraction scored on remaining work.
  const active = cats.filter((c) => c.weight > 0 && c.possible + (remByCat.get(c.id) ?? 0) > 0);
  const weightSum = active.reduce((s, c) => s + c.weight, 0);
  let A = 0;
  let B = 0;
  for (const c of active) {
    const rem = remByCat.get(c.id) ?? 0;
    const denom = c.possible + rem;
    A += (c.weight / weightSum) * (c.earned / denom) * 100;
    B += (c.weight / weightSum) * (rem / denom) * 100;
  }
  if (A >= targetPercent) return { status: 'secured', isEstimate, caveats };
  const x = (targetPercent - A) / B;
  if (x > 1) return { status: 'out_of_reach', maxPossible: Math.round((A + B) * 10) / 10, isEstimate, caveats };
  return { status: 'ok', requiredPercent: Math.round(x * 1000) / 10, isEstimate, caveats };
}
