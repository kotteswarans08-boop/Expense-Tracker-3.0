// ── Expense Tracker Service Worker ──────────────────────────
const CACHE_NAME = 'expense-tracker-v4';
const BASE = '/Expense-Tracker-3.0';

const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/expense_app_icon_512x512_1.png',
];

// ── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local files strictly
      return cache.addAll(PRECACHE_URLS).then(() => {
        // Cache CDN files best-effort (don't fail install if offline)
        const cdnUrls = [
          'https://cdn.jsdelivr.net/npm/chart.js',
          'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap',
          'https://accounts.google.com/gsi/client'
        ];
        return Promise.allSettled(
          cdnUrls.map(url => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip Google OAuth and API requests — never cache these
  if (
    url.hostname === 'accounts.google.com' ||
    url.hostname === 'oauth2.googleapis.com' ||
    url.pathname.includes('/gsi/') ||
    url.pathname.includes('script.google.com')
  ) {
    return; // Let browser handle normally
  }

  // For navigation (app opens, refreshes) — serve index.html from cache
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

  // For all other requests: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid responses from our origin or allowed CDNs
        if (
          response && response.ok &&
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
        // Offline fallback
        if (url.pathname.startsWith(BASE)) {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});
