import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { SESSION_COOKIE } from '../app';
import { body, HttpError } from '../http';
import { INTEGRATIONS } from '../integrations/registry';
import { parseJson } from '../db';

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

accountRoutes.post('/integrations/:id/connect', (c) => {
  const def = INTEGRATIONS.find((d) => d.id === c.req.param('id'));
  if (!def) throw new HttpError(404, 'not_found', 'Unknown integration.');
  if (!def.connectable) throw new HttpError(501, 'not_supported', def.describe.unsupportedReason ?? 'This integration cannot be connected.');
  if (!def.isConfigured(c.var.config)) {
    throw new HttpError(503, 'not_configured', 'This integration needs server credentials that haven’t been set up yet. See docs/INTEGRATIONS.md.');
  }
  // OAuth flow start is implemented per provider once credentials exist.
  throw new HttpError(501, 'not_implemented', 'The authorization flow for this provider is not implemented yet.');
});

accountRoutes.delete('/integrations/:id', (c) => {
  // Removes stored tokens and status. Provider-side revocation is attempted where supported (none stored yet).
  c.var.store.deleteIntegration(c.req.param('id'));
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
