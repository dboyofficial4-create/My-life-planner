import { beforeEach, describe, expect, it } from 'vitest';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import type { OnboardingComplete } from '../shared/schemas/onboarding';

// Monday 16 Nov 2026, 10:00 in New York.
const NOW = new Date('2026-11-16T15:00:00Z');

let app: ReturnType<typeof createApp>;
let db: Db;

beforeEach(() => {
  db = new Db(':memory:');
  app = createApp(db, { secureCookies: false, now: () => NOW });
});

class Client {
  cookie = '';
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await app.request(path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), host: 'localhost', ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b: unknown = {}) => this.req('POST', p, b);
  put = (p: string, b: unknown) => this.req('PUT', p, b);
  patch = (p: string, b: unknown) => this.req('PATCH', p, b);
}

const onboarding = (o: Partial<OnboardingComplete> = {}): OnboardingComplete => ({
  profile: { displayName: 'Sam', birthday: '2008-02-02', timezone: 'America/New_York', units: 'metric', clock: '24h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules: ['fitness', 'school', 'nutrition'] },
  goals: [{ module: 'fitness', kind: 'strength', title: 'Get strong', targetDate: null, priority: 1 }],
  schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'evening', preferredStudyTime: 'afternoon', restDays: [0], busyDays: [], commuteMinutes: 15 },
  schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' },
  workHours: { enabled: false, days: [], start: '09:00', end: '17:00' },
  commitments: [],
  fitness: { experience: 'some', sessionsPerWeek: 3, sessionMinutes: 45, locations: ['home'], equipment: [], accessNotes: '', limitations: [], limitationNotes: '' },
  school: { stage: 'high_school', gradeLevel: '11', dailyStudyMinutes: 30, academicGoal: '' },
  courses: [{ name: 'Biology', difficulty: 4, targetGrade: 90 }],
  assessments: [{ title: 'Cell test', courseName: 'Biology', type: 'test', dueDate: '2026-11-20' }],
  nutrition: { diet: 'omnivore', allergies: [], avoid: [], kitchen: ['stove', 'oven', 'microwave'], cookingSkill: 'comfortable', weekdayCookMinutes: 40, householdSize: 2, mealPrepDay: null, schoolLunch: 'pack' },
  ...o,
});

async function newUser(email: string, o: Partial<OnboardingComplete> = {}) {
  const c = new Client();
  expect((await c.post('/api/auth/register', { email, password: 'correct horse battery', birthday: '2008-02-02' })).status).toBe(201);
  const done = await c.post('/api/onboarding/complete', onboarding(o));
  expect(done.status, JSON.stringify(done.json)).toBe(200);
  return c;
}

