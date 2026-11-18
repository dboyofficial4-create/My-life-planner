import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import { SOURCES, SPORTS_CATALOG, pitchSmartRest } from '../shared/domain/sports/catalog';
import { focusFor, skillDose, tryoutPhase } from '../shared/domain/sports/tryout';
import { buildPlanInput } from '../shared/domain/planner/build';
import { generatePlan, validatePlan } from '../shared/domain/planner/engine';
import { agePolicy } from '../shared/domain/age';
import type { SportsPrefs } from '../shared/schemas';
import { WEEK, settings } from './fixtures';

const NOW = new Date('2026-11-16T15:00:00Z');

describe('sports catalog integrity', () => {
  it('every drill, test and source reference resolves', () => {
    for (const [id, s] of Object.entries(SPORTS_CATALOG)) {
      const skills = new Set(s.skills.map((x) => x.id));
      for (const dr of s.drills) {
        expect(skills.has(dr.skill), `${id}:${dr.id}`).toBe(true);
        expect(dr.basis === 'general' || dr.basis in SOURCES, `${id}:${dr.id}`).toBe(true);
      }
      for (const t of s.tests) expect(skills.has(t.skill), `${id}:${t.id}`).toBe(true);
      for (const src of s.sources) expect(SOURCES[src], `${id}:${src}`).toBeDefined();
      for (const ch of s.channels) expect(ch.handle.startsWith('@')).toBe(true);
      // Every skill has at least one drill to practise.
      for (const sk of s.skills) expect(s.drills.some((dr) => dr.skill === sk.id), `${id}:${sk.id}`).toBe(true);
    }
    for (const src of Object.values(SOURCES)) expect(src.url.startsWith('https://')).toBe(true);
  });
});

describe('Pitch Smart rest guide', () => {
  it('maps pitch counts to rest days by age', () => {
    expect(pitchSmartRest(13, 20)).toMatchObject({ ok: true, restDays: 0 });
    expect(pitchSmartRest(13, 21)).toMatchObject({ ok: true, restDays: 1 });
    expect(pitchSmartRest(13, 66)).toMatchObject({ ok: true, restDays: 4 });
    expect(pitchSmartRest(16, 45)).toMatchObject({ ok: true, restDays: 1 });
    expect(pitchSmartRest(16, 76)).toMatchObject({ ok: true, restDays: 4 });
    expect(pitchSmartRest(17, 110)).toMatchObject({ ok: true, overMax: true, dailyMax: 105 });
    expect(pitchSmartRest(25, 50)).toMatchObject({ ok: false });
    expect(pitchSmartRest(null, 50)).toMatchObject({ ok: false });
  });
});

describe('cut / tryout mode', () => {
  it('phases count down to the tryout', () => {
    expect(tryoutPhase('2026-11-16', null).phase).toBe('no_date');
    expect(tryoutPhase('2026-11-16', '2027-02-01').phase).toBe('build');
    expect(tryoutPhase('2026-11-16', '2026-12-20').phase).toBe('sharpen');
    expect(tryoutPhase('2026-11-16', '2026-12-01').phase).toBe('peak');
    expect(tryoutPhase('2026-11-16', '2026-11-20').phase).toBe('taper');
  });
  it('plans more skill work without a team and tapers before tryouts', () => {
    const base = { season: 'off' as const, today: '2026-11-16', weekStart: '2026-11-16' };
    expect(skillDose({ ...base, status: 'on_team', tryoutDate: null }).sessions).toBe(2);
    expect(skillDose({ ...base, status: 'on_team', season: 'in', tryoutDate: null }).sessions).toBe(1);
    expect(skillDose({ ...base, status: 'cut', tryoutDate: '2027-03-01' }).sessions).toBe(4);
    const taper = skillDose({ ...base, status: 'cut', tryoutDate: '2026-11-20' });
    expect(taper.sessions).toBe(3);
    expect(taper.minutes).toBeLessThan(40);
  });
  it('rotates focus skills', () => {
    const picks = [0, 1, 2, 3].map((n) => focusFor(['a', 'b'], '2026-11-16', n));
    expect(new Set(picks)).toEqual(new Set(['a', 'b']));
  });

  const sportsPrefs = (o: Partial<SportsPrefs['sports'][number]> = {}): SportsPrefs => ({
    sports: [{ sport: 'basketball', position: 'Guard', level: 'school_team', seasonPhase: 'off', goal: '', teamStatus: 'cut', tryoutDate: null, skills: ['shooting', 'ball_handling'], coachFeedback: 'Improve weak-hand dribbling', ...o }],
  });

  it('builds a valid plan with focused sessions and keeps the tryout day clear', () => {
    const s = settings({ profile: { ...settings().profile, modules: ['sports'] }, sports: sportsPrefs({ tryoutDate: WEEK[4]! }) });
    const policy = agePolicy(s.profile.birthday, WEEK[0]!);
    const { input } = buildPlanInput({ dates: WEEK, today: WEEK[0]!, settings: s, goals: [], commitments: [], policy });
    const out = generatePlan(input);
    expect(validatePlan(out.items, input)).toEqual([]);
    const sessions = out.items.filter((i) => i.category === 'sport');
    expect(sessions.length).toBeGreaterThanOrEqual(3);
    for (const it of sessions) {
      expect(it.title).toMatch(/^Basketball: (Shooting|Ball handling|skills check)/);
      expect([WEEK[3], WEEK[4]]).not.toContain(it.date); // tryout day and the day before
    }
    expect(sessions.some((i) => i.reason.includes('weak-hand'))).toBe(true);
  });

  it('on a team in season keeps solo work light', () => {
    const s = settings({ profile: { ...settings().profile, modules: ['sports'] }, sports: sportsPrefs({ teamStatus: 'on_team', seasonPhase: 'in' }) });
    const { input } = buildPlanInput({ dates: WEEK, today: WEEK[0]!, settings: s, goals: [], commitments: [], policy: agePolicy(s.profile.birthday, WEEK[0]!) });
    expect(generatePlan(input).items.filter((i) => i.category === 'sport')).toHaveLength(1);
  });
});

