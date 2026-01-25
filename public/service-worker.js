// public/service-worker.js
const CACHE_NAME = 'adtmc-cache-v1'; // Changed to simpler name
const BASE_PATH = '/ADTMC/';
const CONTENT_VERSION = 'v1';

// Only list each URL once
const urlsToCache = [
    BASE_PATH, // This is the same as BASE_PATH + 'index.html' for Vite apps
    BASE_PATH + 'manifest.json'
    // Remove duplicate entries
];

self.addEventListener('install', function (event) {
    console.log('Service worker installing for path:', BASE_PATH);
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('Cache opened, adding files:', urlsToCache);
                // Filter out any duplicates
                const uniqueUrls = [...new Set(urlsToCache)];
                console.log('Unique URLs to cache:', uniqueUrls);
                return cache.addAll(uniqueUrls);
            })
            .catch(function (error) {
                console.error('Cache addAll failed:', error);
                // Don't fail the install if caching fails
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

    // For Vite apps, BASE_PATH often serves index.html
    // So we need to handle the root path specially
    const requestUrl = url.pathname === BASE_PATH || url.pathname === BASE_PATH.slice(0, -1)
        ? BASE_PATH
        : event.request.url;

    event.respondWith(
        caches.match(requestUrl)
            .then(function (response) {
                // Return cached response if found
                if (response) {
                    console.log('Serving from cache:', requestUrl);
                    return response;
                }

                // Otherwise fetch from network
                console.log('Fetching from network:', requestUrl);
                return fetch(event.request)
                    .then(function (networkResponse) {
                        // Don't cache if not successful
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Clone the response
                        const responseToCache = networkResponse.clone();

                        // Add to cache
                        caches.open(CACHE_NAME)
                            .then(function (cache) {
                                cache.put(requestUrl, responseToCache);
                                console.log('Cached:', requestUrl);
                            });

                        return networkResponse;
                    })
                    .catch(function (error) {
                        console.log('Fetch failed for:', requestUrl, error);
                        // For offline, you could return a custom offline page
                        // return caches.match(BASE_PATH + 'offline.html');
                        throw error;
                    });
            })
    );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data === 'checkForUpdates') {
        self.registration.update();
    }
});

// Simple content check on fetch
self.addEventListener('fetch', function (event) {
    // Only for GET requests to our origin
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Let the first fetch handler above handle the response
    // This second handler just monitors for updates
    event.respondWith(
        (async () => {
            try {
                const response = await fetch(event.request);

                // If response is good, check if content changed
                if (response.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match(event.request);

                    if (cachedResponse) {
                        const cachedText = await cachedResponse.text();
                        const networkText = await response.clone().text();

                        if (cachedText !== networkText) {
                            console.log('Content updated:', event.request.url);
                            // Update cache
                            await cache.put(event.request, response.clone());

                            // Notify clients
                            const clients = await self.clients.matchAll();
                            clients.forEach(client => {
                                client.postMessage({
                                    type: 'CONTENT_UPDATED',
                                    url: event.request.url
                                });
                            });
                        }
                    } else {
                        // New resource, cache it
                        await cache.put(event.request, response.clone());
                    }
                }

                return response;
            } catch (error) {
                // Network failed, try cache
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                throw error;
            }
        })()
    );
});