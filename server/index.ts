import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { Db } from './db';
import { createApp } from './app';
import { purgeExpiredDemos } from './services/demo';

// `--production` works on every OS (Windows can't set env vars inline in npm scripts).
const prod = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const port = Number(process.env.PORT ?? 8787);
const db = new Db(process.env.DATABASE_PATH ?? 'data/waypoint.db');

const canvas =
  process.env.CANVAS_CLIENT_ID && process.env.CANVAS_CLIENT_SECRET && process.env.CANVAS_REDIRECT_URI
    ? { clientId: process.env.CANVAS_CLIENT_ID, clientSecret: process.env.CANVAS_CLIENT_SECRET, redirectUri: process.env.CANVAS_REDIRECT_URI }
    : undefined;

const app = createApp(db, {
  secureCookies: prod && process.env.INSECURE_COOKIES !== '1',
  encryptionKey: process.env.APP_ENCRYPTION_KEY,
  canvas,
});

if (prod && existsSync('dist/client/index.html')) {
  const index = readFileSync('dist/client/index.html', 'utf8');
  app.use('/assets/*', serveStatic({ root: 'dist/client' }));
  app.use('/favicon.svg', serveStatic({ root: 'dist/client' }));
  app.get('*', (c) => c.html(index));
}

const purge = () => {
  const n = purgeExpiredDemos(db);
  if (n) console.log(`[demo] removed ${n} expired demo account(s)`);
  db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
};
purge();
setInterval(purge, 60 * 60_000).unref();

serve({ fetch: app.fetch, port }, (info) => console.log(`[api] listening on http://localhost:${info.port}`));
