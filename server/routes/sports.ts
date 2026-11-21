import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { localDate } from '../../shared/schemas';
import { SOURCES, SPORTS_CATALOG, sportInfo, type SportId } from '../../shared/domain/sports/catalog';
import { CUT_STEPS, PHASE_INFO, TEAM_STATUS_LABELS, isDevelopmentMode, skillDose, tryoutPhase } from '../../shared/domain/sports/tryout';
import { startOfWeek } from '../../shared/domain/time';
import { decryptSecret, encryptSecret } from '../auth/crypto';
import { YouTubeError, resolveChannel, searchChannel, validateKey, type VideoResult } from '../integrations/youtube';
import { loadContext } from '../services/context';
import { planSportSessions, sportPriorities } from '../../shared/domain/sports/personalize';
import { positionInfo } from '../../shared/domain/sports/positions';

export const sportsRoutes = new Hono<AppEnv>();

const VIDEO_TTL = 7 * 24 * 3_600_000;
const CHANNEL_TTL = 30 * 24 * 3_600_000;

function requireSports(c: Context<AppEnv>) {
  const ctx = loadContext(c.var.store, c.var.now());
  if (!ctx.modules.has('sports')) throw new HttpError(404, 'module_disabled', 'Sports is turned off. You can enable it in Settings.');
  return ctx;
}

function summarize(values: { date: string; value: number }[], better: 'higher' | 'lower') {
  if (!values.length) return null;
  const pick = better === 'higher' ? Math.max : Math.min;
  const first = values[0]!;
  const latest = values[values.length - 1]!;
  return {
    baseline: first,
    latest,
    best: pick(...values.map((v) => v.value)),
    change: values.length > 1 ? Math.round((latest.value - first.value) * 100) / 100 : null,
    improved: values.length > 1 ? (better === 'higher' ? latest.value > first.value : latest.value < first.value) : null,
  };
}

sportsRoutes.get('/sports', (c) => {
  const ctx = requireSports(c);
  const store = c.var.store;
  const youtube = !!store.integrationToken('youtube');
  const week = startOfWeek(ctx.today);
  const sports = (ctx.settings.sports?.sports ?? []).map((s) => {
    const info = sportInfo(s.sport);
    const tests = store.skillTests(s.sport);
    const phase = tryoutPhase(ctx.today, s.tryoutDate);
    const dose = skillDose({ status: s.teamStatus, season: s.seasonPhase, today: ctx.today, tryoutDate: s.tryoutDate, weekStart: week });
    const positions = [s.position, s.secondaryPosition].map((p) => positionInfo(s.sport, p)).filter((p) => !!p).map((p) => ({ name: p.name, blurb: p.blurb, conditioning: p.conditioning, strength: p.strength, advanced: !!p.advanced }));
    return {
      priorities: sportPriorities(s, info, tests).slice(0, 4),
      week: planSportSessions(s, info, tests, { weekStart: week, sessions: dose.sessions, minutes: dose.minutes }),
      positionInfo: positions,
      prefs: s,
      label: info.label,
      positions: info.positions,
      skills: info.skills,
      focus: s.skills.filter((k) => info.skills.some((x) => x.id === k)),
      drills: info.drills.map((dr) => ({ ...dr, source: dr.basis === 'general' ? null : SOURCES[dr.basis] ?? null })),
      tests: info.tests.map((t) => {
        const results = tests.filter((r) => r.test_id === t.id).map((r) => ({ id: r.id, date: r.date, value: r.value, note: r.note }));
        return { ...t, results, summary: summarize(results, t.better) };
      }),
      sources: info.sources.map((id) => SOURCES[id]).filter(Boolean),
      channels: info.channels.map((ch) => ({ name: ch.name, url: `https://www.youtube.com/${ch.handle}`, official: ch.official })),
      safety: info.safety,
      status: { value: s.teamStatus, label: TEAM_STATUS_LABELS[s.teamStatus], development: isDevelopmentMode(s.teamStatus) },
      tryout: { ...phase, ...PHASE_INFO[phase.phase] },
      dose,
      cutSteps: s.teamStatus === 'cut' || s.teamStatus === 'tryout_prep' || s.teamStatus === 'no_team' ? CUT_STEPS : [],
    };
  });
  return c.json({ today: ctx.today, age: ctx.policy.age, youtube, sports });
});

const TestInput = z.object({
  sport: z.string(),
  testId: z.string().max(40),
  date: localDate,
  value: z.number().min(0).max(100_000),
  note: z.string().max(200),
});

