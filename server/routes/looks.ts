import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { EQUIPMENT_LABELS } from '../../shared/schemas';
import { BUILD_GOAL_LABELS, BuildPlanInput, SKIN_CONCERN_LABELS, SkinAdviceInput } from '../../shared/schemas/looks';
import { loadContext } from '../services/context';
import { anthropicLookAI, sanitizeBuild, sanitizeSkin } from '../services/lookAI';
import { geminiLookAI } from '../services/geminiLookAI';
import { aiKeyFor } from './study';

export const lookRoutes = new Hono<AppEnv>();

const kindOf = (k: string) => {
  if (k !== 'skin' && k !== 'build') throw new HttpError(404, 'not_found', 'Not found.');
  return k;
};

lookRoutes.get('/looks/:kind', (c) => {
  const kind = kindOf(c.req.param('kind'));
  const ctx = loadContext(c.var.store, c.var.now());
  const p = provider(c);
  return c.json({ report: c.var.store.latestLookReport(kind), photosAllowed: ctx.policy.allowAppearancePhotos, aiReady: !!p, provider: p?.name ?? null });
});

lookRoutes.delete('/looks/:kind', (c) => {
  c.var.store.deleteLookReports(kindOf(c.req.param('kind')));
  return c.json({ ok: true });
});

/** Which AI to use: Claude when there is an Anthropic key (the server's or the user's), else Gemini from GEMINI_API_KEY. */
function provider(c: Parameters<typeof aiKeyFor>[0]): { name: 'claude' | 'gemini'; key: string } | null {
  const anthropic = aiKeyFor(c);
  if (anthropic) return { name: 'claude', key: anthropic };
  if (c.var.config.geminiApiKey) return { name: 'gemini', key: c.var.config.geminiApiKey };
  return null;
}

function lookAI(c: Parameters<typeof aiKeyFor>[0]) {
  const p = provider(c);
  if (!p) throw new HttpError(409, 'ai_not_connected', 'Add an AI key to use this: ANTHROPIC_API_KEY or GEMINI_API_KEY in the .env file, or an Anthropic key in Settings → Connections.');
  return (c.var.config.lookAI ?? (p.name === 'gemini' ? geminiLookAI : anthropicLookAI))(p.key);
}

const ageLine = (age: number | null, band: string) => (band === 'adult' ? `Age: ${age ?? 'adult'} (adult).` : `Age: ${age ?? 'unknown'}; treat as UNDER 18.`);

lookRoutes.post('/looks/skin', async (c) => {
  const input = await body(c, SkinAdviceInput);
  const ctx = loadContext(c.var.store, c.var.now());
  if (input.photos.length && !ctx.policy.allowAppearancePhotos) {
    throw new HttpError(403, 'age_restricted', 'Photo analysis is for ages 18 and up. Answer the questions instead; you’ll get the same kind of routine.');
  }
  const skin = ctx.settings.skin;
  const brief = [
    ageLine(ctx.policy.age, ctx.policy.band),
    `Skin type (their own words): ${input.skinType.replace('_', ' ')}.`,
    `What they want help with: ${input.concerns.map((k) => SKIN_CONCERN_LABELS[k]).join(', ') || 'a simple everyday routine'}.`,
    `Budget: ${input.budget}.`,
    skin?.fragranceSensitive ? 'They are sensitive to fragrance.' : null,
    skin?.sensitivities ? `Known sensitivities: ${skin.sensitivities}` : null,
    input.currentProducts ? `What they use now: ${input.currentProducts}` : 'They don’t use anything yet.',
    input.notes ? `Notes: ${input.notes}` : null,
    input.photos.length ? `${input.photos.length} face photo(s) are attached.` : 'No photos: work from these answers.',
  ].filter(Boolean).join('\n');
  const ai = lookAI(c);
  const result = sanitizeSkin(await ai.skin(input.photos, brief));
  if (!result.usable) throw new HttpError(422, 'photo_unusable', result.usableReason || 'Those photos couldn’t be used. Try a clear, well-lit photo of your face, or answer the questions without photos.');
  return c.json({ report: c.var.store.saveLookReport('skin', input.photos.length > 0, result) }, 201);
});

/** Lines a plan for someone under 18 must never contain, whatever the model wrote. */
const TEEN_BLOCKED = /\b(deficit|cut(ting)?\b|lose weight|weight loss|body[- ]?fat|calorie target|eat less|fasting|kcal)\b/i;

lookRoutes.post('/looks/build', async (c) => {
  const input = await body(c, BuildPlanInput);
  const ctx = loadContext(c.var.store, c.var.now());
  const usedPhotos = !!(input.currentPhoto || input.goalPhoto);
  if (usedPhotos && !ctx.policy.allowAppearancePhotos) {
    throw new HttpError(403, 'age_restricted', 'Photo analysis is for ages 18 and up. Pick the build you want and describe it instead; you’ll get the same kind of plan.');
  }
  if (!usedPhotos && !input.goals.length && !input.description) throw new HttpError(422, 'validation', 'Pick at least one goal or describe the build you want.');
  const f = ctx.settings.fitness;
  const sports = ctx.modules.has('sports') ? ctx.settings.sports?.sports ?? [] : [];
  const brief = [
    ageLine(ctx.policy.age, ctx.policy.band),
    f
      ? `Training: ${f.experience} experience, ${f.sessionsPerWeek} sessions a week of about ${f.sessionMinutes} minutes, at ${f.locations.join(' / ') || 'home'}. Equipment: ${f.equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ') || 'body weight only'}.`
      : 'Training: not set up yet; plan 3 sessions a week of 45 minutes with body weight and dumbbells.',
    f?.limitations.length ? `Injuries or limitations to work around: ${f.limitations.join(', ')}${f.limitationNotes ? ` (${f.limitationNotes})` : ''}.` : null,
    sports.length ? `Sport: ${sports.map((s) => `${s.sport.replace('_', ' ')} (${s.level.replace('_', ' ')}, ${s.seasonPhase} season)`).join('; ')}. Leave room for practice.` : null,
    input.goals.length ? `Goal: ${input.goals.map((g) => BUILD_GOAL_LABELS[g]).join(', ')}.` : null,
    input.description ? `In their words: ${input.description}` : null,
    usedPhotos ? `Photos attached: ${[input.currentPhoto && 'current', input.goalPhoto && 'goal'].filter(Boolean).join(' and ')}.` : 'No photos: work from these answers.',
  ].filter(Boolean).join('\n');
  const photos = [
    ...(input.currentPhoto ? [{ label: 'current (the user now)', photo: input.currentPhoto }] : []),
    ...(input.goalPhoto ? [{ label: 'goal (the build they want)', photo: input.goalPhoto }] : []),
  ];
  const ai = lookAI(c);
  const result = sanitizeBuild(await ai.build(photos, brief));
  if (!result.usable) throw new HttpError(422, 'photo_unusable', result.usableReason || 'Those photos couldn’t be used. Try clear photos in athletic clothes, or answer the questions without photos.');
  if (ctx.policy.band !== 'adult') {
    result.nutrition = result.nutrition.filter((l) => !TEEN_BLOCKED.test(l));
    result.focusAreas = result.focusAreas.filter((a) => !TEEN_BLOCKED.test(`${a.now} ${a.goal} ${a.focus}`));
    if (!result.nutrition.length) result.nutrition = ['Eat three regular meals and a snack around training, each with protein and carbs. Growing athletes need more food, not less.'];
  }
  return c.json({ report: c.var.store.saveLookReport('build', usedPhotos, result) }, 201);
});
