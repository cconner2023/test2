// serviceWorker.js
const CACHE_NAME = 'pwa-cache-v2'; // Update version to force refresh
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
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          // Always fetch from network first
          const fetchPromise = fetch(event.request).then(networkResponse => {
            // Update cache with fresh response
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(err => {
            console.log('Fetch failed; returning cached version', err);
            // Return cached version if network fails
            return response;
          });
          
          // Return cached version immediately while fetching update
          return response || fetchPromise;
        });
      })
    );
  }
});
