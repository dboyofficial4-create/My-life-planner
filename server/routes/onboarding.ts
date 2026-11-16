import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { body } from '../http';
import { OnboardingComplete, OnboardingSave } from '../../shared/schemas/onboarding';
import { applyOnboarding } from '../services/onboarding';
import { generateIfEmpty } from '../services/planning';
import { startOfWeek, todayIn } from '../../shared/domain/time';

export const onboardingRoutes = new Hono<AppEnv>();

onboardingRoutes.get('/', (c) => {
  const ob = c.var.store.getOnboarding();
  return c.json({ step: ob?.step ?? 'welcome', draft: ob?.draft ?? {}, completed: !!ob?.completedAt });
});

/** Save-and-resume: the draft is stored server-side after every step. */
onboardingRoutes.put('/', async (c) => {
  const input = await body(c, OnboardingSave);
  c.var.store.saveOnboarding(input.step, input.draft);
  return c.json({ ok: true });
});

onboardingRoutes.post('/complete', async (c) => {
  const data = await body(c, OnboardingComplete);
  const store = c.var.store;
  applyOnboarding(store, data, c.var.now());
  const week = startOfWeek(todayIn(data.profile.timezone, c.var.now()));
  generateIfEmpty(store, week, c.var.now());
  return c.json({ ok: true, weekStart: week });
});
