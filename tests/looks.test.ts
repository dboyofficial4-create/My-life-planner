import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import type { LookAIFactory } from '../server/services/lookAI';
import type { BuildPlan, SkinAdvice } from '../shared/schemas/looks';

const NOW = new Date('2026-11-16T15:00:00Z');
const PHOTO = { mediaType: 'image/jpeg' as const, data: 'A'.repeat(2000) };

const skinResult = (o: Partial<SkinAdvice> = {}): SkinAdvice => ({
  usable: true, usableReason: '', summary: 'Mostly balanced skin with some shine.',
  observations: [{ area: 'Forehead', note: 'A few small bumps' }],
  morning: [{ step: 'Cleanse', productType: 'Gentle gel cleanser', lookFor: ['fragrance-free'], avoid: ['harsh scrubs'], why: 'Removes oil.', examples: ['Example cleanser'] },
    { step: 'Protect', productType: 'Broad-spectrum SPF 30+', lookFor: ['SPF 30'], avoid: [], why: 'Sun protection.', examples: [] }],
  evening: [{ step: 'Cleanse', productType: 'Gentle gel cleanser', lookFor: [], avoid: [], why: 'Removes sunscreen.', examples: [] }],
  weekly: [], habits: ['Change pillowcases weekly'], seeADoctorIf: ['Painful deep cysts'],
  ...o,
});
const buildResult = (o: Partial<BuildPlan> = {}): BuildPlan => ({
  usable: true, usableReason: '', summary: 'Build the upper body.',
  focusAreas: [{ area: 'Shoulders', now: 'Narrow', goal: 'Broader', focus: 'Overhead pressing' }],
  realistic: 'Expect visible change in 4 to 6 months.', timeline: '6 months',
  days: [{ day: 'Day 1', focus: 'Upper body', exercises: [{ name: 'Push-up', sets: '3', reps: '8-12', notes: 'Body straight' }] }],
  progression: ['Add 1 rep a week'],
  nutrition: ['Eat protein at every meal', 'Run a 500 kcal deficit to cut body fat'],
  recovery: ['Sleep 8 to 10 hours'], safety: ['Warm up'],
  ...o,
});

function setup(opts: { skin?: SkinAdvice; build?: BuildPlan; key?: string } = { key: 'server-key' }) {
  const calls: { kind: string; photos: number; brief: string }[] = [];
  const fake: LookAIFactory = () => ({
    async skin(photos, brief) { calls.push({ kind: 'skin', photos: photos.length, brief }); return opts.skin ?? skinResult(); },
    async build(photos, brief) { calls.push({ kind: 'build', photos: photos.length, brief }); return opts.build ?? buildResult(); },
  });
  const db = new Db(':memory:');
  return { db, calls, app: createApp(db, { secureCookies: false, now: () => NOW, encryptionKey: randomBytes(32).toString('base64'), lookAI: fake, anthropicApiKey: 'key' in opts ? opts.key : 'server-key' }) };
}

async function user(app: ReturnType<typeof createApp>, birthday: string, email = `${birthday}@example.com`) {
  const req = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), host: 'localhost' }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, text };
  };
  let cookie = '';
  await req('POST', '/api/auth/register', { email, password: 'correct horse battery', birthday });
  const done = await req('POST', '/api/onboarding/complete', {
    profile: { displayName: 'S', birthday, timezone: 'America/New_York', units: 'imperial', clock: '12h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules: ['fitness', 'skincare'] },
    goals: [], schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'any', preferredStudyTime: 'afternoon', restDays: [0], busyDays: [], commuteMinutes: 15 },
    schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' }, workHours: { enabled: false, days: [], start: '09:00', end: '17:00' }, commitments: [],
    fitness: { experience: 'some', sessionsPerWeek: 3, sessionMinutes: 45, locations: ['home'], equipment: [], accessNotes: '', limitations: ['knee'], limitationNotes: '' },
    skin: { type: 'oily', concerns: ['acne'], fragranceSensitive: true, sensitivities: '', currentProducts: '', routineSize: 'minimal' },
  });
  expect(done.status, done.text).toBe(200);
  return { get: (p: string) => req('GET', p), post: (p: string, b: unknown) => req('POST', p, b) };
}

const skinInput = (o: Record<string, unknown> = {}) => ({ photos: [], skinType: 'oily', concerns: ['breakouts'], currentProducts: '', budget: 'low', notes: '', consent: true, ...o });
const buildInput = (o: Record<string, unknown> = {}) => ({ currentPhoto: null, goalPhoto: null, goals: ['upper_body'], description: '', consent: true, ...o });

describe('skin finder and build planner', () => {
  it('under 18: photos are refused, the questions work, and diet advice is removed', async () => {
    const { app, calls } = setup();
    const teen = await user(app, '2010-03-03');
    expect((await teen.get('/api/looks/skin')).json).toMatchObject({ photosAllowed: false, aiReady: true, report: null });
    expect((await teen.post('/api/looks/skin', skinInput({ photos: [PHOTO] }))).status).toBe(403);
    expect((await teen.post('/api/looks/build', buildInput({ currentPhoto: PHOTO }))).status).toBe(403);
    expect(calls).toHaveLength(0);

    const skin = await teen.post('/api/looks/skin', skinInput());
    expect(skin.status, skin.text).toBe(201);
    expect(calls[0]!.brief).toContain('UNDER 18');
    expect(calls[0]!.brief).toContain('sensitive to fragrance');

    const build = await teen.post('/api/looks/build', buildInput());
    expect(build.status).toBe(201);
    expect(calls[1]!.brief).toMatch(/knee/);
    expect(build.json.report.result.nutrition).toEqual(['Eat protein at every meal']);
    expect((await teen.get('/api/looks/build')).json.report.result.summary).toBe('Build the upper body.');
  });

  it('adults can send photos; the photos themselves are never stored', async () => {
    const { app, db, calls } = setup();
    const adult = await user(app, '2000-01-01');
    const r = await adult.post('/api/looks/build', buildInput({ currentPhoto: PHOTO, goalPhoto: PHOTO }));
    expect(r.status, r.text).toBe(201);
    expect(calls[0]!.photos).toBe(2);
    expect(r.json.report.usedPhotos).toBe(true);
    expect(r.json.report.result.nutrition).toHaveLength(2); // adults keep their nutrition advice
    expect((await adult.post('/api/looks/skin', skinInput({ photos: [PHOTO, PHOTO] }))).status).toBe(201);
    const stored = JSON.stringify(db.all('SELECT * FROM look_reports'));
    expect(stored).not.toContain(PHOTO.data.slice(0, 200));
  });

  it('explains unusable photos, and asks for a key when there is none', async () => {
    const bad = setup({ skin: skinResult({ usable: false, usableReason: 'The photo is too dark to see your skin.' }), key: 'server-key' });
    const a = await user(bad.app, '2000-01-01');
    const r = await a.post('/api/looks/skin', skinInput({ photos: [PHOTO] }));
    expect(r.status).toBe(422);
    expect(r.json.error.message).toContain('too dark');

    const nokey = setup({ key: undefined });
    const b = await user(nokey.app, '2000-01-01');
    expect((await b.post('/api/looks/skin', skinInput())).status).toBe(409);
    expect((await b.post('/api/looks/build', buildInput({ goals: [] }))).status).toBe(422);
  });
});
