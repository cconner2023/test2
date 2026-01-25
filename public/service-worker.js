// Service Worker for ADTMC App - Vite Compatible
const CACHE_NAME = 'adtmc-cache-v2.6';
const APP_VERSION = '2.6';

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing version:', APP_VERSION);
    self.skipWaiting(); // Activate immediately

    // Pre-cache only the main app shell
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            const baseUrl = self.location.pathname.includes('/ADTMC/') ? '/ADTMC/' : '/';
            return cache.addAll([
                baseUrl,
                baseUrl + 'index.html'
            ]);
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches that don't match our current version
                    if (!cacheName.includes(APP_VERSION) && cacheName.startsWith('adtmc-cache-')) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests and non-GET requests
    if (!event.request.url.startsWith(self.location.origin) ||
        event.request.method !== 'GET') {
        return;
    }

    // Handle navigation requests specially
    if (event.request.mode === 'navigate') {
        event.respondWith(
            handleNavigationRequest(event)
        );
    } else {
        event.respondWith(
            handleAssetRequest(event)
        );
    }
});

async function handleNavigationRequest(event) {
    const cache = await caches.open(CACHE_NAME);
    const baseUrl = self.location.pathname.includes('/ADTMC/') ? '/ADTMC/' : '/';

    try {
        // Try network first for navigation
        const networkResponse = await fetch(event.request);

        // Update cache with fresh response
        if (networkResponse.ok) {
            await cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Fallback to index.html
        return cache.match(baseUrl + 'index.html');
    }
}

async function handleAssetRequest(event) {
    const cache = await caches.open(CACHE_NAME);

    // Try cache first for assets
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
        // Check for updates in background
        checkForUpdate(event.request, cache, cachedResponse);
        return cachedResponse;
    }

    // Not in cache, fetch from network
    try {
        const networkResponse = await fetch(event.request);

        // Cache successful responses (skip large files, APIs, etc.)
        if (networkResponse.ok &&
            !event.request.url.includes('/api/') &&
            networkResponse.status === 200) {
            await cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Network failed and not in cache
        return new Response('Network error', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

async function checkForUpdate(request, cache, cachedResponse) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cachedText = await cachedResponse.text();
            const networkText = await networkResponse.text();

            if (cachedText !== networkText) {
                // Update cache
                await cache.put(request, networkResponse.clone());

                // Notify clients
                const clients = await self.clients.matchAll();
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'UPDATE_AVAILABLE',
                        url: request.url
                    });
                });
            }
        }
    } catch (error) {
        // Silently fail - we still have the cached response
    }
}

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});