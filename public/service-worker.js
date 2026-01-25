// public/service-worker.js
const CACHE_NAME = 'adtmc-cache-v1.1';
const BASE_PATH = '/ADTMC/';
const CONTENT_VERSION = 'v1';

// Only list each URL once
const urlsToCache = [
    BASE_PATH, // This is the same as BASE_PATH + 'index.html' for Vite apps
    BASE_PATH + 'manifest.json'
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

    event.respondWith(
        (async () => {
            try {
                // First, try to get from cache
                const cachedResponse = await caches.match(event.request);

                // Always try to fetch from network
                const fetchPromise = fetch(event.request);

                if (cachedResponse) {
                    console.log('Serving from cache:', event.request.url);

                    // Check for updates in background
                    fetchPromise.then(async (networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const cache = await caches.open(CACHE_NAME);
                            const cachedText = await cachedResponse.text();
                            const networkText = await networkResponse.clone().text();

                            if (cachedText !== networkText) {
                                console.log('Content updated:', event.request.url);
                                await cache.put(event.request, networkResponse.clone());

                                // Notify clients about update
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
                const networkResponse = await fetchPromise;

                if (networkResponse && networkResponse.status === 200) {
                    // Cache the new response
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(event.request, networkResponse.clone());
                    console.log('Cached:', event.request.url);
                }

                return networkResponse;
            } catch (error) {
                console.log('Fetch failed for:', event.request.url, error);
                // Could return an offline page here
                throw error;
            }
        })()
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