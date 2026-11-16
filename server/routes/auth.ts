import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../app';
import { SESSION_COOKIE } from '../app';
import { body, HttpError } from '../http';
import { hashPassword, newToken, sha256, verifyPassword } from '../auth/crypto';
import { LoginInput, RegisterInput } from '../../shared/schemas';
import { agePolicy } from '../../shared/domain/age';
import { todayIn } from '../../shared/domain/time';
import { seedDemo } from '../services/demo';

export const authRoutes = new Hono<AppEnv>();

const SESSION_DAYS = 30;
const DEMO_HOURS = 24;

/* Simple in-memory limiter for credential endpoints (per app instance). */
function limit(c: Context<AppEnv>, key: string, max: number, windowMs: number) {
  const attempts = c.var.limiter;
  const t = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < t) {
    attempts.set(key, { count: 1, resetAt: t + windowMs });
    return;
  }
  a.count++;
  if (a.count > max) throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.');
}
const clientKey = (c: Context<AppEnv>) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

function startSession(c: Context<AppEnv>, userId: string, hours = SESSION_DAYS * 24) {
  const token = newToken();
  c.var.db.run('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', sha256(token), userId, Date.now() + hours * 3_600_000, new Date().toISOString());
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: c.var.config.secureCookies, sameSite: 'Lax', path: '/', maxAge: hours * 3600 });
}

authRoutes.post('/register', async (c) => {
  limit(c, `register:${clientKey(c)}`, 10, 15 * 60_000);
  const input = await body(c, RegisterInput);
  const policy = agePolicy(input.birthday, todayIn('UTC', c.var.now()));
  if (!policy.canSelfRegister) {
    throw new HttpError(403, 'age_restricted', 'Waypoint isn’t available for people under 13 yet. Accounts for younger users will need a parent or guardian.');
  }
  if (c.var.db.get('SELECT 1 FROM users WHERE email = ?', input.email)) {
    throw new HttpError(409, 'email_taken', 'An account with this email already exists. Try signing in.', { fields: { email: 'Already registered' } });
  }
  const id = randomUUID();
  c.var.db.run('INSERT INTO users (id, email, password_hash, birthday, is_demo, created_at) VALUES (?, ?, ?, ?, 0, ?)', id, input.email, await hashPassword(input.password), input.birthday, new Date().toISOString());
  startSession(c, id);
  return c.json({ user: { id, email: input.email, isDemo: false } }, 201);
});

authRoutes.post('/login', async (c) => {
  const input = await body(c, LoginInput);
  limit(c, `login:${clientKey(c)}:${input.email}`, 8, 15 * 60_000);
  const user = c.var.db.get<{ id: string; password_hash: string; is_demo: number }>('SELECT id, password_hash, is_demo FROM users WHERE email = ?', input.email);
  // Same response for unknown email and wrong password.
  const ok = user ? await verifyPassword(input.password, user.password_hash) : (await hashPassword(input.password), false);
  if (!user || !ok || user.is_demo) throw new HttpError(401, 'bad_credentials', 'That email and password don’t match.');
  startSession(c, user.id);
  return c.json({ user: { id: user.id, email: input.email, isDemo: false } });
});

authRoutes.post('/demo', async (c) => {
  limit(c, `demo:${clientKey(c)}`, 20, 60 * 60_000);
  const id = randomUUID();
  c.var.db.run(
    'INSERT INTO users (id, email, password_hash, birthday, is_demo, created_at) VALUES (?, ?, ?, ?, 1, ?)',
    id, `demo-${id}@demo.invalid`, 'demo-no-login', '2009-03-14', new Date().toISOString(),
  );
  seedDemo(c.var.db, id, c.var.now());
  startSession(c, id, DEMO_HOURS);
  return c.json({ user: { id, email: 'Demo account', isDemo: true } }, 201);
});

authRoutes.post('/logout', (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) c.var.db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', (c) => {
  const store = c.var.store;
  const user = c.var.db.get<{ email: string; birthday: string }>('SELECT email, birthday FROM users WHERE id = ?', c.var.userId)!;
  const ob = store.getOnboarding();
  const settings = store.getSettings();
  return c.json({
    user: { id: c.var.userId, email: c.var.isDemo ? 'Demo account' : user.email, isDemo: c.var.isDemo, birthday: user.birthday },
    onboarding: { completed: !!ob?.completedAt, step: ob?.step ?? 'welcome' },
    profile: settings.profile ?? null,
  });
});
