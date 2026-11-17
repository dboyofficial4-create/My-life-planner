import { beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import { normalizeBaseUrl, CanvasError } from '../server/integrations/canvas';

// Monday 16 Nov 2026, 10:00 New York.
const NOW = new Date('2026-11-16T15:00:00Z');
const TOKEN = '1234~abcdefghijklmnopqrstuvwxyzSECRET';
const HOST = 'https://school.instructure.com';

/** Minimal fake of the Canvas REST endpoints we call, with the shapes Canvas documents. */
function fakeCanvas(opts: { token?: string; weighted?: boolean; evilNext?: boolean; redirect?: boolean } = {}) {
  const calls: string[] = [];
  const json = (data: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
  const fn: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    if (opts.redirect) return new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.com/' } });
    const auth = new Headers(init?.headers).get('authorization');
    if (auth !== `Bearer ${opts.token ?? TOKEN}`) return new Response('{"errors":[{"message":"Invalid access token."}]}', { status: 401, headers: { 'content-type': 'application/json' } });
    const p = url.pathname;
    if (p === '/api/v1/users/self') return json({ id: 42, name: 'Sam Student' });
    if (p === '/api/v1/courses') {
      if (url.searchParams.get('page') !== '2') {
        const next = opts.evilNext ? 'https://evil.example.com/api/v1/courses?page=2' : `${HOST}/api/v1/courses?page=2&per_page=100`;
        return json([{ id: 101, name: 'Biology', apply_assignment_group_weights: opts.weighted ?? true, enrollments: [{ type: 'student', computed_current_score: 88.5 }] }], { link: `<${next}>; rel="next", <${HOST}/api/v1/courses?page=1>; rel="first"` });
      }
      return json([
        { id: 102, name: 'Algebra II', apply_assignment_group_weights: false, enrollments: [{ type: 'student', computed_current_score: 91 }] },
        { id: 103, name: 'Teaching Assistant Section', enrollments: [{ type: 'ta' }] },
      ]);
    }
    if (p === '/api/v1/courses/101/assignment_groups') {
      return json([
        {
          id: 1, name: 'Tests', group_weight: 60,
          assignments: [
            { id: 1001, name: 'Cell structure test', due_at: '2026-11-20T04:59:00Z', points_possible: 100, submission_types: ['on_paper'], published: true, submission: { workflow_state: 'unsubmitted', score: null } },
            { id: 1002, name: 'Unit 1 test', due_at: '2026-09-01T04:59:00Z', points_possible: 100, published: true, submission: { workflow_state: 'graded', score: 82, submitted_at: '2026-08-31T20:00:00Z' } },
          ],
        },
        {
          id: 2, name: 'Labs', group_weight: 40,
          assignments: [
            { id: 1003, name: 'Microscope lab', due_at: '2026-11-17T04:59:00Z', points_possible: 20, published: true, submission: { workflow_state: 'submitted', submitted_at: '2026-11-16T01:00:00Z', score: null } },
            { id: 1004, name: 'Draft lab (unpublished)', due_at: '2026-11-25T04:59:00Z', points_possible: 20, published: false },
            { id: 1005, name: 'Lab 1', due_at: '2026-10-01T04:59:00Z', points_possible: 20, published: true, submission: { workflow_state: 'graded', score: 19, submitted_at: '2026-09-30T20:00:00Z' } },
          ],
        },
      ]);
    }
    if (p === '/api/v1/courses/102/assignment_groups') {
      return json([{ id: 3, name: 'Homework', group_weight: 0, assignments: [{ id: 2001, name: 'Quiz 5', due_at: '2026-11-19T04:59:00Z', points_possible: 10, submission_types: ['online_quiz'], published: true, submission: { workflow_state: 'unsubmitted' } }] }]);
    }
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  };
  return { fn, calls };
}

let db: Db;
function setup(fake = fakeCanvas()) {
  db = new Db(':memory:');
  const app = createApp(db, { secureCookies: false, now: () => NOW, encryptionKey: randomBytes(32).toString('base64'), fetch: fake.fn });
  return { app, fake };
}

class Client {
  cookie = '';
  constructor(private app: ReturnType<typeof createApp>) {}
  async req(method: string, path: string, body?: unknown) {
    const res = await this.app.request(path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), host: 'localhost' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, text };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b: unknown = {}) => this.req('POST', p, b);
}

