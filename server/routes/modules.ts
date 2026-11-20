import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { ProgressLogInput, isLocalDate } from '../../shared/schemas';
import { addDays, startOfWeek } from '../../shared/domain/time';
import { EQUIPMENT_LABELS } from '../../shared/schemas';
import { buildGroceryList, dailyNutrition, SECTION_ORDER } from '../../shared/domain/nutrition/grocery';
import { compatibleRecipes, recipeFit } from '../../shared/domain/nutrition/mealplan';
import { INGREDIENTS, NUTRITION_BASIS, recipeAllergens, recipeById } from '../../shared/domain/nutrition/recipes';
import { ensureMealPlan, loadContext, weekOf } from '../services/context';

export const moduleRoutes = new Hono<AppEnv>();

const requireModule = (modules: Set<string>, ...names: string[]) => {
  if (!names.some((n) => modules.has(n))) throw new HttpError(404, 'module_disabled', 'This area is turned off. You can enable it in Settings.');
};

/* ---------- fitness & sports ---------- */

moduleRoutes.get('/fitness', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  requireModule(ctx.modules, 'fitness', 'sports');
  const from = addDays(ctx.today, -27);
  const history = store
    .itemsBetween(from, ctx.today)
    .filter((i) => ['workout', 'recovery', 'sport'].includes(i.category) && i.source !== 'fixed')
    .map((i) => ({ id: i.id, date: i.date, title: i.title, status: i.status, minutes: i.end - i.start, effort: i.effort, discomfort: i.discomfort, note: i.note }));
  const plan = store.getPlan(startOfWeek(ctx.today));
  const weekItems = plan ? store.items(plan.id) : [];
  const load = weekOf(ctx.today).dates.map((d) => ({
    date: d,
    load: weekItems.filter((i) => i.date === d && i.status !== 'skipped').reduce((s, i) => s + i.load, 0),
    sessions: weekItems.filter((i) => i.date === d && i.load > 0 && i.status !== 'skipped').map((i) => i.title),
  }));
  return c.json({
    program: ctx.program,
    equipment: (ctx.settings.fitness?.equipment ?? []).map((e) => EQUIPMENT_LABELS[e]),
    limitations: ctx.settings.fitness?.limitations ?? [],
    hasSports: ctx.modules.has('sports') && !!ctx.settings.sports?.sports.length,
    /** Progress photos never reach the server; this only says whether the app offers them. */
    progressPhotos: ctx.modules.has('sports') && ctx.policy.allowProgressPhotos,
    history,
    load,
    loadCap: 3,
    ageNotes: ctx.policy.notes,
  });
});

/* ---------- food ---------- */

function foodWeek(c: { var: AppEnv['Variables'] }, weekParam: string | undefined, force = false) {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  requireModule(ctx.modules, 'nutrition');
  const prefs = ctx.settings.nutrition!;
  const week = weekOf(weekParam && isLocalDate(weekParam) ? weekParam : ctx.today);
  if (force) ensureMealPlan(store, ctx, week.start, true);
  const entries = ensureMealPlan(store, ctx, week.start);
  const pantry = store.pantry();
  const checked = store.groceryChecked(week.start);
  const list = buildGroceryList(entries, pantry, ctx.settings.profile.units).map((l) => ({ ...l, checked: checked.has(l.key) }));
  const days = week.dates.map((d) => {
    const dayEntries = entries.filter((e) => e.date === d);
    return { date: d, estimate: dailyNutrition(dayEntries, prefs.householdSize) };
  });
  return {
    weekStart: week.start,
    today: ctx.today,
    householdSize: prefs.householdSize,
    units: ctx.settings.profile.units,
    entries: entries.map((e) => {
      const r = e.recipeId ? recipeById(e.recipeId) : undefined;
      return { ...e, recipe: r ? { id: r.id, name: r.name, minutes: r.prepMinutes + r.cookMinutes, servings: r.servings, nutrition: r.nutrition } : null };
    }),
    days,
    grocery: { sections: SECTION_ORDER.map((s) => ({ section: s, items: list.filter((l) => l.section === s) })).filter((s) => s.items.length) },
    basis: NUTRITION_BASIS,
    policyNotes: ctx.policy.band === 'adult' ? [] : ['Your plan focuses on regular meals and enough fuel for growth and sport, not calorie targets.'],
  };
}

