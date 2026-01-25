// public/service-worker.js - PRODUCTION VERSION
const CACHE_NAME = 'adtmc-cache-v3';
const BASE_PATH = '/ADTMC/';
const CONTENT_VERSION = 'v3';

// Static assets to cache
const STATIC_ASSETS = [
    BASE_PATH, // index.html
    BASE_PATH + 'manifest.json'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing version:', CONTENT_VERSION);
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                // Cache each asset individually to avoid duplicates
                const cachePromises = STATIC_ASSETS.map(asset => {
                    const request = new Request(asset, {
                        credentials: 'same-origin',
                        redirect: 'follow'
                    });
                    return cache.add(request).catch(err => {
                        console.warn('[SW] Failed to cache:', asset, err);
                    });
                });
                return Promise.all(cachePromises);
            })
            .then(() => {
                console.log('[SW] Install completed');
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('adtmc-cache-')) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
            .then(() => self.clients.claim())
            .then(() => {
                console.log('[SW] Activation completed');
            })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests and cross-origin requests
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // Only handle our app's requests
    if (!url.pathname.startsWith(BASE_PATH)) return;

    // Handle HTML navigation requests separately
    if (event.request.mode === 'navigate') {
        event.respondWith(handleNavigationRequest(event.request));
        return;
    }

    // Handle all other requests
    event.respondWith(handleAssetRequest(event.request));
});

async function handleNavigationRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(BASE_PATH);

    try {
        // Always try network first for navigation
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Update cache in background
            cache.put(BASE_PATH, networkResponse.clone()).catch(err => {
                console.warn('[SW] Failed to update cache:', err);
            });
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, using cached HTML');

        // If we have cached HTML, use it
        if (cachedResponse) {
            return cachedResponse;
        }

        // Otherwise, return offline page or error
        return new Response('<h1>You are offline</h1><p>Please check your connection.</p>', {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

async function handleAssetRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // If we have it cached, return it
    if (cachedResponse) {
        console.log('[SW] Serving from cache:', request.url);

        // Check for updates in background
        fetch(request)
            .then(async (networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    const cachedText = await cachedResponse.text();
                    const networkText = await responseClone.text();

                    if (cachedText !== networkText) {
                        console.log('[SW] Content updated:', request.url);
                        await cache.put(request, networkResponse.clone());

                        // Notify clients
                        const clients = await self.clients.matchAll();
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'CONTENT_UPDATED',
                                url: request.url
                            });
                        });
                    }
                }
            })
            .catch(() => {
                // Network failed, ignore
            });

        return cachedResponse;
    }

    // Not in cache, try network
    console.log('[SW] Fetching from network:', request.url);
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Cache the response
            await cache.put(request, networkResponse.clone());
            console.log('[SW] Cached:', request.url);
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed:', request.url, error);

        // For JS/CSS files, return empty response to prevent crashes
        if (request.destination === 'script' || request.destination === 'style') {
            return new Response('// Offline', {
                headers: { 'Content-Type': 'text/javascript' }
            });
        }

        throw error;
    }
}

// Listen for messages
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data === 'skipWaiting' || event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data.type === 'CHECK_UPDATES') {
        checkForUpdates(event.data.urls || []);
    }
});

async function checkForUpdates(urls) {
    const cache = await caches.open(CACHE_NAME);
    const uniqueUrls = [...new Set(urls)];

    for (const url of uniqueUrls) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (response.ok) {
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    const cachedText = await cachedResponse.text();
                    const networkText = await response.clone().text();

                    if (cachedText !== networkText) {
                        console.log('[SW] Update found:', url);
                        await cache.put(url, response.clone());

                        const clients = await self.clients.matchAll();
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'CONTENT_UPDATED',
                                url: url
                            });
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('[SW] Update check failed:', url, error);
        }
    }
}