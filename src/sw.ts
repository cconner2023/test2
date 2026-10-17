/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createHandlerBoundToURL } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;
declare const __BUILD_ID__: string;

// Background Sync types (not in all TS libs)
interface SyncEvent extends ExtendableEvent {
  tag: string;
}
interface SyncManager {
  register(tag: string): Promise<void>;
}

// ─── Precaching ──────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ─── Client claim ────────────────────────────────────────────────────
// Load-bearing for updates: after the page sends SKIP_WAITING, the claim fires
// controllerchange → workbox `controlling` → the page reloads itself. Without
// it the activated worker never controls the open page and no reload happens.
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

// OpenStreetMap tiles — cached on first view for offline map access
registerRoute(
  ({ url }) => url.hostname.includes('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: 'map-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ─── Push notifications ──────────────────────────────────────────────

self.addEventListener('push', (event) => {
  // FCM may nest fields under `notification` or `data` keys — extract from all levels
  let raw: Record<string, unknown> = {};
  try {
    raw = event.data ? event.data.json() : {};
  } catch {
    raw = {};
  }

  const notif = (raw.notification || {}) as Record<string, unknown>;
  const data = (raw.data || {}) as Record<string, unknown>;

  // Priority: top-level > data > notification > fallback
  const title = (raw.title || data.title || notif.title || 'ADTMC') as string;
  const body = (raw.body || data.body || notif.body || '') as string;
  const url = (raw.url || data.url || notif.url || '/test2/?view=admin') as string;

  const options: NotificationOptions = {
    body,
    icon: '/test2/icon-192.png',
    badge: '/test2/icon-144.png',
    data: { url },
    tag: 'adtmc-push',
  };

  // Always call waitUntil — iOS aggressively suspends the SW otherwise.
  // If a visible app window exists, forward the payload via postMessage
  // so the in-app toast can display it. Otherwise show an OS notification.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const visibleClients = clients.filter(
          (c) => c.visibilityState === 'visible'
        );
        if (visibleClients.length > 0) {
          visibleClients.forEach((c) =>
            c.postMessage({ type: 'PUSH_RECEIVED', title, body: options.body, url: options.data?.url })
          );
          return;
        }
        return self.registration.showNotification(title, options);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data?.url as string) || '/test2/?view=admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes('/test2/') && 'focus' in client) {
          // iOS doesn't support client.navigate() — use postMessage instead
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return client.focus();
        }
      }
      // No existing window — open a new one
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Background Sync — outbound message queue flush ─────────────────

(self as any).addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'signal-outbound-flush') {
    event.waitUntil(
      import('./lib/signal/swFlush').then(m => m.flushOutboundQueue())
    );
  }
});

// ─── Install: selective skipWaiting ──────────────────────────────────
// Skip waiting when no prior build ID exists in the meta cache — i.e. this is
// a pre-auth build that predates the update prompt system — or while
// FORCE_UPDATES is on.
//
// FORCE_UPDATES: every new build activates immediately instead of sitting in
// `waiting` for the app-level prompt. On iOS a waiting worker was never
// promoted (not by the prompt, backgrounding, or a cold launch), stranding
// devices on stale builds. The worker never reloads pages itself (iOS has no
// client.navigate()): the claim below fires controllerchange and swService
// reloads the page; pages on older code pick the build up on next launch.
// Set false to return to prompt-mode updates (onNeedRefresh + MIN_VERSION).
const FORCE_UPDATES = true;
const SW_META_CACHE = 'sw-meta';
const SW_BUILD_KEY = 'build-id';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_META_CACHE).then(cache =>
      cache.match(SW_BUILD_KEY).then(entry => {
        if (!entry || FORCE_UPDATES) self.skipWaiting();
      })
    )
  );
});

// ─── Activate: stamp build ID in meta cache ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(SW_META_CACHE).then(cache =>
      cache.put(SW_BUILD_KEY, new Response(__BUILD_ID__, {
        headers: { 'Content-Type': 'text/plain' },
      }))
    )
  );
});

// ─── Skip waiting + queue notification on message ────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Tab notifies SW that the outbound queue has new entries
  if (event.data && event.data.type === 'QUEUE_UPDATED') {
    if ('sync' in self.registration) {
      (self.registration as ServiceWorkerRegistration & { sync: SyncManager })
        .sync.register('signal-outbound-flush').catch(() => { });
    } else {
      // Fallback for browsers without SyncManager (Safari) — flush inline
      import('./lib/signal/swFlush').then(m => m.flushOutboundQueue()).catch(() => { });
    }
  }
});
