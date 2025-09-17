const CACHE_NAME = 'pwa-cache-v1';
const BASE_PATH = self.location.pathname.replace(/serviceWorker\.js$/, '');
// Add a content version to force updates when content changes
const CONTENT_VERSION = 'v2';

const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'testing.css',
  BASE_PATH + 'testing.js',
  BASE_PATH + 'manifest.json'
];

self.addEventListener('install', function(event) {
  console.log('Service worker installing for path:', BASE_PATH);
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache opened, adding files:', urlsToCache);
        // Add content version to each request to bust cache
        const versionedRequests = urlsToCache.map(url => {
          return new Request(url, {
            headers: {'X-Content-Version': CONTENT_VERSION}
          });
        });
        return cache.addAll(versionedRequests);
      })
  );
});

self.addEventListener('activate', function(event) {
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

self.addEventListener('fetch', function(event) {
  // Only handle requests to our own origin
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          // Always fetch from network in the background to check for updates
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              // Check if content has changed
              if (networkResponse.status === 200) {
                // Compare with cached version
                caches.open(CACHE_NAME).then(cache => {
                  cache.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                      cachedResponse.text().then(cachedText => {
                        networkResponse.clone().text().then(networkText => {
                          if (cachedText !== networkText) {
                            // Content has changed, update cache
                            cache.put(event.request, networkResponse.clone());
                            // Notify clients about the update
                            self.clients.matchAll().then(clients => {
                              clients.forEach(client => {
                                client.postMessage({
                                  type: 'CONTENT_UPDATED',
                                  url: event.request.url
                                });
                              });
                            });
                          }
                        });
                      });
                    } else {
                      // New resource, add to cache
                      cache.put(event.request, networkResponse.clone());
                    }
                  });
                });
              }
              return networkResponse;
            })
            .catch(() => {
              // Network request failed, do nothing
            });
          
          // Return cached response if available, otherwise wait for network
          return response || fetchPromise;
        })
    );
  }
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CHECK_UPDATES') {
    // Check for updates to specific resources
    event.data.urls.forEach(url => {
      fetch(url)
        .then(response => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.match(url).then(cachedResponse => {
                if (cachedResponse) {
                  cachedResponse.text().then(cachedText => {
                    response.clone().text().then(networkText => {
                      if (cachedText !== networkText) {
                        // Content has changed, update cache
                        cache.put(url, response.clone());
                        // Notify clients about the update
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
                  });
                }
              });
            });
          }
        })
        .catch(() => {
          // Network request failed
        });
    });
  }
});
