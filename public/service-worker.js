// public/service-worker.js - FIXED VERSION
const CACHE_NAME = 'adtmc-cache-v1';
const BASE_PATH = '/ADTMC/';
const CONTENT_VERSION = 'v1';

// IMPORTANT: Only cache ONE version of the root path
// In Vite/React, BASE_PATH serves index.html, so don't cache both
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

                // Cache each URL individually to avoid any duplicates
                const cachePromises = urlsToCache.map(url => {
                    // Normalize the URL to avoid duplicates
                    const normalizedUrl = url.endsWith('/') ? url : url;

                    // Use Request with cache busting to avoid duplicates
                    const request = new Request(normalizedUrl, {
                        headers: { 'Cache-Control': 'no-cache' }
                    });

                    return cache.add(request).catch(error => {
                        console.log('Failed to cache:', normalizedUrl, error);
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

    // Only handle requests to our own origin
    if (!event.request.url.startsWith(self.location.origin)) return;

    const url = new URL(event.request.url);

    // Skip if not in our base path
    if (!url.pathname.startsWith(BASE_PATH)) return;

    // For navigation requests (HTML), always use the root path
    let requestToHandle = event.request;
    if (event.request.mode === 'navigate') {
        // For navigation, always use the base path
        requestToHandle = new Request(BASE_PATH, event.request);
    }

    event.respondWith(
        (async () => {
            try {
                // Try to get from cache first
                const cachedResponse = await caches.match(requestToHandle);

                // Always try network
                const networkFetch = fetch(event.request);

                if (cachedResponse) {
                    console.log('Serving from cache:', event.request.url);

                    // Check for updates in background
                    networkFetch.then(async (networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const cache = await caches.open(CACHE_NAME);
                            const cachedText = await cachedResponse.text();
                            const networkText = await networkResponse.clone().text();

                            if (cachedText !== networkText) {
                                console.log('Content updated:', event.request.url);
                                await cache.put(requestToHandle, networkResponse.clone());

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
                    }).catch(() => {
                        // Network failed, ignore
                    });

                    return cachedResponse;
                }

                // Not in cache, fetch from network
                console.log('Fetching from network:', event.request.url);
                const networkResponse = await networkFetch;

                if (networkResponse && networkResponse.status === 200) {
                    // Cache the response
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(requestToHandle, networkResponse.clone());
                    console.log('Cached:', event.request.url);
                }

                return networkResponse;
            } catch (error) {
                console.log('Fetch failed:', event.request.url, error);

                // If it's a navigation request and we have the root cached, return that
                if (event.request.mode === 'navigate') {
                    const fallback = await caches.match(BASE_PATH);
                    if (fallback) {
                        return fallback;
                    }
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

        // Normalize URLs to avoid duplicates
        const uniqueUrls = [...new Set(event.data.urls)];

        uniqueUrls.forEach(url => {
            // Don't check both /ADTMC/ and /ADTMC/index.html
            if (url === BASE_PATH + 'index.html' && uniqueUrls.includes(BASE_PATH)) {
                return; // Skip index.html if we're already checking BASE_PATH
            }

            fetch(url, { cache: 'no-store' })
                .then(response => {
                    if (response.status === 200) {
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