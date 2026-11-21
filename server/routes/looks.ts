import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { EQUIPMENT_LABELS } from '../../shared/schemas';
import { BUILD_GOAL_LABELS, BuildPlanInput, SKIN_CONCERN_LABELS, SkinAdviceInput } from '../../shared/schemas/looks';
import { loadContext } from '../services/context';
import { archetypeById } from '../../shared/domain/fitness/builds';
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
  return c.json({
    report: c.var.store.latestLookReport(kind),
    photosAllowed: kind === 'skin' ? ctx.policy.allowFacePhotos : ctx.policy.allowAppearancePhotos,
    goalPhotoAllowed: kind === 'build' && ctx.policy.allowGoalPhotos,
    sports: ctx.modules.has('sports') ? (ctx.settings.sports?.sports ?? []).map((s) => ({ sport: s.sport, position: s.position, secondaryPosition: s.secondaryPosition })) : [],
    aiReady: !!p,
    provider: p?.name ?? null,
  });
});

lookRoutes.delete('/looks/:kind', (c) => {
  c.var.store.deleteLookReports(kindOf(c.req.param('kind')));
  return c.json({ ok: true });
});

/** Which AI to use: Claude when there is an Anthropic key (the server's or the user's), else Gemini from GEMINI_API_KEY. */
export function provider(c: Parameters<typeof aiKeyFor>[0]): { name: 'claude' | 'gemini'; key: string } | null {
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
  if (input.photos.length && !ctx.policy.allowFacePhotos) {
    throw new HttpError(403, 'age_restricted', 'Face photos are for ages 14 and up. Answer the questions instead; you’ll get the same kind of routine.');
  }
  if (input.photos.length && !input.photoRules) throw new HttpError(422, 'validation', 'Confirm that your photos follow the photo rules.', { fields: { photoRules: 'Required with photos' } });
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
    input.photos.length ? `${input.photos.length} face photo(s) are attached. They should show the face and at most the shoulders; if anything else is visible, set usable to false.` : 'No photos: work from these answers.',
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
  const usedPhotos = input.currentPhotos.length > 0 || input.goalPhotos.length > 0;
  if (input.currentPhotos.length && !ctx.policy.allowAppearancePhotos) {
    throw new HttpError(403, 'age_restricted', 'Photos of yourself are for ages 18 and up. You can still add photos of the build you want, and describe where you are now.');
  }
  if (input.goalPhotos.length && !ctx.policy.allowGoalPhotos) {
    throw new HttpError(403, 'age_restricted', 'Goal photos are for ages 14 and up. Pick the build you want and describe it instead; you’ll get the same kind of plan.');
  }
  if (usedPhotos && !input.photoRules) throw new HttpError(422, 'validation', 'Confirm that your photos follow the photo rules.', { fields: { photoRules: 'Required with photos' } });
  const archetype = input.archetype ? archetypeById(input.archetype) : undefined;
  if (input.archetype && !archetype) throw new HttpError(422, 'validation', 'Choose one of the builds shown.');
  if (!usedPhotos && !archetype && !input.goals.length && !input.description) throw new HttpError(422, 'validation', 'Choose a build, add goal photos, or describe the build you want.');
  const f = ctx.settings.fitness;
  const sports = ctx.modules.has('sports') ? ctx.settings.sports?.sports ?? [] : [];
  const goalN = input.goalPhotos.length;
  const brief = [
    ageLine(ctx.policy.age, ctx.policy.band),
    f
      ? `Training: ${f.experience} experience, ${f.sessionsPerWeek} sessions a week of about ${f.sessionMinutes} minutes, at ${f.locations.join(' / ') || 'home'}. Equipment: ${f.equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ') || 'body weight only'}.`
      : 'Training: not set up yet; plan 3 sessions a week of 45 minutes with body weight and dumbbells.',
    f?.limitations.length ? `Injuries or limitations to work around: ${f.limitations.join(', ')}${f.limitationNotes ? ` (${f.limitationNotes})` : ''}.` : null,
    sports.length
      ? `Sport: ${sports.map((s) => `${s.sport.replace('_', ' ')}${s.position ? `, ${[s.position, s.secondaryPosition].filter(Boolean).join(' and ')}${s.secondaryPosition ? ' (two-way)' : ''}` : ''} ${s.teamStatus === 'on_team' ? ` (${s.level.replace('_', ' ')}, ${s.seasonPhase} season)` : ` (${s.teamStatus === 'cut' ? 'got cut, working to make the team next time' : s.teamStatus === 'tryout_prep' ? 'preparing for tryouts' : 'not on a team right now'}${s.tryoutDate ? `, tryout on ${s.tryoutDate}` : ''})`}`).join('; ')}. ${sports.some((s) => s.teamStatus === 'on_team') ? 'Leave room for practice.' : 'No team practices right now, so the plan can carry more of the training.'}`
      : null,
    archetype
      ? `Chosen build: ${archetype.name} (seen in ${archetype.seenIn}). Typical look: ${archetype.look.join('; ')}. Why people choose it: ${archetype.benefits.join('; ')}. Typical training emphasis: ${archetype.training.join('; ')}. Reality check to keep: ${archetype.realityCheck}`
      : null,
    input.forPosition ? `They picked this build for: ${input.forPosition}. Tie the plan to what that position needs.` : null,
    input.goals.length ? `Goal: ${input.goals.map((g) => BUILD_GOAL_LABELS[g]).join(', ')}.` : null,
    input.description ? `In their words: ${input.description}` : null,
    usedPhotos ? `Photos attached: ${[input.currentPhotos.length && `${input.currentPhotos.length} of the user now`, goalN && `${goalN} of the goal build`].filter(Boolean).join(' and ')}.` : 'No photos: work from these answers.',
    goalN
      ? `The ${goalN} goal photos may be of one person from different angles or of several people with a similar build. Describe the training-relevant traits they share (and say where they differ), and plan toward the common goal; don't plan toward one flattering pose or angle. If the photos show clearly different builds, say so in summary and plan toward what they have in common.`
      : null,
    goalN && !input.currentPhotos.length
      ? 'The goal photos are of someone else, not the user. Leave the "now" column to what the user said, or "not shown". If the person in them looks like a professional or adult athlete and the user is under 18, say kindly that the build takes years of training and growth.'
      : null,
    input.currentPhotos.length > 1 ? 'The photos of the user show different angles of the same person; use all of them to judge where they are now.' : null,
  ].filter(Boolean).join('\n');
  const photos = [
    ...input.currentPhotos.map((photo, i) => ({ label: `current ${i + 1} of ${input.currentPhotos.length} (the user now)`, photo })),
    ...input.goalPhotos.map((photo, i) => ({ label: `goal ${i + 1} of ${goalN} (the build they want)`, photo })),
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
