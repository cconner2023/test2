const CACHE_NAME = 'pwa-cache-v2'; // Change version to bust cache
const BASE_PATH = self.location.pathname.replace(/serviceWorker\.js$/, '');

const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'testing.css',
  BASE_PATH + 'testing.js', 
  BASE_PATH + 'manifest.json'
];

self.addEventListener('install', function(event) {
  console.log('Service worker installing for path:', BASE_PATH);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache opened, adding files:', urlsToCache);
        return cache.addAll(urlsToCache.map(url => {
          // Add cache-busting parameter to each request
          return `${url}?v=${CACHE_NAME.replace(/\D/g, '')}`;
        }));
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
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          // Always fetch from network first, fall back to cache
          return fetch(event.request)
            .then(networkResponse => {
              // Update cache with fresh response
              return caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
                });
            })
            .catch(() => {
              // If network fails, return cached version
              return response;
            });
        })
    );
  }
});