/* ---------- API ---------- */

function fakeYouTube() {
  const calls: string[] = [];
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
  const fn: typeof fetch = async (input) => {
    const u = new URL(String(input));
    calls.push(u.toString());
    if (u.hostname !== 'www.googleapis.com') throw new Error('unexpected host');
    if (u.searchParams.get('key') !== 'AIzaGoodKey_1234567890abcdefghij') return json({ error: { errors: [{ reason: 'keyInvalid' }], message: 'API key not valid' } }, 400);
    if (u.pathname.endsWith('/channels')) {
      if (u.searchParams.get('forHandle') === '@BreakthroughBBall') return json({ items: [{ id: 'UC_breakthrough', snippet: { title: 'Breakthrough Basketball' } }] });
      if (u.searchParams.get('id')) return json({ items: [{ id: u.searchParams.get('id'), snippet: { title: 'USA Baseball' } }] });
      return json({ items: [] });
    }
    if (u.pathname.endsWith('/search')) {
      const ch = u.searchParams.get('channelId');
      expect(u.searchParams.get('safeSearch')).toBe('strict');
      return json({ items: [
        { id: { videoId: 'vid1' }, snippet: { title: 'Form shooting &amp; footwork', channelId: ch, channelTitle: 'Breakthrough Basketball', publishedAt: '2025-01-01T00:00:00Z', thumbnails: { medium: { url: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg' } } } },
        { id: { videoId: 'evil' }, snippet: { title: 'Not from this channel', channelId: 'UC_other', channelTitle: 'Random', thumbnails: { medium: { url: 'https://evil.example.com/x.jpg' } } } },
      ] });
    }
    return json({}, 404);
  };
  return { fn, calls };
}

class Client {
  cookie = '';
  constructor(private app: ReturnType<typeof createApp>) {}
  async req(method: string, path: string, body?: unknown) {
    const res = await this.app.request(path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), host: 'localhost' }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, text };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b: unknown = {}) => this.req('POST', p, b);
}

async function athlete(app: ReturnType<typeof createApp>, email: string) {
  const c = new Client(app);
  await c.post('/api/auth/register', { email, password: 'correct horse battery', birthday: '2009-02-02' });
  const r = await c.post('/api/onboarding/complete', {
    profile: { displayName: 'A', birthday: '2009-02-02', timezone: 'America/New_York', units: 'imperial', clock: '12h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules: ['sports'] },
    goals: [], schedule: { lifeStage: 'neither', wakeWeekday: '07:00', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'evening', preferredStudyTime: 'any', restDays: [0], busyDays: [], commuteMinutes: 0 },
    schoolHours: { enabled: false, days: [], start: '08:00', end: '15:00' }, workHours: { enabled: false, days: [], start: '09:00', end: '17:00' }, commitments: [],
    fitness: { experience: 'some', sessionsPerWeek: 2, sessionMinutes: 45, locations: ['home'], equipment: [], accessNotes: '', limitations: [], limitationNotes: '' },
    sports: { sports: [{ sport: 'basketball', position: 'Guard', level: 'school_team', seasonPhase: 'off', goal: 'Make varsity', teamStatus: 'cut', tryoutDate: '2027-02-01', skills: ['shooting'], coachFeedback: '' }] },
  });
  expect(r.status, r.text).toBe(200);
  return c;
}

describe('sports API', () => {
  const setup = () => {
    const yt = fakeYouTube();
    const db = new Db(':memory:');
    return { db, yt, app: createApp(db, { secureCookies: false, now: () => NOW, encryptionKey: randomBytes(32).toString('base64'), fetch: yt.fn }) };
  };

  it('returns the sport with sourced drills, tryout phase and cut steps', async () => {
    const { app } = setup();
    const c = await athlete(app, 'a@example.com');
    const r = (await c.get('/api/sports')).json;
    const bb = r.sports[0];
    expect(bb.label).toBe('Basketball');
    expect(bb.status).toMatchObject({ value: 'cut', development: true });
    expect(bb.tryout.phase).toBe('build');
    expect(bb.cutSteps.length).toBeGreaterThan(3);
    expect(bb.sources.every((s: { url: string }) => s.url.startsWith('https://'))).toBe(true);
    expect(bb.drills.find((d: { id: string }) => d.id === 'form_shooting').source.publisher).toBe('Breakthrough Basketball');
    expect(r.youtube).toBe(false);
  });

  it('logs skill tests and reports change from your own baseline', async () => {
    const { app } = setup();
    const c = await athlete(app, 'b@example.com');
    expect((await c.post('/api/sports/tests', { sport: 'basketball', testId: 'five_spot', date: '2026-11-01', value: 22, note: '' })).status).toBe(201);
    await c.post('/api/sports/tests', { sport: 'basketball', testId: 'five_spot', date: '2026-11-15', value: 29, note: '' });
    const t = (await c.get('/api/sports')).json.sports[0].tests.find((x: { id: string }) => x.id === 'five_spot');
    expect(t.summary).toMatchObject({ change: 7, improved: true, best: 29 });
    expect((await c.post('/api/sports/tests', { sport: 'soccer', testId: 'juggle_best', date: '2026-11-15', value: 5, note: '' })).status).toBe(422);
    expect((await c.post('/api/sports/tests', { sport: 'basketball', testId: 'five_spot', date: '2026-12-15', value: 5, note: '' })).status).toBe(422);
    const other = await athlete(app, 'c@example.com');
    expect((await other.get('/api/sports')).json.sports[0].tests.find((x: { id: string }) => x.id === 'five_spot').results).toEqual([]);
  });

  it('searches only vetted channels with a validated key, caches results and never exposes the key', async () => {
    const { app, yt } = setup();
    const c = await athlete(app, 'd@example.com');
    expect((await c.get('/api/sports/videos?sport=basketball&skill=shooting')).json).toMatchObject({ connected: false });
    expect((await c.post('/api/integrations/youtube/key', { key: 'AIzaWrongKey_000000000000000000', consent: true })).status).toBe(422);
    expect((await c.post('/api/integrations/youtube/key', { key: 'AIzaGoodKey_1234567890abcdefghij', consent: true })).status).toBe(200);
    const v = (await c.get('/api/sports/videos?sport=basketball&skill=shooting')).json;
    expect(v.videos).toHaveLength(1); // the result from a different channel is dropped
    expect(v.videos[0]).toMatchObject({ videoId: 'vid1', title: 'Form shooting & footwork', url: 'https://www.youtube.com/watch?v=vid1', thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg' });
    const searches = yt.calls.filter((u) => u.includes('/search')).length;
    expect(yt.calls.filter((u) => u.includes('/search')).every((u) => new URL(u).searchParams.get('channelId') === 'UC_breakthrough')).toBe(true);
    await c.get('/api/sports/videos?sport=basketball&skill=shooting');
    expect(yt.calls.filter((u) => u.includes('/search')).length).toBe(searches); // served from cache
    for (const path of ['/api/integrations', '/api/account/export', '/api/sports']) expect((await c.get(path)).text).not.toContain('GoodKey');
  });

  it('ignores a channel whose name does not match', async () => {
    const { app } = setup();
    const c = await athlete(app, 'e@example.com');
    await c.post('/api/integrations/youtube/key', { key: 'AIzaGoodKey_1234567890abcdefghij', consent: true });
    // Pretend the handle resolved to an impostor.
    const yt = await import('../server/integrations/youtube');
    const id = await yt.resolveChannel({ name: 'X', handle: '@BreakthroughBBall', expectTitle: 'Totally Different', official: false }, 'AIzaGoodKey_1234567890abcdefghij', fakeYouTube().fn);
    expect(id).toBeNull();
  });
});
