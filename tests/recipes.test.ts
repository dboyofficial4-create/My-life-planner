import { describe, expect, it } from 'vitest';
import { RECIPES } from '../shared/domain/nutrition/recipes';
import { COOKING_TERMS, guideFor, termsIn } from '../shared/domain/nutrition/guides';

describe('beginner recipe guides', () => {
  it('every recipe has a full guide', () => {
    for (const r of RECIPES) {
      const g = guideFor(r.id);
      expect(g, r.id).toBeTruthy();
      expect(g!.steps.length, r.id).toBeGreaterThanOrEqual(r.steps.length);
      expect(g!.equipment.length, r.id).toBeGreaterThan(0);
      for (const s of g!.steps) expect(s.text.trim().length, r.id).toBeGreaterThan(10);
    }
  });

  it('meat and fish steps state a safe cooking temperature', () => {
    for (const id of ['chicken_rice_bowl', 'turkey_pasta', 'beef_tacos', 'sheet_pan_salmon']) {
      expect(guideFor(id)!.steps.some((s) => /°C/.test(s.safety ?? '')), id).toBe(true);
    }
  });

  it('explains the cooking words a step uses', () => {
    expect(termsIn('Sauté the onion, then simmer.')).toEqual(expect.arrayContaining(['sauté', 'simmer']));
    expect(termsIn('brown rice needs more water')).not.toContain('brown');
    expect(termsIn('Brown the beef')).toContain('brown');
    for (const k of Object.keys(COOKING_TERMS)) expect(COOKING_TERMS[k]!.length).toBeGreaterThan(20);
  });
});
