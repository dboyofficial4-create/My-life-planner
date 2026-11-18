import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app';
import { body, HttpError } from '../http';
import { isAllowedEndpoint } from '../integrations/webpush';
import { pushToUser } from '../services/reminders';

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.get('/notifications', (c) => {
  const store = c.var.store;
  return c.json({ items: store.notifications(30), unread: store.unreadNotifications() });
});

notificationRoutes.post('/notifications/read', (c) => {
  c.var.store.markNotificationsRead();
  return c.json({ ok: true });
});

/**
 * Called by the service worker when a push arrives. Returns reminders from the
 * last 10 minutes; each device shows them with the reminder key as the tag, so
 * the same reminder never appears twice on one device and every device gets it.
 */
notificationRoutes.get('/notifications/recent', (c) => c.json({ items: c.var.store.recentNotifications(10 * 60_000) }));

notificationRoutes.get('/reminders/push-key', (c) => {
  const v = c.var.config.vapid;
  return c.json({ publicKey: v?.publicKey ?? null, devices: c.var.store.pushSubscriptions().length });
});

const Sub = z.object({ endpoint: z.string().url().max(2000) });

notificationRoutes.post('/reminders/subscribe', async (c) => {
  const { endpoint } = await body(c, Sub);
  if (!c.var.config.vapid) throw new HttpError(503, 'not_configured', 'Notifications aren’t set up on this server.');
  if (!isAllowedEndpoint(endpoint)) throw new HttpError(422, 'bad_endpoint', 'This browser’s notification service isn’t supported.');
  c.var.store.addPushSubscription(endpoint);
  return c.json({ ok: true });
});

notificationRoutes.post('/reminders/unsubscribe', async (c) => {
  const { endpoint } = await body(c, Sub);
  c.var.store.removePushSubscription(endpoint);
  return c.json({ ok: true });
});

/** Send a test reminder to every device this account turned notifications on in. */
notificationRoutes.post('/reminders/test', async (c) => {
  const store = c.var.store;
  store.createNotification({ key: `test:${Date.now()}`, kind: 'test', title: 'Reminders are working', body: 'This is what a Waypoint reminder looks like.', url: '/settings/reminders' });
  const sent = await pushToUser(store, c.var.config);
  return c.json({ ok: true, devices: sent });
});
