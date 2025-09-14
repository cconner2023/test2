const CACHE_NAME = 'pwa-cache-v1';
const BASE_PATH = self.location.pathname.replace(/serviceWorker\.js$/, '');
const CACHE_BUSTER = 'v3'; // UPDATE THIS WHEN FILES CHANGE

const urlsToCache = [
  BASE_PATH,
  `${BASE_PATH}index.html?cb=${CACHE_BUSTER}`,
  `${BASE_PATH}testing.css?cb=${CACHE_BUSTER}`,
  `${BASE_PATH}testing.js?cb=${CACHE_BUSTER}`,
  `${BASE_PATH}manifest.json?cb=${CACHE_BUSTER}`
];

self.addEventListener('install', function(event) {
  console.log('Service worker installing with cache buster:', CACHE_BUSTER);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache opened, adding files with cache buster');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('All resources cached successfully');
        return self.skipWaiting();
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
    // Network-first strategy for HTML requests
    if (event.request.url.includes('index.html') || 
        event.request.method !== 'GET') {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            // Update cache
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
            return response;
          })
          .catch(() => caches.match(event.request))
      );
    } else {
      // Stale-while-revalidate for other assets
      event.respondWith(
        caches.match(event.request)
          .then(cachedResponse => {
            // Always fetch from network in background
            const fetchPromise = fetch(event.request)
              .then(networkResponse => {
                // Update cache
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, responseClone));
                return networkResponse;
              })
              .catch(err => {
                console.log('Fetch failed:', err);
              });
            
            // Return cached response immediately, then update
            return cachedResponse || fetchPromise;
          })
      );
    }
  }
});
