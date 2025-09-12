// service-worker.js
const CACHE_NAME = 'pwa-cache-v1';
const REPO_PATH = "/test2/";
const urlsToCache = [
  REPO_PATH,
  REPO_PATH + 'index.html',
  REPO_PATH + 'testing.css',
  REPO_PATH + 'testing.js',
  REPO_PATH + 'manifest.json'
  // Add other assets you need to cache
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

