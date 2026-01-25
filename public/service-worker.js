// public/service-worker.js - UPDATED MESSAGE HANDLING
const CACHE_NAME = 'adtmc-cache-v2.6';
const BASE_PATH = '/ADTMC/';
const CONTENT_VERSION = 'v1';

const urlsToCache = [
    BASE_PATH,
    BASE_PATH + 'manifest.json'
];

self.addEventListener('install', function (event) {
    console.log('Service worker installing for path:', BASE_PATH);
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('Cache opened, adding files');
                // Cache each file individually to avoid duplicates
                return Promise.all(
                    urlsToCache.map(url => {
                        return cache.add(new Request(url, { cache: 'reload' }))
                            .catch(error => {
                                console.log('Failed to cache:', url, error);
                            });
                    })
                );
            })
    );
});

self.addEventListener('activate', function (event) {
    console.log('Service worker activating');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('adtmc-cache-')) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(self.location.origin)) return;

    const url = new URL(event.request.url);
    if (!url.pathname.startsWith(BASE_PATH)) return;

    event.respondWith(
        (async () => {
            try {
                // Try cache first
                const cachedResponse = await caches.match(event.request);

                // Always fetch from network in background for updates
                const fetchPromise = fetch(event.request);

                if (cachedResponse) {
                    // Check if content has changed
                    fetchPromise.then(async networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            const cache = await caches.open(CACHE_NAME);
                            const cachedText = await cachedResponse.text();
                            const networkText = await networkResponse.clone().text();

                            if (cachedText !== networkText) {
                                console.log('Content changed, updating cache:', event.request.url);
                                await cache.put(event.request, networkResponse.clone());

                                // Notify clients
                                const clients = await self.clients.matchAll();
                                clients.forEach(client => {
                                    client.postMessage({
                                        type: 'CONTENT_UPDATED',
                                        url: event.request.url,
                                        timestamp: new Date().toISOString()
                                    });
                                });
                            }
                        }
                    }).catch(() => {
                        // Network failed, ignore
                    });

                    return cachedResponse;
                }

                // Not in cache, fetch and cache
                const networkResponse = await fetchPromise;
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(event.request, networkResponse.clone());
                    console.log('Cached new resource:', event.request.url);
                }

                return networkResponse;
            } catch (error) {
                console.log('Fetch failed:', event.request.url, error);
                throw error;
            }
        })()
    );
});

// Message handler
self.addEventListener('message', (event) => {
    console.log('Service worker received message:', event.data);

    if (event.data === 'skipWaiting' || event.data.action === 'skipWaiting') {
        console.log('Skipping waiting');
        self.skipWaiting();
    }

    if (event.data.type === 'CHECK_UPDATES') {
        console.log('Checking for updates for URLs:', event.data.urls);

        event.data.urls.forEach(url => {
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
                                                        url: url,
                                                        timestamp: new Date().toISOString()
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