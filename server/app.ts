import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import { Db } from './db';
import { HttpError } from './http';
import { UserStore } from './repos/store';
import { sha256 } from './auth/crypto';
import { API_VERSION } from '../shared/version';
import { authRoutes } from './routes/auth';
import { onboardingRoutes } from './routes/onboarding';
import { planRoutes } from './routes/plan';
import { moduleRoutes } from './routes/modules';
import { schoolRoutes } from './routes/school';
import { accountRoutes } from './routes/account';
import { sportsRoutes } from './routes/sports';

export interface AppConfig {
  /** Secure cookies (HTTPS). True in production. */
  secureCookies: boolean;
  /** 32-byte base64 key for encrypting integration tokens at rest. Optional until an integration needs it. */
  encryptionKey?: string;
  canvas?: { clientId: string; clientSecret: string; redirectUri: string };
  /** Server-wide Anthropic API key (ANTHROPIC_API_KEY). If unset, users can add their own in Settings → Connections. */
  anthropicApiKey?: string;
  /** AI study-set generator factory (overridden in tests). */
  studyAI?: import('./services/studyAI').StudyAIFactory;
  /** fetch override for tests (external API calls). */
  fetch?: typeof fetch;
  /** Clock override for tests. */
  now?: () => Date;
}

export interface AppEnv {
  Variables: {
    db: Db;
    config: AppConfig;
    now: () => Date;
    userId: string;
    isDemo: boolean;
    store: UserStore;
    limiter: Map<string, { count: number; resetAt: number }>;
  };
}

export const SESSION_COOKIE = 'wp_session';

export function createApp(db: Db, config: AppConfig) {
  const app = new Hono<AppEnv>();
  const now = config.now ?? (() => new Date());
  const limiter = new Map<string, { count: number; resetAt: number }>();

  app.use('*', secureHeaders({ referrerPolicy: 'same-origin', crossOriginEmbedderPolicy: false }));
  // Study-material uploads may carry files (base64); everything else stays small.
  const uploadLimit = bodyLimit({ maxSize: 30 * 1024 * 1024, onError: () => { throw new HttpError(413, 'too_large', 'Files are too large together (20 MB max).'); } });
  const defaultLimit = bodyLimit({ maxSize: 512 * 1024, onError: () => { throw new HttpError(413, 'too_large', 'That upload is too large.'); } });
  app.use('/api/*', (c, next) => (c.req.path === '/api/school/study/generate' ? uploadLimit(c, next) : defaultLimit(c, next)));
  app.use('/api/*', async (c, next) => {
    c.set('db', db);
    c.set('config', config);
    c.set('now', now);
    c.set('limiter', limiter);
    // CSRF defence: state-changing requests must be JSON and same-origin.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const ct = c.req.header('content-type') ?? '';
      // HTML forms can only send form/text bodies via POST, so requiring JSON blocks form-based CSRF.
      if (c.req.method !== 'DELETE' && !ct.includes('application/json')) throw new HttpError(400, 'bad_content_type', 'Requests must be JSON.');
      const origin = c.req.header('origin');
      const host = c.req.header('x-forwarded-host') ?? c.req.header('host');
      if (origin && host && new URL(origin).host !== host) throw new HttpError(403, 'bad_origin', 'Cross-site request blocked.');
    }
    await next();
    c.header('Cache-Control', 'no-store');
  });

  // Session resolution for everything except auth endpoints.
  app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/auth/') && path !== '/api/auth/me' && path !== '/api/auth/logout') return next();
    if (path === '/api/health') return next();
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) throw new HttpError(401, 'unauthenticated', 'Please sign in.');
    const row = db.get<{ user_id: string; expires_at: number; is_demo: number }>(
      'SELECT s.user_id, s.expires_at, u.is_demo FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
      sha256(token),
    );
    if (!row || row.expires_at < Date.now()) throw new HttpError(401, 'unauthenticated', 'Your session has ended. Please sign in again.');
    c.set('userId', row.user_id);
    c.set('isDemo', !!row.is_demo);
    c.set('store', new UserStore(db, row.user_id));
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true, apiVersion: API_VERSION }));
  app.route('/api/auth', authRoutes);
  app.route('/api/onboarding', onboardingRoutes);
  app.route('/api', planRoutes);
  app.route('/api', moduleRoutes);
  app.route('/api/school', schoolRoutes);
  app.route('/api', sportsRoutes);
  app.route('/api', accountRoutes);
  app.all('/api/*', () => {
    throw new HttpError(404, 'not_found', 'Not found.');
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
    }
    // Never log request bodies or personal data — only the route and error type.
    console.error(`[error] ${c.req.method} ${c.req.routePath}: ${err.name}: ${err.message}`);
    return c.json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } }, 500);
  });

  return app;
}