sportsRoutes.post('/sports/tests', async (c) => {
  const ctx = requireSports(c);
  const input = await body(c, TestInput);
  const mine = ctx.settings.sports?.sports.some((s) => s.sport === input.sport);
  const known = (SPORTS_CATALOG as Record<string, { tests: { id: string }[] }>)[input.sport]?.tests.some((t) => t.id === input.testId);
  if (!mine || !known) throw new HttpError(422, 'validation', 'Unknown sport or test.');
  if (input.date > ctx.today) throw new HttpError(422, 'validation', 'Results can’t be in the future.', { fields: { date: 'Can’t be in the future' } });
  return c.json({ id: c.var.store.addSkillTest(input) }, 201);
});

sportsRoutes.delete('/sports/tests/:id', (c) => {
  requireSports(c);
  if (!c.var.store.deleteSkillTest(c.req.param('id'))) throw new HttpError(404, 'not_found', 'Result not found.');
  return c.json({ ok: true });
});

function youtubeHttpError(e: unknown): never {
  if (e instanceof YouTubeError) {
    throw new HttpError(e.kind === 'network' ? 503 : e.kind === 'quota' ? 429 : 422, `youtube_${e.kind}`, e.message, e.kind === 'bad_key' || e.kind === 'not_enabled' ? { fields: { key: e.message } } : undefined);
  }
  throw e;
}

/** Videos for one skill, searched only within the sport's vetted channels. */
sportsRoutes.get('/sports/videos', async (c) => {
  const ctx = requireSports(c);
  const sport = c.req.query('sport') as SportId | undefined;
  const skillId = c.req.query('skill');
  if (!sport || !(sport in SPORTS_CATALOG) || !ctx.settings.sports?.sports.some((s) => s.sport === sport)) throw new HttpError(422, 'validation', 'Choose one of your sports.');
  const info = sportInfo(sport);
  const skill = info.skills.find((s) => s.id === skillId);
  if (!skill) throw new HttpError(422, 'validation', 'Unknown skill.');
  const store = c.var.store;
  const enc = store.integrationToken('youtube');
  if (!enc) return c.json({ connected: false, videos: [], channels: info.channels.length });
  if (!info.channels.length) return c.json({ connected: true, videos: [], channels: 0 });

  const cacheKey = `videos:${sport}:${skill.id}`;
  const cached = store.cacheGet<VideoResult[]>(cacheKey, VIDEO_TTL);
  if (cached) return c.json({ connected: true, videos: cached, channels: info.channels.length, cached: true });

  const key = decryptSecret(enc, c.var.config.encryptionKey!);
  const fetchImpl = c.var.config.fetch;
  const videos: VideoResult[] = [];
  try {
    for (const ch of info.channels) {
      const chKey = `channel:${ch.handle}`;
      let id = store.cacheGet<{ id: string | null }>(chKey, CHANNEL_TTL)?.id;
      if (id === undefined) {
        id = await resolveChannel(ch, key, fetchImpl);
        store.cacheSet(chKey, { id });
      }
      if (!id) continue; // couldn't verify this channel — skip it rather than trust it
      videos.push(...(await searchChannel(id, ch, `${info.label} ${skill.query}`, key, fetchImpl)));
    }
  } catch (e) {
    store.upsertIntegration('youtube', { status: e instanceof YouTubeError && e.kind === 'bad_key' ? 'needs_reconnect' : 'connected', lastError: e instanceof Error ? e.message : 'Video search failed.' });
    youtubeHttpError(e);
  }
  store.cacheSet(cacheKey, videos);
  store.upsertIntegration('youtube', { status: 'connected', lastSyncAt: new Date().toISOString(), lastError: null });
  return c.json({ connected: true, videos, channels: info.channels.length });
});

sportsRoutes.post('/integrations/youtube/key', async (c) => {
  const input = await body(c, z.object({ key: z.string().trim().min(20, 'That key looks too short').max(100).regex(/^[A-Za-z0-9_-]+$/, 'API keys only contain letters, numbers, - and _'), consent: z.literal(true, { error: 'Please confirm' }) }));
  const encKey = c.var.config.encryptionKey;
  if (!encKey) throw new HttpError(503, 'not_configured', 'The server has no encryption key, so API keys can’t be stored safely.');
  try {
    await validateKey(input.key, c.var.config.fetch);
  } catch (e) {
    youtubeHttpError(e);
  }
  c.var.store.clearCache();
  c.var.store.upsertIntegration('youtube', { status: 'connected', tokenEnc: encryptSecret(input.key, encKey), lastError: null, meta: { connectedAt: new Date().toISOString() } });
  return c.json({ ok: true });
});
