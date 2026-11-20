import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Db } from '../server/db';
import { createApp, type AppConfig } from '../server/app';
import { backupDaily } from '../server/services/backup';
import type { Mailer } from '../server/services/mail';

function setup(extra: Partial<AppConfig> = {}) {
  const db = new Db(':memory:');
  return { db, app: createApp(db, { secureCookies: false, ...extra }) };
}

function client(app: ReturnType<typeof createApp>, headers: Record<string, string> = {}) {
  let cookie = '';
  const req = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { host: 'localhost', ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };
  return { get: (p: string) => req('GET', p), post: (p: string, b: unknown = {}) => req('POST', p, b), get cookie() { return cookie; } };
}

const PW = 'correct horse battery';
async function account(app: ReturnType<typeof createApp>, email = 'sam@example.com') {
  const c = client(app);
  expect((await c.post('/api/auth/register', { email, password: PW, birthday: '2008-02-02' })).status).toBe(201);
  return c;
}

describe('recovery code', () => {
  it('is shown once, works once, and signs every other device out', async () => {
    const { app } = setup();
    const laptop = await account(app);
    const phone = client(app);
    await phone.post('/api/auth/login', { email: 'sam@example.com', password: PW });
    expect((await laptop.get('/api/account/security')).json).toMatchObject({ recoveryCodeCreatedAt: null, emailReset: false });
    expect((await laptop.post('/api/account/recovery-code', { password: 'wrong password!' })).status).toBe(401);
    const made = await laptop.post('/api/account/recovery-code', { password: PW });
    expect(made.status).toBe(201);
    const code: string = made.json.code;
    expect(code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    expect(code).not.toMatch(/[01OILUV]/);
    expect((await laptop.get('/api/account/security')).json.recoveryCodeCreatedAt).toBeTruthy();

    const stranger = client(app);
    expect((await stranger.post('/api/auth/recover', { email: 'sam@example.com', code: 'AAAAA-AAAAA-AAAAA-AAAAA', password: 'a brand new password' })).status).toBe(401);
    expect((await stranger.post('/api/auth/recover', { email: 'nobody@example.com', code, password: 'a brand new password' })).json.error.message).toBe('That email and recovery code don’t match.');
    // typed loosely: lower case, spaces instead of dashes
    const ok = await stranger.post('/api/auth/recover', { email: 'Sam@Example.com', code: code.toLowerCase().replace(/-/g, ' '), password: 'a brand new password' });
    expect(ok.status).toBe(200);
    expect((await stranger.get('/api/auth/me')).status).toBe(200);
    expect((await laptop.get('/api/auth/me')).status).toBe(401);
    expect((await phone.get('/api/auth/me')).status).toBe(401);
    // used up
    expect((await client(app).post('/api/auth/recover', { email: 'sam@example.com', code, password: 'another new password' })).status).toBe(401);
    expect((await client(app).post('/api/auth/login', { email: 'sam@example.com', password: PW })).status).toBe(401);
    expect((await client(app).post('/api/auth/login', { email: 'sam@example.com', password: 'a brand new password' })).status).toBe(200);
  });

  it('limits guesses per account, and the demo has none', async () => {
    const { app } = setup();
    await account(app);
    const g = client(app);
    const tries = [];
    for (let i = 0; i < 6; i++) tries.push((await g.post('/api/auth/recover', { email: 'sam@example.com', code: `AAAAA-AAAAA-AAAAA-AAAA${i}`, password: 'a brand new password' })).status);
    expect(tries.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(tries[5]).toBe(429);
    const demo = client(app);
    await demo.post('/api/auth/demo');
    expect((await demo.post('/api/account/recovery-code', { password: 'x' })).status).toBe(403);
  });
});

describe('change password', () => {
  it('needs the current password and signs other devices out, not this one', async () => {
    const { app } = setup();
    const laptop = await account(app);
    const phone = client(app);
    await phone.post('/api/auth/login', { email: 'sam@example.com', password: PW });
    expect((await laptop.post('/api/account/password', { current: 'nope nope nope', password: 'a new password here' })).status).toBe(401);
    expect((await laptop.post('/api/account/password', { current: PW, password: 'short' })).status).toBe(422);
    expect((await laptop.post('/api/account/password', { current: PW, password: 'a new password here' })).status).toBe(200);
    expect((await laptop.get('/api/auth/me')).status).toBe(200);
    expect((await phone.get('/api/auth/me')).status).toBe(401);
    expect((await client(app).post('/api/auth/login', { email: 'sam@example.com', password: 'a new password here' })).status).toBe(200);
  });
});

describe('email reset link', () => {
  it('is off without email settings', async () => {
    const { app } = setup();
    expect((await client(app).get('/api/auth/recovery-options')).json).toEqual({ code: true, email: false });
    expect((await client(app).post('/api/auth/forgot', { email: 'sam@example.com' })).status).toBe(503);
  });

  it('emails a one-time link that expires, and never reveals whether an account exists', async () => {
    const sent: { to: string; text: string }[] = [];
    const mailer: Mailer = { async send(m) { sent.push(m); } };
    let now = Date.now();
    const realNow = Date.now;
    const { app } = setup({ mailer, appUrl: 'https://waypoint.example.com/' });
    await account(app);
    expect((await client(app).get('/api/auth/recovery-options')).json.email).toBe(true);
    const anon = client(app);
    const a = await anon.post('/api/auth/forgot', { email: 'nobody@example.com' });
    const b = await anon.post('/api/auth/forgot', { email: 'sam@example.com' });
    expect(a).toEqual(b);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('sam@example.com');
    const link = sent[0]!.text.match(/https:\/\/waypoint\.example\.com\/reset\?token=(\S+)/);
    expect(link).toBeTruthy();
    const token = decodeURIComponent(link![1]!);
    expect((await anon.post('/api/auth/reset', { token, password: 'reset via email ok' })).status).toBe(200);
    expect((await anon.post('/api/auth/reset', { token, password: 'try to reuse it' })).status).toBe(400);
    expect((await client(app).post('/api/auth/login', { email: 'sam@example.com', password: 'reset via email ok' })).status).toBe(200);

    // an expired link
    await anon.post('/api/auth/forgot', { email: 'sam@example.com' });
    const token2 = decodeURIComponent(sent[1]!.text.match(/token=(\S+)/)![1]!);
    try {
      now += 31 * 60_000;
      Date.now = () => now;
      expect((await anon.post('/api/auth/reset', { token: token2, password: 'too late for this' })).status).toBe(400);
    } finally {
      Date.now = realNow;
    }
  });

  it('builds links from APP_URL, never from the request’s Host header', async () => {
    const sent: { text: string }[] = [];
    const { app } = setup({ mailer: { async send(m) { sent.push(m); } }, appUrl: 'https://waypoint.example.com' });
    await account(app);
    await client(app, { host: 'evil.example.net', 'x-forwarded-host': 'evil.example.net' }).post('/api/auth/forgot', { email: 'sam@example.com' });
    expect(sent.every((m) => !m.text.includes('evil'))).toBe(true);
  });
});

describe('rate limits behind a proxy', () => {
  it('uses the proxy’s entry, not one the client made up', async () => {
    const { app } = setup({ trustProxy: true });
    await account(app);
    const statuses: number[] = [];
    // a client rotating fake first entries still shares the proxy-added last entry
    for (let i = 0; i < 21; i++) statuses.push((await client(app, { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.9` }).post('/api/auth/recover', { email: `x${i}@example.com`, code: 'AAAAA', password: 'a brand new password' })).status);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('daily backups', () => {
  it('keeps one copy a day, newest seven', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wp-backup-'));
    const db = new Db(':memory:');
    for (let d = 1; d <= 5; d++) writeFileSync(join(dir, `waypoint-2026-10-0${d}.db`), 'old');
    for (let d = 10; d <= 13; d++) writeFileSync(join(dir, `waypoint-2026-10-${d}.db`), 'old');
    expect(backupDaily(db, dir, new Date('2026-11-20T12:00:00Z'))).toBe('waypoint-2026-11-20.db');
    expect(backupDaily(db, dir, new Date('2026-11-20T18:00:00Z'))).toBeNull();
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(7);
    expect(files.at(-1)).toBe('waypoint-2026-11-20.db');
  });
});

describe('sign-up code', () => {
  it('is required only when the server sets one', async () => {
    const open = setup();
    expect((await client(open.app).get('/api/auth/signup-options')).json).toEqual({ codeRequired: false });
    const closed = setup({ signupCode: 'team-2026' });
    const c = client(closed.app);
    expect((await c.get('/api/auth/signup-options')).json).toEqual({ codeRequired: true });
    const base = { email: 'new@example.com', password: PW, birthday: '2008-02-02' };
    expect((await c.post('/api/auth/register', base)).status).toBe(403);
    expect((await c.post('/api/auth/register', { ...base, signupCode: 'wrong' })).status).toBe(403);
    expect((await c.post('/api/auth/register', { ...base, signupCode: ' team-2026 ' })).status).toBe(201);
  });
});