async function student(app: ReturnType<typeof createApp>, email = 's@example.com', modules = ['school', 'fitness']) {
  const c = new Client(app);
  await c.post('/api/auth/register', { email, password: 'correct horse battery', birthday: '2009-02-02' });
  const r = await c.post('/api/onboarding/complete', {
    profile: { displayName: 'Sam', birthday: '2009-02-02', timezone: 'America/New_York', units: 'imperial', clock: '12h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules },
    goals: [],
    schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'evening', preferredStudyTime: 'afternoon', restDays: [0], busyDays: [], commuteMinutes: 15 },
    schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' },
    workHours: { enabled: false, days: [], start: '09:00', end: '17:00' },
    commitments: [],
    fitness: modules.includes('fitness') ? { experience: 'some', sessionsPerWeek: 2, sessionMinutes: 45, locations: ['home'], equipment: [], accessNotes: '', limitations: [], limitationNotes: '' } : undefined,
    school: modules.includes('school') ? { stage: 'high_school', gradeLevel: '11', dailyStudyMinutes: 0, academicGoal: '' } : undefined,
    courses: modules.includes('school') ? [{ name: 'Biology', difficulty: 4, targetGrade: 90 }] : undefined,
    assessments: [],
  });
  expect(r.status, r.text).toBe(200);
  return c;
}

const connect = (c: Client, o: Record<string, unknown> = {}) => c.post('/api/integrations/canvas/token', { baseUrl: 'school.instructure.com', token: TOKEN, consent: true, ...o });

describe('Canvas address validation', () => {
  it('normalises common forms and rejects unsafe ones', () => {
    expect(normalizeBaseUrl('school.instructure.com')).toBe(HOST);
    expect(normalizeBaseUrl('https://canvas.school.edu/courses/12')).toBe('https://canvas.school.edu');
    for (const bad of ['http://school.instructure.com', 'https://127.0.0.1', 'localhost', 'https://intranet', 'https://user:pw@school.instructure.com', 'https://[::1]', '']) {
      expect(() => normalizeBaseUrl(bad), bad).toThrow(CanvasError);
    }
  });
});

