import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { Db } from './db';
import { createApp } from './app';
import { UserStore } from './repos/store';
import { purgeExpiredDemos } from './services/demo';
import { resolveEncryptionKey } from './auth/keys';
import { dirname, join } from 'node:path';

// `--production` works on every OS (Windows can't set env vars inline in npm scripts).
const prod = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.DATABASE_PATH ?? 'data/waypoint.db';
const db = new Db(dbPath);

const canvas =
  process.env.CANVAS_CLIENT_ID && process.env.CANVAS_CLIENT_SECRET && process.env.CANVAS_REDIRECT_URI
    ? { clientId: process.env.CANVAS_CLIENT_ID, clientSecret: process.env.CANVAS_CLIENT_SECRET, redirectUri: process.env.CANVAS_REDIRECT_URI }
    : undefined;

const app = createApp(db, {
  secureCookies: prod && process.env.INSECURE_COOKIES !== '1',
  encryptionKey: resolveEncryptionKey(process.env.APP_ENCRYPTION_KEY, join(dirname(dbPath), '.encryption-key')),
  canvas,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
});

if (prod && existsSync('dist/client/index.html')) {
  const index = readFileSync('dist/client/index.html', 'utf8');
  app.use('/assets/*', serveStatic({ root: 'dist/client' }));
  app.use('/favicon.svg', serveStatic({ root: 'dist/client' }));
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

serve({ fetch: app.fetch, port }, (info) => console.log(`[api] listening on http://localhost:${info.port}`));
