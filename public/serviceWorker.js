// public/serviceWorker.js
const CACHE_NAME = 'adtmc-cache-v2.6';
const BASE_PATH = '/ADTMC/';
const CONTENT_VERSION = 'v3';

// This will be replaced by Vite PWA with the precache manifest
const precacheManifest = self.__WB_MANIFEST;

// Critical assets to cache immediately (in addition to precache)
const CRITICAL_ASSETS = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'manifest.json'  // FIXED: removed 'public/'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing version:', CONTENT_VERSION);

    // Skip waiting to activate immediately
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching critical assets');
                // Add precache manifest assets if available
                const allAssets = [...CRITICAL_ASSETS];

                // Add precache assets from Vite PWA
                if (precacheManifest && Array.isArray(precacheManifest)) {
                    precacheManifest.forEach((asset) => {
                        const url = typeof asset === 'string' ? asset : asset.url;
                        if (url && !allAssets.includes(url)) {
                            allAssets.push(url);
                        }
                    });
                }

                return cache.addAll(allAssets.map(url => new Request(url, {
                    cache: 'reload'
                })));
            })
            .then(() => {
                console.log('[Service Worker] Install completed');
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches that aren't the current one
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('adtmc-cache-')) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Claim clients immediately
            return self.clients.claim();
        }).then(() => {
            console.log('[Service Worker] Activation completed');
            // Notify all clients that SW is ready
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_READY',
                        version: CONTENT_VERSION,
                        cacheName: CACHE_NAME
                    });
                });
            });
        })
    );
});

// Fetch event - aggressive network-first strategy
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    // Skip Chrome extensions
    if (url.protocol === 'chrome-extension:') return;

    // Check if it's within our base path
    if (!url.pathname.startsWith(BASE_PATH)) return;

    // Handle different types of requests
    if (event.request.destination === 'document' ||
        url.pathname.endsWith('.html') ||
        url.pathname === BASE_PATH ||
        url.pathname === BASE_PATH.slice(0, -1)) {

        // HTML/Page requests: Network First
        event.respondWith(
            fetchFromNetworkThenCache(event.request).catch(() => {
                return caches.match(event.request);
            })
        );

    } else if (event.request.destination === 'script' ||
        event.request.destination === 'style' ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css')) {

        // JS/CSS: Stale While Revalidate
        event.respondWith(
            staleWhileRevalidate(event.request)
        );

    } else {
        // Images, fonts, other assets: Cache First
        event.respondWith(
            cacheFirst(event.request)
        );
    }
});

// Network First with fallback to cache
async function fetchFromNetworkThenCache(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Clone response for cache
            const responseClone = networkResponse.clone();

            // Update cache in background
            caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone).then(() => {
                    // Check if content changed
                    checkForContentUpdate(request, networkResponse);
                });
            });
        }

        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network failed for:', request.url, error);
        throw error;
    }
}

// Stale While Revalidate
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Always fetch from network in background
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
            checkForContentUpdate(request, networkResponse);
        }
        return networkResponse;
    }).catch(() => {
        // Network failed, ignore
    });

    return cachedResponse || fetchPromise;
}

// Cache First
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Fetch in background to update cache
        fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
                checkForContentUpdate(request, networkResponse);
            }
        }).catch(() => {
            // Ignore network errors
        });

        return cachedResponse;
    }

    // Not in cache, fetch from network
    return fetch(request);
}

// Check if content has changed
async function checkForContentUpdate(request, networkResponse) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            const [cachedText, networkText] = await Promise.all([
                cachedResponse.text(),
                networkResponse.clone().text()
            ]);

            if (cachedText !== networkText) {
                console.log('[Service Worker] Content updated:', request.url);

                // Notify clients
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({
                        type: 'CONTENT_UPDATED',
                        url: request.url,
                        version: CONTENT_VERSION,
                        timestamp: new Date().toISOString()
                    });
                });
            }
        }
    } catch (error) {
        console.log('[Service Worker] Error checking content update:', error);
    }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data === 'checkForUpdates') {
        self.registration.update();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[Service Worker] Cache cleared by user request');
            event.ports?.[0]?.postMessage({ success: true });
        });
    }

    if (event.data.type === 'GET_CACHE_INFO') {
        caches.open(CACHE_NAME).then(cache => {
            cache.keys().then(requests => {
                event.ports?.[0]?.postMessage({
                    cacheName: CACHE_NAME,
                    cacheSize: requests.length,
                    version: CONTENT_VERSION
                });
            });
        });
    }
});

// Periodic sync for updates (if supported)
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', (event) => {
        if (event.tag === 'update-check') {
            event.waitUntil(performUpdateCheck());
        }
    });
}

async function performUpdateCheck() {
    console.log('[Service Worker] Performing periodic update check');

    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();

        for (const request of requests) {
            try {
                const networkResponse = await fetch(request);
                if (networkResponse.ok) {
                    await cache.put(request, networkResponse.clone());
                }
            } catch (error) {
                // Ignore failed requests
            }
        }

        console.log('[Service Worker] Update check completed');
    } catch (error) {
        console.log('[Service Worker] Update check failed:', error);
    }
}