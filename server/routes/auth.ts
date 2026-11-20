import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';

const safeEqual = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
import type { AppEnv } from '../app';
import { SESSION_COOKIE } from '../app';
import { body, HttpError } from '../http';
import { hashPassword, newToken, sha256, verifyPassword } from '../auth/crypto';
import { LoginInput, RegisterInput } from '../../shared/schemas';
import { agePolicy } from '../../shared/domain/age';
import { todayIn } from '../../shared/domain/time';
import { seedDemo } from '../services/demo';
import { getConnInfo } from '@hono/node-server/conninfo';
import { z } from 'zod';
import { resetEmail } from '../services/mail';
import { newPasswordSchema, normalizeRecoveryCode } from '../auth/recovery';

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
/**
 * The client's address for rate limits. Behind a proxy (TRUST_PROXY=1, e.g. Render) the proxy appends the real
 * address as the LAST X-Forwarded-For entry; earlier entries are whatever the client sent, so they're ignored.
 * Without a proxy the header is never trusted.
 */
export function clientKey(c: Context<AppEnv>): string {
  if (c.var.config.trustProxy) return c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
  try {
    return getConnInfo(c).remote.address ?? 'local';
  } catch {
    return 'local';
  }
}

function startSession(c: Context<AppEnv>, userId: string, hours = SESSION_DAYS * 24) {
  const token = newToken();
  c.var.db.run('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', sha256(token), userId, Date.now() + hours * 3_600_000, new Date().toISOString());
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: c.var.config.secureCookies, sameSite: 'Lax', path: '/', maxAge: hours * 3600 });
}

authRoutes.post('/register', async (c) => {
  limit(c, `register:${clientKey(c)}`, 10, 15 * 60_000);
  const input = await body(c, RegisterInput);
  const required = c.var.config.signupCode;
  if (required && !safeEqual(input.signupCode ?? '', required)) {
    throw new HttpError(403, 'signup_code', 'Ask whoever runs this Waypoint for the sign-up code.', { fields: { signupCode: 'That code isn’t right' } });
  }
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


/** Does this server need a sign-up code? (Shown on the sign-up page; the code itself is never sent.) */
authRoutes.get('/signup-options', (c) => c.json({ codeRequired: !!c.var.config.signupCode }));

/* ---------- account recovery ---------- */

const RESET_MINUTES = 30;
const emailField = z.string().trim().toLowerCase().email('Enter the email you signed up with').max(254);

/** What this server offers on the "Forgot password" page. */
authRoutes.get('/recovery-options', (c) => c.json({ code: true, email: !!(c.var.config.mailer && c.var.config.appUrl) }));

/** Sign everyone out of the account and sign this browser in with the new password. */
async function setNewPassword(c: Context<AppEnv>, userId: string, password: string, extra?: () => void) {
  const hash = await hashPassword(password);
  c.var.db.tx(() => {
    c.var.db.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, userId);
    c.var.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
    c.var.db.run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', Date.now(), userId);
    extra?.();
  });
  startSession(c, userId);
}

/** Reset with the one-time recovery code from Settings. The code is used up; the user makes a new one. */
authRoutes.post('/recover', async (c) => {
  const input = await body(c, z.object({ email: emailField, code: z.string().max(64), password: newPasswordSchema }));
  limit(c, `recover:${clientKey(c)}`, 20, 60 * 60_000);
  limit(c, `recover-email:${input.email}`, 5, 60 * 60_000);
  const user = c.var.db.get<{ id: string; recovery_code_hash: string | null; is_demo: number }>('SELECT id, recovery_code_hash, is_demo FROM users WHERE email = ?', input.email);
  const code = normalizeRecoveryCode(input.code);
  // Same work and the same answer whether or not the account or code exists.
  const ok = user?.recovery_code_hash && !user.is_demo ? await verifyPassword(code, user.recovery_code_hash) : (await hashPassword(code), false);
  if (!user || !ok) throw new HttpError(401, 'bad_recovery', 'That email and recovery code don’t match.');
  await setNewPassword(c, user.id, input.password, () => {
    c.var.db.run('UPDATE users SET recovery_code_hash = NULL, recovery_code_created_at = NULL WHERE id = ?', user.id);
  });
  return c.json({ ok: true, recoveryCodeUsed: true });
});

/** Email a one-time reset link. Always answers the same, so it can't be used to find out who has an account. */
authRoutes.post('/forgot', async (c) => {
  const { mailer, appUrl } = c.var.config;
  if (!mailer || !appUrl) throw new HttpError(503, 'email_unavailable', 'Email reset isn’t set up on this server. Use your recovery code instead.');
  const input = await body(c, z.object({ email: emailField }));
  limit(c, `forgot:${clientKey(c)}`, 10, 60 * 60_000);
  limit(c, `forgot-email:${input.email}`, 3, 60 * 60_000);
  const user = c.var.db.get<{ id: string; is_demo: number }>('SELECT id, is_demo FROM users WHERE email = ?', input.email);
  if (user && !user.is_demo) {
    const token = newToken();
    c.var.db.run('INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', sha256(token), user.id, Date.now() + RESET_MINUTES * 60_000, Date.now());
    const link = `${appUrl.replace(/\/+$/, '')}/reset?token=${encodeURIComponent(token)}`;
    try {
      await mailer.send({ to: input.email, ...resetEmail(link, RESET_MINUTES) });
    } catch (e) {
      console.error(`[mail] reset email failed: ${(e as Error).name}`);
    }
  }
  return c.json({ ok: true });
});

/** Set a new password from an emailed link. */
authRoutes.post('/reset', async (c) => {
  const input = await body(c, z.object({ token: z.string().min(20).max(200), password: newPasswordSchema }));
  limit(c, `reset:${clientKey(c)}`, 20, 60 * 60_000);
  const row = c.var.db.get<{ user_id: string; expires_at: number; used_at: number | null }>('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?', sha256(input.token));
  if (!row || row.used_at || row.expires_at < Date.now()) throw new HttpError(400, 'reset_expired', 'This reset link has expired or was already used. Ask for a new one.');
  await setNewPassword(c, row.user_id, input.password);
  return c.json({ ok: true });
});