moduleRoutes.get('/food', (c) => c.json(foodWeek(c, c.req.query('week'))));

moduleRoutes.post('/food/regenerate', async (c) => {
  const { weekStart } = await body(c, z.object({ weekStart: z.string().refine(isLocalDate) }));
  const res = foodWeek(c, weekStart, true);
  c.var.store.markStale(res.weekStart);
  return c.json(res);
});

moduleRoutes.get('/food/recipes', (c) => {
  const ctx = loadContext(c.var.store, c.var.now());
  requireModule(ctx.modules, 'nutrition');
  const slot = c.req.query('slot') as 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined;
  return c.json({ recipes: compatibleRecipes(ctx.settings.nutrition!, slot).map((r) => ({ id: r.id, name: r.name, minutes: r.prepMinutes + r.cookMinutes, cost: r.cost, slots: r.slots })) });
});

moduleRoutes.get('/food/recipes/:id', (c) => {
  const ctx = loadContext(c.var.store, c.var.now());
  requireModule(ctx.modules, 'nutrition');
  const r = recipeById(c.req.param('id'));
  if (!r) throw new HttpError(404, 'not_found', 'Recipe not found.');
  const fit = recipeFit(r, ctx.settings.nutrition!);
  return c.json({
    recipe: { ...r, ingredients: r.ingredients.map((i) => ({ ...i, name: INGREDIENTS[i.key]!.name })), allergens: recipeAllergens(r) },
    fit,
    basis: NUTRITION_BASIS,
  });
});

moduleRoutes.patch('/food/entries/:id', async (c) => {
  const input = await body(c, z.object({ recipeId: z.string().nullable().optional(), servings: z.number().min(0.5).max(20).optional(), label: z.string().max(60).nullable().optional() }));
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  requireModule(ctx.modules, 'nutrition');
  const entry = store.mealEntry(c.req.param('id'));
  if (!entry) throw new HttpError(404, 'not_found', 'Meal not found.');
  if (input.recipeId) {
    const r = recipeById(input.recipeId);
    if (!r) throw new HttpError(422, 'validation', 'Unknown recipe.');
    const fit = recipeFit(r, ctx.settings.nutrition!);
    if (!fit.ok) throw new HttpError(422, 'unsuitable', `That recipe doesn't fit your settings: ${fit.reasons.join('; ')}.`);
  }
  const changingRecipe = input.recipeId !== undefined && input.recipeId !== entry.recipe_id;
  store.updateMealEntry(entry.id, {
    recipeId: input.recipeId,
    servings: input.servings ?? (changingRecipe ? ctx.settings.nutrition!.householdSize : undefined),
    clearLeftover: changingRecipe,
    label: input.recipeId === null ? (input.label ?? 'Eating out') : null,
  });
  // Leftover entries that pointed at a changed dinner become their own meal.
  if (changingRecipe) {
    const week = weekOf(entry.date);
    for (const e of store.mealEntries(week.start, week.end)) {
      if (e.leftoverOf && e.leftoverOf.date === entry.date && e.leftoverOf.slot === entry.slot) store.updateMealEntry(e.id, { recipeId: null, clearLeftover: true, label: 'Leftovers changed — pick a lunch' });
    }
  }
  store.markStale(startOfWeek(entry.date));
  return c.json(foodWeek(c, entry.date));
});

moduleRoutes.put('/food/pantry', async (c) => {
  const input = await body(c, z.object({ key: z.string().refine((k) => k in INGREDIENTS, 'Unknown ingredient'), owned: z.boolean() }));
  c.var.store.setPantry(input.key, input.owned);
  return c.json({ ok: true });
});

