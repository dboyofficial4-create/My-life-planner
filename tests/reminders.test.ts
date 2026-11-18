import { describe, expect, it } from 'vitest';
import { createPublicKey, randomBytes, verify } from 'node:crypto';
import { Db } from '../server/db';
import { createApp } from '../server/app';
import { DEFAULT_REMINDERS, dueReminders, type ReminderInput, type ReminderItem } from '../shared/domain/reminders';
import { generateVapidKeys, isAllowedEndpoint, sendPush, vapidAuthorization } from '../server/integrations/webpush';
import { runReminders } from '../server/services/reminders';

const TODAY = '2026-11-16';
const item = (o: Partial<ReminderItem> = {}): ReminderItem => ({ id: 'w1', date: TODAY, start: 17 * 60, end: 17 * 60 + 45, title: 'Full body A workout', category: 'workout', source: 'generated', status: 'planned', ...o });
const input = (o: Partial<ReminderInput> = {}): ReminderInput => ({
  today: TODAY, nowMinute: 17 * 60 - 10, awake: { start: 6 * 60 + 30, end: 22 * 60 + 30 }, clock: '12h', settings: DEFAULT_REMINDERS, items: [item()], assignments: [], cardsDue: 0, ...o,
});
const keys = (i: Partial<ReminderInput>) => dueReminders(input(i)).map((r) => r.key.split(':')[0]);

describe('reminder rules', () => {
  it('reminds before an activity, once its lead time arrives, and not long after', () => {
    expect(dueReminders(input())[0]).toMatchObject({ kind: 'activity', title: 'In 10 min: Full body A workout', body: '5:00 PM–5:45 PM' });
    expect(keys({ nowMinute: 17 * 60 - 11 })).not.toContain('act');
    expect(keys({ nowMinute: 17 * 60 + 10 })).not.toContain('act'); // more than 15 min late: skip
  });

  it('skips done/skipped items and routine school/work hours, but includes practices', () => {
    expect(keys({ items: [item({ status: 'done' })] })).toEqual([]);
    const school = item({ id: 's', source: 'fixed', category: 'commitment', commitmentKind: 'school', start: 8 * 60, end: 15 * 60 });
    const practice = item({ id: 'p', source: 'fixed', category: 'sport', commitmentKind: 'practice', start: 15 * 60 + 45, end: 17 * 60 + 45 });
    expect(dueReminders(input({ items: [school], nowMinute: 7 * 60 + 50 })).filter((r) => r.kind === 'activity')).toEqual([]);
    expect(dueReminders(input({ items: [practice], nowMinute: 15 * 60 + 35 }))[0]!.title).toBe('In 10 min: Full body A workout');
  });

  it('respects quiet hours and settings toggles', () => {
    expect(dueReminders(input({ items: [item({ start: 23 * 60, end: 23 * 60 + 30 })], nowMinute: 22 * 60 + 50 }))).toEqual([]);
    expect(dueReminders(input({ settings: { ...DEFAULT_REMINDERS, enabled: false } }))).toEqual([]);
    expect(dueReminders(input({ settings: { ...DEFAULT_REMINDERS, activities: { ...DEFAULT_REMINDERS.activities, training: false } } }))).toEqual([]);
    expect(dueReminders(input({ settings: { ...DEFAULT_REMINDERS, leadMinutes: 30 }, nowMinute: 16 * 60 + 30 }))[0]!.title).toBe('In 30 min: Full body A workout');
  });

  it('nudges about a missed study or training session without guilt', () => {
    const r = dueReminders(input({ nowMinute: 17 * 60 + 45 + 30 })).find((x) => x.kind === 'missed');
    expect(r?.title).toBe('Still want to do Full body A workout?');
    expect(dueReminders(input({ nowMinute: 17 * 60 + 45 + 30, items: [item({ status: 'done' })] }))).toEqual([]);
  });

  it('warns about deadlines 3 days, 1 day and the day of', () => {
    const a = (dueDate: string, type = 'test') => ({ id: 'a1', title: 'Cell test', type, dueDate, status: 'open' as const, courseName: 'Biology' });
    const at = (dueDate: string, nowMinute: number, type?: string) => dueReminders(input({ items: [], nowMinute, assignments: [a(dueDate, type)] })).filter((r) => r.kind === 'deadline').map((r) => r.title);
    expect(at('2026-11-19', 17 * 60)).toEqual(['Test in 3 days: Cell test (Biology)']);
    expect(at('2026-11-19', 17 * 60, 'homework')).toEqual([]); // homework doesn't get the 3-day warning
    expect(at('2026-11-17', 18 * 60)).toEqual(['Due tomorrow: Cell test (Biology)']);
    expect(at('2026-11-16', 6 * 60 + 50)).toEqual(['Due today: Cell test (Biology)']);
    expect(dueReminders(input({ items: [], nowMinute: 18 * 60, assignments: [{ ...a('2026-11-17'), status: 'done' }] }))).toEqual([]);
  });

  it('sends a morning summary and a flashcard reminder', () => {
    const r = dueReminders(input({ nowMinute: 6 * 60 + 45, cardsDue: 0 }));
    expect(r.find((x) => x.kind === 'morning')?.body).toBe('1 planned: first is Full body A workout at 5:00 PM.');
    const study = item({ id: 'st', category: 'study', title: 'Study for Cell test', start: 16 * 60, end: 16 * 60 + 40 });
    expect(dueReminders(input({ items: [study], cardsDue: 12, nowMinute: 16 * 60 })).find((x) => x.kind === 'flashcards')?.title).toBe('12 flashcards due');
  });
});

