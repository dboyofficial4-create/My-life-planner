import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { SESSION_COOKIE } from '../app';
import { body, HttpError } from '../http';
import { INTEGRATIONS } from '../integrations/registry';
import { parseJson } from '../db';
import { decryptSecret, encryptSecret } from '../auth/crypto';
import { CanvasError, canvasClient, normalizeBaseUrl, type CanvasUser } from '../integrations/canvas';
import { CANVAS_SOURCE, syncCanvas } from '../services/canvasSync';
import { loadContext } from '../services/context';
import { startOfWeek } from '../../shared/domain/time';
import type { Context } from 'hono';

export const accountRoutes = new Hono<AppEnv>();

/* ---------- integrations: honest status for every provider ---------- */

accountRoutes.get('/integrations', (c) => {
  const rows = new Map(c.var.store.integrations().map((r) => [r.provider, r]));
  return c.json({
    integrations: INTEGRATIONS.map((def) => {
      const row = rows.get(def.id);
      const configured = def.isConfigured(c.var.config);
      return {
        ...def.describe,
        id: def.id,
        configured,
        connection: row ? { status: row.status, lastSyncAt: row.last_sync_at, lastError: row.last_error, meta: parseJson(row.meta, null) } : null,
      };
    }),
  });
});

/* ---------- Canvas (personal access token) ---------- */

function requireSchool(c: Context<AppEnv>) {
  const ctx = loadContext(c.var.store, c.var.now());
  if (!ctx.modules.has('school')) throw new HttpError(404, 'module_disabled', 'Turn on School in Settings to connect Canvas.');
  return ctx;
}

function canvasHttpError(e: unknown): never {
  if (e instanceof CanvasError) {
    const fields = e.kind === 'bad_url' ? { baseUrl: e.message } : e.kind === 'auth' ? { token: 'Canvas rejected this token' } : undefined;
    throw new HttpError(e.kind === 'network' ? 503 : 422, `canvas_${e.kind}`, e.message, fields ? { fields } : undefined);
  }
  throw e;
}

interface CanvasMeta {
  baseUrl: string;
  host: string;
  userName: string;
  connectedAt: string;
  lastSummary?: unknown;
}

async function runSync(c: Context<AppEnv>, tz: string) {
  const store = c.var.store;
  const tokenEnc = store.integrationToken('canvas');
  const row = store.integrations().find((r) => r.provider === 'canvas');
  const meta = parseJson<CanvasMeta | null>(row?.meta, null);
  if (!tokenEnc || !meta) throw new HttpError(409, 'not_connected', 'Canvas isn’t connected.');
  const client = canvasClient(meta.baseUrl, decryptSecret(tokenEnc, c.var.config.encryptionKey!), c.var.config.fetch);
  try {
    const summary = await syncCanvas(store, client, tz, c.var.now());
    store.upsertIntegration('canvas', { status: 'connected', lastSyncAt: new Date().toISOString(), lastError: null, meta: { ...meta, lastSummary: summary } });
    store.markStale(startOfWeek(loadContext(store, c.var.now()).today));
    return summary;
  } catch (e) {
    const message = e instanceof CanvasError ? e.message : 'Sync failed unexpectedly.';
    store.upsertIntegration('canvas', { status: e instanceof CanvasError && e.kind === 'auth' ? 'needs_reconnect' : 'error', lastError: message, meta });
    canvasHttpError(e);
  }
}

accountRoutes.post('/integrations/canvas/token', async (c) => {
  const ctx = requireSchool(c);
  const input = await body(
    c,
    z.object({
      baseUrl: z.string().trim().min(1, 'Enter your school’s Canvas address').max(200),
      token: z.string().trim().min(20, 'That token looks too short — copy the whole token from Canvas').max(400).regex(/^[\x21-\x7e]+$/, 'Tokens contain no spaces'),
      consent: z.literal(true, { error: 'Please confirm you want Waypoint to read your Canvas data' }),
    }),
  );
  const key = c.var.config.encryptionKey;
  if (!key) throw new HttpError(503, 'not_configured', 'The server has no encryption key, so tokens can’t be stored safely.');
  let baseUrl = '';
  let self: CanvasUser | null = null;
  try {
    baseUrl = normalizeBaseUrl(input.baseUrl);
    self = await canvasClient(baseUrl, input.token, c.var.config.fetch).get<CanvasUser>('/api/v1/users/self');
  } catch (e) {
    canvasHttpError(e);
  }
  if (!self || typeof self.id !== 'number') throw new HttpError(422, 'canvas_unexpected', 'That address didn’t respond like Canvas.');
  const meta: CanvasMeta = { baseUrl, host: new URL(baseUrl).host, userName: String(self.name ?? '').slice(0, 80), connectedAt: new Date().toISOString() };
  c.var.store.upsertIntegration('canvas', { status: 'connected', tokenEnc: encryptSecret(input.token, key), lastError: null, meta });
  const summary = await runSync(c, ctx.settings.profile.timezone);
  return c.json({ ok: true, summary, account: { host: meta.host, userName: meta.userName } });
});

accountRoutes.post('/integrations/canvas/sync', async (c) => {
  const ctx = requireSchool(c);
  return c.json({ ok: true, summary: await runSync(c, ctx.settings.profile.timezone) });
});

accountRoutes.post('/integrations/:id/connect', (c) => {
  const def = INTEGRATIONS.find((d) => d.id === c.req.param('id'));
  if (!def) throw new HttpError(404, 'not_found', 'Unknown integration.');
  if (def.id === 'canvas') throw new HttpError(400, 'use_token', 'Connect Canvas with an access token from School → Connections.');
  throw new HttpError(501, 'not_supported', def.describe.unsupportedReason ?? 'This integration cannot be connected.');
});

accountRoutes.delete('/integrations/:id', (c) => {
  const id = c.req.param('id');
  const store = c.var.store;
  // Removes the stored (encrypted) token and status. A third party can't revoke a Canvas personal
  // token without its id, so the UI tells the user to delete it in Canvas as well.
  store.deleteIntegration(id);
  if (id === 'youtube') store.clearCache();
  if (id === 'canvas' && c.req.query('removeData') === '1') {
    store.deleteSourceData(CANVAS_SOURCE);
    store.markStale(startOfWeek(loadContext(store, c.var.now()).today));
  }
  return c.json({ ok: true });
});

/* ---------- data export & account deletion ---------- */

accountRoutes.get('/account/export', (c) => {
  const data = c.var.store.exportAll();
  c.header('Content-Disposition', `attachment; filename="waypoint-export-${new Date().toISOString().slice(0, 10)}.json"`);
  return c.json(data);
});

accountRoutes.post('/account/delete', async (c) => {
  await body(c, z.object({ confirm: z.literal('DELETE') }));
  // ON DELETE CASCADE removes every user-owned row, including sessions.
  c.var.db.run('DELETE FROM users WHERE id = ?', c.var.userId);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
