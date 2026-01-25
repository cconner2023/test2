// public/service-worker.js - FIXED VERSION
const CACHE_NAME = 'adtmc-cache-v1';
const BASE_PATH = '/ADTMC/';
const CONTENT_VERSION = 'v1';

const urlsToCache = [
    BASE_PATH, // This serves index.html
    BASE_PATH + 'manifest.json'
];

self.addEventListener('install', function (event) {
    console.log('Service worker installing for path:', BASE_PATH);
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('Cache opened');

                // Cache each URL individually
                const cachePromises = urlsToCache.map(url => {
                    return cache.add(url).catch(error => {
                        console.log('Failed to cache:', url, error);
                        return Promise.resolve(); // Don't fail the whole install
                    });
                });

                return Promise.all(cachePromises);
            })
            .catch(function (error) {
                console.error('Cache opening failed:', error);
            })
    );
});

self.addEventListener('activate', function (event) {
    console.log('Service worker activating');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', function (event) {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Only handle requests to our own origin AND our base path
    if (!url.origin.startsWith(self.location.origin)) return;
    if (!url.pathname.startsWith(BASE_PATH)) return;

    // Special handling for navigation requests
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Try network first for navigation
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) {
                        // Update cache in background
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(BASE_PATH, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    console.log('Network failed, falling back to cache');
                    // Network failed, try cache
                    const cachedResponse = await caches.match(BASE_PATH);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If no cache, throw the error
                    throw error;
                }
            })()
        );
        return;
    }

    // For non-navigation requests (assets, etc.)
    event.respondWith(
        (async () => {
            // Try cache first
            const cachedResponse = await caches.match(event.request);

            if (cachedResponse) {
                console.log('Serving from cache:', event.request.url);

                // Check for updates in background
                fetch(event.request)
                    .then(async (networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            const cache = await caches.open(CACHE_NAME);
                            const cachedText = await cachedResponse.text();
                            const networkText = await networkResponse.clone().text();

                            if (cachedText !== networkText) {
                                console.log('Content updated:', event.request.url);
                                await cache.put(event.request, networkResponse.clone());

                                // Notify clients
                                const clients = await self.clients.matchAll();
                                clients.forEach(client => {
                                    client.postMessage({
                                        type: 'CONTENT_UPDATED',
                                        url: event.request.url
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

            // Not in cache, fetch from network
            console.log('Fetching from network:', event.request.url);
            try {
                const networkResponse = await fetch(event.request);

                if (networkResponse.ok) {
                    // Cache the response
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(event.request, networkResponse.clone());
                    console.log('Cached:', event.request.url);
                }

                return networkResponse;
            } catch (error) {
                console.log('Fetch failed:', event.request.url, error);

                // For JS/CSS files that fail, you could return a fallback
                if (event.request.destination === 'script' ||
                    event.request.destination === 'style') {
                    // Return empty response or custom fallback
                    return new Response('', {
                        status: 408,
                        statusText: 'Offline'
                    });
                }

                throw error;
            }
        })()
    );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    console.log('Service worker received message:', event.data);

    if (event.data === 'skipWaiting' || event.data.action === 'skipWaiting') {
        console.log('Skipping waiting');
        self.skipWaiting();
    }

    if (event.data.type === 'CHECK_UPDATES') {
        console.log('Checking for updates');

        // Normalize URLs - only check unique ones
        const uniqueUrls = [...new Set(event.data.urls)];

        uniqueUrls.forEach(url => {
            fetch(url, { cache: 'no-store' })
                .then(response => {
                    if (response.ok) {
                        return caches.open(CACHE_NAME).then(cache => {
                            return cache.match(url).then(cachedResponse => {
                                if (cachedResponse) {
                                    return Promise.all([
                                        cachedResponse.text(),
                                        response.clone().text()
                                    ]).then(([cachedText, networkText]) => {
                                        if (cachedText !== networkText) {
                                            console.log('Update found for:', url);
                                            cache.put(url, response.clone());

                                            // Notify clients
                                            self.clients.matchAll().then(clients => {
                                                clients.forEach(client => {
                                                    client.postMessage({
                                                        type: 'CONTENT_UPDATED',
                                                        url: url
                                                    });
                                                });
                                            });
                                        }
                                    });
                                }
                            });
                        });
                    }
                })
                .catch(error => {
                    console.log('Update check failed for:', url, error);
                });
        });
    }
});