describe('web push', () => {
  const vapid = generateVapidKeys();

  it('only sends to real push services', () => {
    expect(isAllowedEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isAllowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isAllowedEndpoint('https://wns2-bl2p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isAllowedEndpoint('https://web.push.apple.com/abc')).toBe(true);
    for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'https://localhost/x', 'https://fcm.googleapis.com:8443/x']) expect(isAllowedEndpoint(bad), bad).toBe(false);
  });

  it('signs a valid VAPID JWT that verifies with the public key', () => {
    const header = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', vapid, 'mailto:a@example.com', Date.UTC(2026, 10, 16));
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(m).toBeTruthy();
    expect(m[4]).toBe(vapid.publicKey);
    const claims = JSON.parse(Buffer.from(m[2]!, 'base64url').toString());
    expect(claims).toMatchObject({ aud: 'https://fcm.googleapis.com', sub: 'mailto:a@example.com' });
    const raw = Buffer.from(vapid.publicKey, 'base64url');
    const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
    expect(verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3]!, 'base64url'))).toBe(true);
  });

  it('reports expired subscriptions so they can be removed, and sends no payload', async () => {
    let seen: RequestInit | undefined;
    const ok = await sendPush('https://fcm.googleapis.com/fcm/send/abc', vapid, 'mailto:a@example.com', (async (_u: unknown, init?: RequestInit) => { seen = init; return new Response(null, { status: 201 }); }) as typeof fetch);
    expect(ok).toBe('sent');
    expect(seen?.body).toBeUndefined();
    expect(new Headers(seen?.headers).get('TTL')).toBe('3600');
    expect(await sendPush('https://fcm.googleapis.com/fcm/send/abc', vapid, 'x', (async () => new Response(null, { status: 410 })) as typeof fetch)).toBe('gone');
    expect(await sendPush('https://fcm.googleapis.com/fcm/send/abc', vapid, 'x', (async () => { throw new Error('offline'); }) as typeof fetch)).toBe('failed');
  });
});

/* ---------- end to end through the API ---------- */

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

