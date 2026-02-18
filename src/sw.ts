/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createHandlerBoundToURL } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// ─── Precaching ──────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ─── Client claim ────────────────────────────────────────────────────
clientsClaim();

// ─── Navigation fallback (SPA) ───────────────────────────────────────
const handler = createHandlerBoundToURL('index.html');
const navigationRoute = new NavigationRoute(handler, {
  allowlist: [/^\/test2\//],
  denylist: [/^\/test2\/auth\//, /\/rest\/v1\//, /\/auth\/v1\//],
});
registerRoute(navigationRoute);

// ─── Runtime caching ─────────────────────────────────────────────────

// Google Fonts stylesheets (CSS)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Google Fonts files (woff2)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Supabase REST API
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Supabase Storage
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/i,
  new CacheFirst({
    cacheName: 'supabase-storage-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// How-To video clips — cached on first watch, not precached
registerRoute(
  /\/howTo\/.*\.mp4$/i,
  new CacheFirst({
    cacheName: 'howto-videos',
    plugins: [
      new ExpirationPlugin({ maxEntries: 15, maxAgeSeconds: 60 * 60 * 24 * 90 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ─── Push notifications ──────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string; url?: string };
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'New Notification', body: event.data?.text() || '' };
  }

  const title = payload.title || 'ADTMC';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: '/test2/icon-192.png',
    badge: '/test2/icon-144.png',
    data: { url: payload.url || '/test2/?view=admin' },
    tag: 'adtmc-push',
  };

  // Always call waitUntil — iOS aggressively suspends the SW otherwise
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data?.url as string) || '/test2/?view=admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes('/test2/') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Skip waiting on message ─────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
