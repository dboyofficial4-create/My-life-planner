/**
 * Deterministic unit handling for recipes and grocery lists.
 * Each ingredient has one canonical dimension (mass, volume or count) so we
 * never need density guesses to convert between them.
 */
export type Dimension = 'mass' | 'volume' | 'count';
export type Unit = 'g' | 'kg' | 'oz' | 'lb' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'fl_oz' | 'count';

const TO_BASE: Record<Unit, { dim: Dimension; factor: number }> = {
  g: { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1000 },
  oz: { dim: 'mass', factor: 28.349523125 },
  lb: { dim: 'mass', factor: 453.59237 },
  ml: { dim: 'volume', factor: 1 },
  l: { dim: 'volume', factor: 1000 },
  tsp: { dim: 'volume', factor: 4.92892159375 },
  tbsp: { dim: 'volume', factor: 14.78676478125 },
  cup: { dim: 'volume', factor: 236.5882365 },
  fl_oz: { dim: 'volume', factor: 29.5735295625 },
  count: { dim: 'count', factor: 1 },
};

export function dimensionOf(unit: Unit): Dimension {
  return TO_BASE[unit].dim;
}

/** Convert to the base unit of the dimension (g, ml, or count). */
export function toBase(qty: number, unit: Unit): number {
  return qty * TO_BASE[unit].factor;
}

export function fromBase(qty: number, unit: Unit): number {
  return qty / TO_BASE[unit].factor;
}

export function convert(qty: number, from: Unit, to: Unit): number {
  if (dimensionOf(from) !== dimensionOf(to)) throw new Error(`Cannot convert ${from} to ${to}`);
  return fromBase(toBase(qty, from), to);
}

export type UnitSystem = 'metric' | 'imperial';

export interface DisplayQty {
  qty: number;
  unit: Unit;
  text: string;
}

const UNIT_LABEL: Record<Unit, string> = {
  g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', ml: 'ml', l: 'L', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', fl_oz: 'fl oz', count: '',
};

function niceRound(n: number): number {
  if (n >= 100) return Math.round(n / 5) * 5;
  if (n >= 10) return Math.round(n);
  if (n >= 1) return Math.round(n * 4) / 4;
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  const r = niceRound(n);
  const whole = Math.floor(r);
  const frac = Number((r - whole).toFixed(2));
  const sym = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : null;
  if (sym && r >= 0.25) return whole ? `${whole}${sym}` : sym;
  return String(r);
}

/** Pick a readable unit for a base quantity in the user's unit system. */
export function formatQuantity(baseQty: number, dim: Dimension, system: UnitSystem): DisplayQty {
  if (dim === 'count') {
    const q = Math.ceil(baseQty * 2) / 2;
    return { qty: q, unit: 'count', text: fmt(q) };
  }
  let unit: Unit;
  if (dim === 'mass') {
    if (system === 'metric') unit = baseQty >= 1000 ? 'kg' : 'g';
    else unit = baseQty >= 453.59237 ? 'lb' : 'oz';
  } else if (system === 'metric') unit = baseQty >= 1000 ? 'l' : 'ml';
  else unit = baseQty >= 59 ? 'cup' : baseQty >= 14 ? 'tbsp' : 'tsp';
  const qty = fromBase(baseQty, unit);
  return { qty, unit, text: `${fmt(qty)} ${UNIT_LABEL[unit]}${unit === 'cup' && niceRound(qty) > 1 ? 's' : ''}` };
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cm / 2.54;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export const feetInchesToCm = (feet: number, inches: number) => Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
export const kgToLb = (kg: number) => Math.round(kg * 2.2046226218 * 10) / 10;
export const lbToKg = (lb: number) => Math.round((lb / 2.2046226218) * 10) / 10;