describe('reminders end to end', () => {
  // Monday 16 Nov 2026, 5:00 PM New York.
  let now = new Date('2026-11-16T22:00:00Z');
  const pushes: string[] = [];
  const fakeFetch = (async (u: unknown) => {
    pushes.push(String(u));
    return new Response(null, { status: String(u).includes('expired') ? 410 : 201 });
  }) as typeof fetch;
  const setup = () => {
    const db = new Db(':memory:');
    const config = { secureCookies: false, now: () => now, encryptionKey: randomBytes(32).toString('base64'), vapid: generateVapidKeys(), vapidSubject: 'mailto:t@example.com', fetch: fakeFetch };
    return { db, config, app: createApp(db, config) };
  };
  async function student(app: ReturnType<typeof createApp>, email: string) {
    const c = new Client(app);
    await c.post('/api/auth/register', { email, password: 'correct horse battery', birthday: '2009-02-02' });
    await c.post('/api/onboarding/complete', {
      profile: { displayName: 'S', birthday: '2009-02-02', timezone: 'America/New_York', units: 'imperial', clock: '12h', heightCm: null, weightKg: null, activityLevel: 'moderate', budget: 'moderate', accessibilityNotes: '', modules: ['school'] },
      goals: [], schedule: { lifeStage: 'student', wakeWeekday: '06:30', sleepWeekday: '22:30', wakeWeekend: '08:00', sleepWeekend: '23:00', preferredWorkoutTime: 'any', preferredStudyTime: 'evening', restDays: [0], busyDays: [], commuteMinutes: 15 },
      schoolHours: { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' }, workHours: { enabled: false, days: [], start: '09:00', end: '17:00' }, commitments: [],
      school: { stage: 'high_school', gradeLevel: '10', dailyStudyMinutes: 0, academicGoal: '' },
      courses: [{ name: 'Biology', difficulty: 3, targetGrade: null }],
      assessments: [{ title: 'Cell test', courseName: 'Biology', type: 'test', dueDate: '2026-11-17' }],
    });
    return c;
  }

  it('creates each reminder once, pushes to subscribed devices, and drops expired ones', async () => {
    const { app, db, config } = setup();
    const c = await student(app, 'r@example.com');
    expect((await c.post('/api/reminders/subscribe', { endpoint: 'https://evil.example.com/push' })).status).toBe(422);
    expect((await c.post('/api/reminders/subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/device1' })).status).toBe(200);
    expect((await c.post('/api/reminders/subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/expired' })).status).toBe(200);

    now = new Date('2026-11-16T23:00:00Z'); // 6:00 PM: "Due tomorrow" fires
    const first = await runReminders(db, config, now);
    expect(first.created).toBeGreaterThanOrEqual(1);
    expect(pushes).toContain('https://fcm.googleapis.com/fcm/send/device1');
    expect((await c.get('/api/reminders/push-key')).json.devices).toBe(1); // expired one removed

    const again = await runReminders(db, config, now);
    expect(again.created).toBe(0); // never sent twice

    const list = (await c.get('/api/notifications')).json;
    expect(list.items.map((n: { title: string }) => n.title)).toContain('Due tomorrow: Cell test (Biology)');
    expect(list.unread).toBeGreaterThan(0);
    // Every device's service worker can fetch the same recent reminders (they de-duplicate by key).
    const recent = (await c.get('/api/notifications/recent')).json.items;
    expect(recent.length).toBeGreaterThan(0);
    expect((await c.get('/api/notifications/recent')).json.items).toEqual(recent);
    await c.post('/api/notifications/read');
    expect((await c.get('/api/notifications')).json.unread).toBe(0);
  });

  it('honours turning reminders off, and keeps accounts separate', async () => {
    const { app, db, config } = setup();
    const a = await student(app, 'a@example.com');
    const b = await student(app, 'b@example.com');
    const settings = (await b.get('/api/settings')).json.settings;
    expect(settings.reminders).toBeUndefined();
    expect((await b.req('PUT', '/api/settings/reminders', { ...DEFAULT_REMINDERS, enabled: false })).status).toBe(200);
    expect((await b.get('/api/plan')).json.plan.stale).toBe(false); // changing reminders doesn't ask to replan
    now = new Date('2026-11-16T23:00:00Z');
    await runReminders(db, config, now);
    expect((await a.get('/api/notifications')).json.items.length).toBeGreaterThan(0);
    expect((await b.get('/api/notifications')).json.items).toEqual([]);
  });

  it('sends a test reminder', async () => {
    const { app } = setup();
    const c = await student(app, 't@example.com');
    await c.post('/api/reminders/subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/dev' });
    expect((await c.post('/api/reminders/test')).json).toEqual({ ok: true, devices: 1 });
    expect((await c.get('/api/notifications')).json.items[0].title).toBe('Reminders are working');
  });
});
