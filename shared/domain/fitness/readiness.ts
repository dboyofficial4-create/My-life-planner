/**
 * Morning readiness check-in: sleep, soreness, energy, stress and pain, turned into what today's
 * training should look like. Deliberately simple and explainable, in the spirit of the wellness
 * questionnaires sports teams use; it never diagnoses anything, and pain always means "stop and
 * get it checked", not "train through it".
 */
import { z } from 'zod';

export const ReadinessInput = z.object({
  sleepHours: z.number().min(0).max(16),
  /** 1 = terrible, 5 = great. */
  sleepQuality: z.number().int().min(1).max(5),
  /** 1 = not sore, 5 = very sore. */
  soreness: z.number().int().min(1).max(5),
  /** 1 = drained, 5 = full of energy. */
  energy: z.number().int().min(1).max(5),
  /** 1 = calm, 5 = very stressed. */
  stress: z.number().int().min(1).max(5),
  /** Pain (not normal muscle soreness): sharp, joint, or something that changes how you move. */
  pain: z.boolean(),
  painNote: z.string().trim().max(200).default(''),
});
export type ReadinessInput = z.infer<typeof ReadinessInput>;

export type ReadinessLevel = 'green' | 'yellow' | 'red';
/** What the planner does with today's training. */
export type ReadinessPlan = 'normal' | 'lighter' | 'recovery';

export interface ReadinessResult {
  score: number;
  level: ReadinessLevel;
  plan: ReadinessPlan;
  /** What pulled the score down, in plain words. */
  reasons: string[];
  advice: string[];
}

export const LEVEL_LABEL: Record<ReadinessLevel, string> = { green: 'Ready to go', yellow: 'Take it easier', red: 'Recovery day' };
export const PLAN_LABEL: Record<ReadinessPlan, string> = {
  normal: 'Training as planned.',
  lighter: 'Hard training moves to another day; light work stays.',
  recovery: 'All training moves to another day; an easy recovery session takes its place.',
};

/** Sleep need: teens 8–10 hours, adults 7–9 (AASM / CDC guidance). */
export function readiness(input: ReadinessInput, opts: { adult: boolean }): ReadinessResult {
  const reasons: string[] = [];
  const advice: string[] = [];
  let score = 100;
  const need = opts.adult ? 7 : 8;

  if (input.sleepHours < need - 2) { score -= 30; reasons.push(`Only ${input.sleepHours} hours of sleep`); }
  else if (input.sleepHours < need - 1) { score -= 20; reasons.push(`${input.sleepHours} hours of sleep`); }
  else if (input.sleepHours < need) { score -= 10; reasons.push(`A bit short on sleep (${input.sleepHours} h)`); }
  if (input.sleepQuality <= 2) { score -= input.sleepQuality === 1 ? 15 : 8; reasons.push('Poor sleep'); }
  if (input.soreness >= 4) { score -= input.soreness === 5 ? 30 : 15; reasons.push(input.soreness === 5 ? 'Very sore' : 'Sore'); }
  if (input.energy <= 2) { score -= input.energy === 1 ? 30 : 15; reasons.push(input.energy === 1 ? 'Drained' : 'Low energy'); }
  if (input.stress >= 4) { score -= input.stress === 5 ? 20 : 10; reasons.push(input.stress === 5 ? 'Very stressed' : 'Stressed'); }
  score = Math.max(0, Math.min(100, score));

  let level: ReadinessLevel = score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red';
  if (input.pain) {
    level = 'red';
    reasons.unshift('Pain');
    advice.push('Don’t train through pain. Rest the area and tell your coach or athletic trainer today. If it’s sharp, swollen, in a joint, or still there in a few days, see a doctor.');
  }
  const plan: ReadinessPlan = level === 'green' ? 'normal' : level === 'yellow' ? 'lighter' : 'recovery';

  if (input.sleepHours < need) advice.push(`Aim for an earlier night tonight: ${opts.adult ? '7 to 9' : '8 to 10'} hours is what your body recovers on.`);
  if (input.soreness >= 4 && !input.pain) advice.push('Easy movement, a walk or light mobility, helps soreness fade faster than sitting still.');
  if (input.energy <= 2) advice.push('Eat a proper breakfast and drink water before you decide you’re just tired.');
  if (input.stress >= 4) advice.push('Stress counts as load too. A short walk, breathing exercise, or talking to someone can help.');
  if (level === 'green') advice.push('You’re good to train as planned.');
  return { score, level, plan, reasons, advice };
}
