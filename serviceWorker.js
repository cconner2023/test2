// serviceWorker.js
const CACHE_NAME = 'pwa-cache-v3'; // Increment version
const BASE_PATH = self.location.pathname.replace(/serviceWorker\.js$/, '');

// Add timestamp to cache name to force refresh
const urlsToCache = [
  BASE_PATH,
  `${BASE_PATH}index.html?t=${Date.now()}`,
  `${BASE_PATH}testing.css?t=${Date.now()}`,
  `${BASE_PATH}testing.js?t=${Date.now()}`,
  `${BASE_PATH}manifest.json?t=${Date.now()}`
];

self.addEventListener('install', function(event) {
  console.log('Service worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache opened, adding files');
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
          // Delete all old caches
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
  // Network-first strategy
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
});
