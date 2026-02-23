/* ── QuestLog Service Worker — offline-capable static asset cache ─────────── */

const CACHE_NAME = 'questlog-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/pixel.css',
  '/css/components.css',
  '/js/app.js',
  '/js/api.js',
  '/js/dashboard.js',
  '/js/quest-form.js',
  '/js/quest-detail.js',
  '/js/badges.js',
  '/js/profile.js',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static assets, network-first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go network for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
