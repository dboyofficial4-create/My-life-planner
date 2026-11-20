import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { Db } from './db';
import { createApp, type AppConfig } from './app';
import { UserStore } from './repos/store';
import { purgeExpiredDemos } from './services/demo';
import { resolveEncryptionKey } from './auth/keys';
import { loadOrCreateVapidKeys } from './integrations/webpush';
import { runReminders } from './services/reminders';
import { dirname, join } from 'node:path';

// Settings from a .env file next to package.json (ANTHROPIC_API_KEY, PORT, …), if there is one.
// Values already set in the environment win. Node 20.12+ reads the file itself; no extra package.
try {
  process.loadEnvFile('.env');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`[env] couldn’t read .env: ${(e as Error).message}`);
}

// `--production` works on every OS (Windows can't set env vars inline in npm scripts).
const prod = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.DATABASE_PATH ?? 'data/waypoint.db';
const db = new Db(dbPath);

const canvas =
  process.env.CANVAS_CLIENT_ID && process.env.CANVAS_CLIENT_SECRET && process.env.CANVAS_REDIRECT_URI
    ? { clientId: process.env.CANVAS_CLIENT_ID, clientSecret: process.env.CANVAS_CLIENT_SECRET, redirectUri: process.env.CANVAS_REDIRECT_URI }
    : undefined;

const appConfig: AppConfig = {
  secureCookies: prod && process.env.INSECURE_COOKIES !== '1',
  encryptionKey: resolveEncryptionKey(process.env.APP_ENCRYPTION_KEY, join(dirname(dbPath), '.encryption-key')),
  canvas,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  vapid: loadOrCreateVapidKeys(join(dirname(dbPath), '.vapid-keys.json')),
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:waypoint@example.com',
};
const app = createApp(db, appConfig);

if (prod && existsSync('dist/client/index.html')) {
  const index = readFileSync('dist/client/index.html', 'utf8');
  app.use('/assets/*', serveStatic({ root: 'dist/client' }));
  for (const f of ['/favicon.svg', '/sw.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/theme.js']) app.use(f, serveStatic({ root: 'dist/client' }));
  // the public welcome page (static, from public/start)
  app.get('/start', (c) => c.redirect('/start/'));
  app.use('/start/*', serveStatic({ root: 'dist/client', rewriteRequestPath: (p) => (p.endsWith('/') ? `${p}index.html` : p) }));
  app.get('*', (c) => c.html(index));
}

// Clean up schedule notes ("A Day", "B Day", "No School" …) imported before imports learned to skip them.
for (const { id } of db.all<{ id: string }>("SELECT DISTINCT user_id AS id FROM assignments WHERE source <> 'manual'")) {
  const store = new UserStore(db, id);
  if (store.deleteImportedScheduleNotes() > 0) store.markStale('0000-01-01');
}

const purge = () => {
  const n = purgeExpiredDemos(db);
  if (n) console.log(`[demo] removed ${n} expired demo account(s)`);
  db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
};
purge();
setInterval(purge, 60 * 60_000).unref();

// Reminders: check every minute (each reminder is sent once).
let running = false;
setInterval(() => {
  if (running) return;
  running = true;
  runReminders(db, appConfig)
    .catch((e) => console.error(`[reminders] run failed: ${(e as Error).name}`))
    .finally(() => { running = false; });
}, 60_000).unref();

serve({ fetch: app.fetch, port }, (info) => console.log(`[api] listening on http://localhost:${info.port}`));
