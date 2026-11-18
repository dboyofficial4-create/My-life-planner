/* Waypoint service worker: shows reminders delivered by Web Push.
 * Pushes carry no content. On a push we fetch the text from Waypoint itself,
 * so the browser's push service never sees what a reminder says. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let items = [];
      try {
        const res = await fetch('/api/notifications/recent', { credentials: 'same-origin', cache: 'no-store' });
        if (res.ok) items = (await res.json()).items || [];
      } catch (e) {
        /* offline: fall through to the generic notice */
      }
      if (!items.length) {
        // Browsers require a visible notification for every push.
        return self.registration.showNotification('Waypoint', { body: 'You have a new reminder.', tag: 'waypoint-generic', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/' } });
      }
      await Promise.all(
        items.map((n) =>
          self.registration.showNotification(n.title, { body: n.body, tag: n.key, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: n.url || '/' } }),
        ),
      );
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
