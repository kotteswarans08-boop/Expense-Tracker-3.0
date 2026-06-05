const CACHE_NAME = 'expense-tracker-v3';
const BASE = '/Expense-Tracker-3.0';

// Everything your app needs to work offline
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/expense_app_icon_512x512.png',
  // External CDN assets — cached on first use
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// ── INSTALL: pre-cache core assets ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local files strictly; CDN files best-effort
      const local = [BASE + '/', BASE + '/index.html', BASE + '/manifest.json', BASE + '/expense_app_icon_512x512.png'];
      const cdn   = [
        'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap',
        'https://cdn.jsdelivr.net/npm/chart.js'
      ];
      return cache.addAll(local).then(() =>
        Promise.allSettled(cdn.map(url =>
          cache.add(url).catch(() => {/* ignore CDN failures */})
        ))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete old caches ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ───────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For navigation requests (opening the app, refreshing) —
  // ALWAYS serve index.html from cache. This is the fix for the
  // 404-on-reopen bug with GitHub Pages subdirectory hosting.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(BASE + '/index.html').then(cached => {
        if (cached) return cached;
        return fetch(event.request).catch(() =>
          caches.match(BASE + '/index.html')
        );
      })
    );
    return;
  }

  // For all other requests: cache-first, then network, then cache fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache valid responses from our origin or allowed CDNs
        if (
          response.ok &&
          (url.origin === self.location.origin ||
           url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com' ||
           url.hostname === 'cdn.jsdelivr.net')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If completely offline and not cached, return index.html as fallback
        if (url.pathname.startsWith(BASE)) {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});