describe('Canvas connection & sync', () => {
  let app: ReturnType<typeof createApp>;
  let fake: ReturnType<typeof fakeCanvas>;
  beforeEach(() => {
    ({ app, fake } = setup());
  });

  it('rejects a bad token without storing anything', async () => {
    const c = await student(app);
    const r = await connect(c, { token: 'wrong-token-but-long-enough-xyz' });
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields.token).toBeDefined();
    expect(db.get<{ n: number }>('SELECT COUNT(*) n FROM integrations')!.n).toBe(0);
  });

  it('requires explicit consent and a plausible token', async () => {
    const c = await student(app);
    expect((await connect(c, { consent: false })).status).toBe(422);
    expect((await connect(c, { token: 'short' })).status).toBe(422);
    expect(fake.calls).toHaveLength(0);
  });

  it('imports courses, assignments, weights and grades, and links same-named courses', async () => {
    const c = await student(app);
    const r = await connect(c);
    expect(r.status, r.text).toBe(200);
    expect(r.json.account).toEqual({ host: 'school.instructure.com', userName: 'Sam Student' });
    expect(r.json.summary).toMatchObject({ courses: 2, coursesCreated: 1, grades: 2 });

    const school = (await c.get('/api/school')).json;
    expect(school.courses.map((x: { name: string }) => x.name).sort()).toEqual(['Algebra II', 'Biology']);
    const bio = school.courses.find((x: { name: string }) => x.name === 'Biology');
    expect(bio).toMatchObject({ source: 'canvas', externalGrade: 88.5 });
    expect(bio.categories.map((x: { name: string; weight: number; confirmed: boolean }) => [x.name, x.weight, x.confirmed])).toEqual([['Labs', 40, true], ['Tests', 60, true]]);
    // Weighted: 0.6*82 + 0.4*95 = 87.2, with confirmed weights → not an estimate.
    expect(bio.grade.percent).toBe(87.2);
    expect(bio.grade.isEstimate).toBe(false);
    // Unweighted course gets a single points-based category.
    const alg = school.courses.find((x: { name: string }) => x.name === 'Algebra II');
    expect(alg.categories).toEqual([expect.objectContaining({ name: 'All graded work (points-based)', weight: 100, confirmed: true })]);

    const byTitle = Object.fromEntries(school.assignments.map((a: { title: string }) => [a.title, a]));
    expect(byTitle['Cell structure test']).toMatchObject({ source: 'canvas', type: 'test', dueDate: '2026-11-19', status: 'open', courseName: 'Biology' });
    expect(byTitle['Microscope lab']).toMatchObject({ status: 'done', dueDate: '2026-11-16' });
    expect(byTitle['Quiz 5']).toMatchObject({ type: 'quiz' });
    expect(byTitle['Unit 1 test']).toBeUndefined(); // older than 30 days: grade only
    expect(byTitle['Draft lab (unpublished)']).toBeUndefined();
    expect(school.courses.some((x: { name: string }) => x.name.includes('Teaching Assistant'))).toBe(false);
  });

  it('never exposes the token and stores it encrypted', async () => {
    const c = await student(app);
    await connect(c);
    const list = await c.get('/api/integrations');
    const exp = await c.get('/api/account/export');
    for (const text of [list.text, exp.text]) expect(text).not.toContain('SECRET');
    const row = db.get<{ token_enc: string }>("SELECT token_enc FROM integrations WHERE provider = 'canvas'")!;
    expect(row.token_enc).not.toContain('SECRET');
    expect(row.token_enc.startsWith('v1.')).toBe(true);
    const canvas = list.json.integrations.find((i: { id: string }) => i.id === 'canvas');
    expect(canvas.connection).toMatchObject({ status: 'connected', meta: { host: 'school.instructure.com', userName: 'Sam Student' } });
    expect(canvas.connection.lastSyncAt).toBeTruthy();
  });

  it('re-syncing updates instead of duplicating, and study time is planned for imported work', async () => {
    const c = await student(app);
    await connect(c);
    const before = (await c.get('/api/school')).json.assignments.length;
    const again = await c.post('/api/integrations/canvas/sync');
    expect(again.status).toBe(200);
    expect(again.json.summary.assignmentsCreated).toBe(0);
    expect((await c.get('/api/school')).json.assignments.length).toBe(before);
    const plan = (await c.get('/api/plan')).json;
    expect(plan.plan.stale).toBe(true);
    const preview = (await c.post('/api/plan/preview', { weekStart: '2026-11-16' })).json;
    expect(preview.changes.some((ch: { type: string; title: string }) => ch.type === 'added' && ch.title === 'Study for Cell structure test')).toBe(true);
  });

  it('only ever sends the token to the Canvas host', async () => {
    ({ app, fake } = setup(fakeCanvas({ evilNext: true })));
    const c = await student(app);
    const r = await connect(c);
    expect(r.status).toBe(422);
    expect(fake.calls.every((u) => u.startsWith(HOST))).toBe(true);
    const row = (await c.get('/api/integrations')).json.integrations.find((i: { id: string }) => i.id === 'canvas');
    expect(row.connection).toMatchObject({ status: 'error' });
    expect(row.connection.lastError).toMatch(/different site/);
  });

  it('does not follow redirects', async () => {
    ({ app, fake } = setup(fakeCanvas({ redirect: true })));
    const c = await student(app);
    const r = await connect(c);
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields.baseUrl).toMatch(/redirects/);
    expect(fake.calls).toHaveLength(1);
  });

  it('marks the connection for reconnecting when the token stops working', async () => {
    const opts: { token?: string } = {};
    ({ app, fake } = setup(fakeCanvas(opts)));
    const c = await student(app);
    expect((await connect(c)).status).toBe(200);
    opts.token = 'token-was-deleted-in-canvas'; // user deletes the token in Canvas
    const r = await c.post('/api/integrations/canvas/sync');
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe('canvas_auth');
    const row = (await c.get('/api/integrations')).json.integrations.find((i: { id: string }) => i.id === 'canvas');
    expect(row.connection.status).toBe('needs_reconnect');
    // Previously imported work is kept.
    expect((await c.get('/api/school')).json.assignments.length).toBeGreaterThan(0);
  });

  it('disconnects, optionally removing imported data', async () => {
    const c = await student(app);
    await connect(c);
    expect((await c.req('DELETE', '/api/integrations/canvas')).status).toBe(200);
    let school = (await c.get('/api/school')).json;
    expect(school.assignments.some((a: { source: string }) => a.source === 'canvas')).toBe(true);
    expect(db.get<{ n: number }>('SELECT COUNT(*) n FROM integrations')!.n).toBe(0);
    expect((await c.post('/api/integrations/canvas/sync')).status).toBe(409);
    await connect(c);
    await c.req('DELETE', '/api/integrations/canvas?removeData=1');
    school = (await c.get('/api/school')).json;
    expect(school.assignments.some((a: { source: string }) => a.source === 'canvas')).toBe(false);
    expect(school.courses.some((x: { source: string }) => x.source === 'canvas')).toBe(false);
  });

  it('keeps each user’s Canvas data separate and requires the School area', async () => {
    const a = await student(app, 'a@example.com');
    const b = await student(app, 'b@example.com');
    await connect(a);
    expect((await b.post('/api/integrations/canvas/sync')).status).toBe(409);
    expect((await b.get('/api/school')).json.assignments).toEqual([]);
    const noSchool = await student(app, 'n@example.com', ['fitness']);
    expect((await connect(noSchool)).status).toBe(404);
  });
});