describe('auth & safety', () => {
  it('blocks self-registration under 13', async () => {
    const r = await new Client().post('/api/auth/register', { email: 'kid@example.com', password: 'longenoughpassword', birthday: '2016-01-01' });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe('age_restricted');
  });

  it('returns field errors for invalid input', async () => {
    const r = await new Client().post('/api/auth/register', { email: 'nope', password: 'short', birthday: '2008-01-01' });
    expect(r.status).toBe(422);
    expect(Object.keys(r.json.error.details.fields)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('rejects unauthenticated and cross-site requests', async () => {
    const c = await newUser('a@example.com');
    expect((await new Client().get('/api/today')).status).toBe(401);
    const form = await app.request('/api/commitments', { method: 'POST', headers: { cookie: c.cookie, 'content-type': 'application/x-www-form-urlencoded', host: 'localhost' }, body: 'a=1' });
    expect(form.status).toBe(400);
    const xsite = await c.req('POST', '/api/commitments', {}, { origin: 'https://evil.example' });
    expect(xsite.status).toBe(403);
  });

  it('signs in and out', async () => {
    await newUser('b@example.com');
    const c = new Client();
    expect((await c.post('/api/auth/login', { email: 'b@example.com', password: 'wrong password' })).status).toBe(401);
    expect((await c.post('/api/auth/login', { email: 'B@example.com', password: 'correct horse battery' })).status).toBe(200);
    expect((await c.get('/api/auth/me')).json.onboarding.completed).toBe(true);
    await c.post('/api/auth/logout');
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects body-composition goals for teens', async () => {
    const c = new Client();
    await c.post('/api/auth/register', { email: 't@example.com', password: 'correct horse battery', birthday: '2010-02-02' });
    const r = await c.post('/api/onboarding/complete', onboarding({ profile: { ...onboarding().profile, birthday: '2010-02-02' }, goals: [{ module: 'fitness', kind: 'body_composition', title: 'Lose weight', targetDate: null, priority: 1 }] }));
    expect(r.status).toBe(422);
  });
});

describe('onboarding', () => {
  it('saves drafts and resumes where the user left off', async () => {
    const c = new Client();
    await c.post('/api/auth/register', { email: 'r@example.com', password: 'correct horse battery', birthday: '2008-02-02' });
    expect((await c.put('/api/onboarding', { step: 'schedule', draft: { profile: { displayName: 'R' } } })).status).toBe(200);
    const again = new Client();
    await again.post('/api/auth/login', { email: 'r@example.com', password: 'correct horse battery' });
    const r = await again.get('/api/onboarding');
    expect(r.json).toMatchObject({ step: 'schedule', draft: { profile: { displayName: 'R' } }, completed: false });
    expect((await again.get('/api/today')).status).toBe(409);
  });

  it('creates a first plan that respects school hours', async () => {
    const c = await newUser('p@example.com');
    const plan = (await c.get('/api/plan')).json;
    expect(plan.items.length).toBeGreaterThan(10);
    const school = plan.items.filter((i: { title: string }) => i.title === 'School');
    expect(school).toHaveLength(5);
    for (const it of plan.items.filter((i: { source: string }) => i.source === 'generated')) {
      const s = school.find((x: { date: string }) => x.date === it.date);
      if (s) expect(it.end <= s.start - 15 || it.start >= s.end + 15).toBe(true);
    }
    // Nothing placed before "now" (10:00) today.
    for (const it of plan.items.filter((i: { date: string; source: string }) => i.date === '2026-11-16' && i.source === 'generated')) expect(it.start).toBeGreaterThanOrEqual(600);
    // Study for the Friday test is scheduled before Friday.
    const study = plan.items.filter((i: { category: string; title: string }) => i.category === 'study' && i.title.includes('Cell test'));
    expect(study.length).toBeGreaterThan(0);
    for (const s of study) expect(s.date < '2026-11-20').toBe(true);
  });

  it('only stores data for chosen modules', async () => {
    const c = await newUser('m@example.com', { profile: { ...onboarding().profile, modules: ['fitness'] }, skin: { type: 'dry', concerns: [], fragranceSensitive: false, sensitivities: '', currentProducts: '', routineSize: 'minimal' } });
    const s = (await c.get('/api/settings')).json.settings;
    expect(s.skin).toBeUndefined();
    expect(s.nutrition).toBeUndefined();
    expect((await c.get('/api/school')).status).toBe(404);
  });
});

describe('per-user isolation', () => {
  it('prevents users from reading or changing each other’s records', async () => {
    const a = await newUser('iso-a@example.com');
    const b = await newUser('iso-b@example.com');
    const aItem = (await a.get('/api/plan')).json.items.find((i: { source: string }) => i.source === 'generated');
    expect((await b.patch(`/api/plan/items/${aItem.id}`, { action: 'skip' })).status).toBe(404);
    const aCommit = (await a.get('/api/commitments')).json.commitments[0];
    expect((await b.req('DELETE', `/api/commitments/${aCommit.id}`)).status).toBe(404);
    const aCourse = (await a.get('/api/school')).json.courses[0];
    expect((await b.post('/api/school/assignments', { courseId: aCourse.id, title: 'x', type: 'homework', dueDate: '2026-11-20', estimatedMinutes: 30, notes: '' })).status).toBe(404);
    expect((await b.get('/api/school')).json.assignments.every((x: { title: string }) => x.title !== 'Lab')).toBe(true);
    const exportB = (await b.get('/api/account/export')).json;
    expect(JSON.stringify(exportB)).not.toContain('iso-a@example.com');
    expect((await a.get(`/api/plan`)).json.items.find((i: { id: string }) => i.id === aItem.id).status).toBe('planned');
  });
});

describe('editing & replanning', () => {
  it('completes, skips, reopens and shortens activities', async () => {
    const c = await newUser('e@example.com');
    const item = (await c.get('/api/plan')).json.items.find((i: { category: string }) => i.category === 'workout');
    expect((await c.patch(`/api/plan/items/${item.id}`, { action: 'complete', effort: 7, discomfort: 1 })).json.item.status).toBe('done');
    expect((await c.patch(`/api/plan/items/${item.id}`, { action: 'reopen' })).json.item.status).toBe('planned');
    expect((await c.patch(`/api/plan/items/${item.id}`, { action: 'skip' })).json.item.status).toBe('skipped');
    const short = await c.patch(`/api/plan/items/${item.id}`, { action: 'shorten', minutes: 20 });
    expect(short.json.item.end - short.json.item.start).toBe(20);
  });

  it('refuses moves that overlap other activities and locks moved items', async () => {
    const c = await newUser('mv@example.com');
    const items = (await c.get('/api/plan')).json.items;
    const workout = items.find((i: { category: string; date: string }) => i.category === 'workout');
    const clash = await c.patch(`/api/plan/items/${workout.id}`, { action: 'move', date: '2026-11-17', start: '09:00' });
    expect(clash.status).toBe(409);
    expect(clash.json.error.message).toMatch(/School/);
    const school = items.find((i: { title: string }) => i.title === 'School');
    expect((await c.patch(`/api/plan/items/${school.id}`, { action: 'move', date: '2026-11-17', start: '18:00' })).status).toBe(400);
  });

  it('previews changes after a new commitment and keeps locked items on apply', async () => {
    const c = await newUser('rp@example.com');
    const items = (await c.get('/api/plan')).json.items;
    const workouts = items.filter((i: { category: string; date: string }) => i.category === 'workout' && i.date > '2026-11-16');
    const locked = workouts[0];
    await c.patch(`/api/plan/items/${locked.id}`, { action: 'lock', locked: true });
    // A rehearsal that covers every evening, including the locked workout's slot.
    const add = await c.post('/api/commitments', { kind: 'other', title: 'Rehearsal', recurrence: { type: 'weekly', days: [1, 2, 3, 4, 5, 6] }, start: '16:00', end: '21:30', travelBefore: 0, travelAfter: 0, location: '', intensity: 0 });
    expect(add.status).toBe(201);
    const stale = (await c.get('/api/plan')).json;
    expect(stale.plan.stale).toBe(true);
    const preview = (await c.post('/api/plan/preview', { weekStart: '2026-11-16' })).json;
    expect(preview.changes.some((ch: { type: string; title: string }) => ch.type === 'added' && ch.title === 'Rehearsal')).toBe(true);
    expect(preview.changes.some((ch: { from?: { id: string } }) => ch.from?.id === locked.id)).toBe(false);
    // Nothing changed until the user approves.
    expect((await c.get('/api/plan')).json.items.length).toBe(stale.items.length);
    expect((await c.post('/api/plan/apply', { proposalId: preview.proposalId })).status).toBe(200);
    const after = (await c.get('/api/plan')).json;
    expect(after.plan.stale).toBe(false);
    const keptLocked = after.items.find((i: { id: string }) => i.id === locked.id);
    expect(keptLocked).toMatchObject({ start: locked.start, end: locked.end, locked: true });
    // Second apply of the same proposal is rejected.
    expect((await c.post('/api/plan/apply', { proposalId: preview.proposalId })).status).toBe(404);
  });

  it('rejects stale previews if the plan changed in between', async () => {
    const c = await newUser('st@example.com');
    const preview = (await c.post('/api/plan/preview', { weekStart: '2026-11-16' })).json;
    const item = (await c.get('/api/plan')).json.items.find((i: { source: string }) => i.source === 'generated');
    await c.patch(`/api/plan/items/${item.id}`, { action: 'skip' });
    expect((await c.post('/api/plan/apply', { proposalId: preview.proposalId })).status).toBe(409);
  });
});

describe('food', () => {
  it('updates grocery quantities when a meal or its servings change', async () => {
    const c = await newUser('f@example.com');
    const food = (await c.get('/api/food')).json;
    const dinner = food.entries.find((e: { slot: string; leftoverOf: unknown; recipeId: string | null }) => e.slot === 'dinner' && !e.leftoverOf && e.recipeId);
    const total = (f: typeof food, key: string) => f.grocery.sections.flatMap((s: { items: { key: string; baseQty: number }[] }) => s.items).find((i: { key: string }) => i.key === key)?.baseQty ?? 0;
    const recipe = (await c.get(`/api/food/recipes/${dinner.recipeId}`)).json.recipe;
    const ing = recipe.ingredients[0].key;
    const before = total(food, ing);
    const more = (await c.patch(`/api/food/entries/${dinner.id}`, { servings: dinner.servings + 2 })).json;
    expect(total(more, ing)).toBeGreaterThan(before);
    const swapped = (await c.patch(`/api/food/entries/${dinner.id}`, { recipeId: null, label: 'Eating out' })).json;
    expect(total(swapped, ing)).toBeLessThan(total(more, ing));
  });

  it('refuses recipes that conflict with allergies', async () => {
    const c = await newUser('al@example.com', { nutrition: { ...onboarding().nutrition!, allergies: ['peanut'] } });
    const food = (await c.get('/api/food')).json;
    const breakfast = food.entries.find((e: { slot: string }) => e.slot === 'breakfast');
    const r = await c.patch(`/api/food/entries/${breakfast.id}`, { recipeId: 'apple_pb' });
    expect(r.status).toBe(422);
    expect(r.json.error.message).toMatch(/peanut/);
  });
});

describe('integrations', () => {
  it('reports honest status and fails clearly without credentials', async () => {
    const c = await newUser('i@example.com');
    const list = (await c.get('/api/integrations')).json.integrations;
    expect(list.find((i: { id: string }) => i.id === 'canvas')).toMatchObject({ configured: false, status: 'needs_credentials' });
    expect(list.find((i: { id: string }) => i.id === 'home_access_center').status).toBe('not_supported');
    expect((await c.post('/api/integrations/canvas/connect')).status).toBe(503);
    expect((await c.post('/api/integrations/home_access_center/connect')).status).toBe(501);
  });

  it('imports assignments from an .ics file with a preview step', async () => {
    const c = await newUser('ics@example.com');
    const text = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x1', 'SUMMARY:Lab write-up [Chemistry]', 'DTSTART;VALUE=DATE:20261123', 'END:VEVENT', 'END:VCALENDAR'].join('\n');
    const dry = (await c.post('/api/school/import-ics', { text, dryRun: true })).json;
    expect(dry.events).toHaveLength(1);
    expect((await c.get('/api/school')).json.assignments.some((a: { title: string }) => a.title === 'Lab write-up')).toBe(false);
    expect((await c.post('/api/school/import-ics', { text, dryRun: false })).json.created).toBe(1);
    expect((await c.post('/api/school/import-ics', { text, dryRun: false })).json.created).toBe(0);
    const s = (await c.get('/api/school')).json;
    expect(s.assignments.find((a: { title: string }) => a.title === 'Lab write-up')).toMatchObject({ source: 'import:ics', courseName: 'Chemistry' });
  });
});

describe('demo & account', () => {
  it('creates a labelled demo account with a full plan', async () => {
    const c = new Client();
    expect((await c.post('/api/auth/demo')).status).toBe(201);
    const me = (await c.get('/api/auth/me')).json;
    expect(me.user.isDemo).toBe(true);
    const today = (await c.get('/api/today')).json;
    expect(today.items.length).toBeGreaterThan(3);
    expect((await c.get('/api/fitness')).json.program.workouts.length).toBe(2);
  });

  it('deletes all of a user’s data', async () => {
    const c = await newUser('del@example.com');
    expect((await c.post('/api/account/delete', { confirm: 'DELETE' })).status).toBe(200);
    for (const t of ['plan_items', 'commitments', 'settings', 'meal_entries', 'assignments', 'sessions']) {
      expect(db.get<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`)!.n).toBe(0);
    }
  });
});