moduleRoutes.put('/food/checked', async (c) => {
  const input = await body(c, z.object({ weekStart: z.string().refine(isLocalDate), key: z.string().refine((k) => k in INGREDIENTS), checked: z.boolean() }));
  c.var.store.setGroceryChecked(input.weekStart, input.key, input.checked);
  return c.json({ ok: true });
});

/* ---------- personal care ---------- */

moduleRoutes.get('/care', (c) => {
  const ctx = loadContext(c.var.store, c.var.now());
  requireModule(ctx.modules, 'skincare', 'haircare');
  const logs = c.var.store.logs(addDays(ctx.today, -56), ctx.today).filter((l) => l.metric === 'skin_checkin' || l.metric === 'hair_checkin');
  return c.json({ skin: ctx.skin, hair: ctx.hair, checkins: logs, today: ctx.today });
});

moduleRoutes.post('/care/checkin', async (c) => {
  const input = await body(c, z.object({ kind: z.enum(['skin', 'hair']), rating: z.number().int().min(1).max(5), note: z.string().max(300) }));
  const ctx = loadContext(c.var.store, c.var.now());
  c.var.store.addLog({ date: ctx.today, metric: `${input.kind}_checkin`, value: input.rating, note: input.note });
  return c.json({ ok: true }, 201);
});

/* ---------- progress ---------- */

moduleRoutes.get('/progress', (c) => {
  const store = c.var.store;
  const ctx = loadContext(store, c.var.now());
  const thisWeek = startOfWeek(ctx.today);
  const weeks = [-3, -2, -1, 0].map((n) => addDays(thisWeek, n * 7));
  const consistency = weeks.map((w) => {
    const items = store.itemsBetween(w, addDays(w, 6)).filter((i) => i.source !== 'fixed' && !['meal', 'care'].includes(i.category) && (i.date < ctx.today || (i.date === ctx.today && i.end <= ctx.nowMinute) || i.status !== 'planned'));
    return { weekStart: w, done: items.filter((i) => i.status === 'done').length, due: items.length, byCategory: Object.fromEntries(['workout', 'study', 'sport', 'recovery', 'meal_prep'].map((cat) => [cat, { done: items.filter((i) => i.category === cat && i.status === 'done').length, due: items.filter((i) => i.category === cat).length }])) };
  });
  const effort = store
    .itemsBetween(weeks[0]!, ctx.today)
    .filter((i) => i.status === 'done' && i.effort !== null)
    .map((i) => ({ date: i.date, title: i.title, effort: i.effort, discomfort: i.discomfort }));
  return c.json({
    today: ctx.today,
    consistency,
    effort,
    logs: store.logs(weeks[0]!, ctx.today).filter((l) => !l.metric.endsWith('_checkin')),
    allowBodyWeight: ctx.policy.band === 'adult',
  });
});

moduleRoutes.post('/progress/logs', async (c) => {
  const input = await body(c, ProgressLogInput);
  const ctx = loadContext(c.var.store, c.var.now());
  if (input.metric === 'body_weight' && ctx.policy.band !== 'adult') throw new HttpError(403, 'age_restricted', 'Body-weight tracking isn’t offered for your age.');
  if (input.date > ctx.today) throw new HttpError(422, 'validation', 'Logs can’t be in the future.', { fields: { date: 'Can’t be in the future' } });
  if (input.metric !== 'body_weight' && input.metric !== 'strength_note' && (input.value < 1 || input.value > 5)) throw new HttpError(422, 'validation', 'Use a rating from 1 to 5.', { fields: { value: 'Use 1–5' } });
  const id = c.var.store.addLog(input);
  return c.json({ id }, 201);
});

moduleRoutes.delete('/progress/logs/:id', (c) => {
  if (!c.var.store.deleteLog(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Log not found.');
  return c.json({ ok: true });
});
