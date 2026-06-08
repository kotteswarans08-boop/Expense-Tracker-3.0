// ═══════════════════════════════════════════════════
// Service Worker — Expense Tracker 3.0
// Team Tech Royal
//
// HOW TO FORCE UPDATE ON MAC/MOBILE PWA:
// Every time you deploy a new version, increment
// CACHE_VERSION below (v1 → v2 → v3 etc.)
// This automatically deletes the old cache and
// downloads fresh files next time the app opens.
// ═══════════════════════════════════════════════════

const CACHE_VERSION = 'v4';  // ← bump this on every deploy
const CACHE_NAME = `expense-tracker-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/Expense-Tracker-3.0/',
  '/Expense-Tracker-3.0/index.html',
  '/Expense-Tracker-3.0/manifest.json',
  '/Expense-Tracker-3.0/expense_app_icon_512x512_1.png',
];

// ── Install: cache all core assets ──
self.addEventListener('install', event => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// ── Activate: delete ALL old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ── Fetch: Network-first for HTML/JS, cache-first for images ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for the backend (Google Apps Script)
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('accounts.google.com')) {
    return; // let browser handle it normally
  }

  // Network-first for HTML and JS files — always get latest version
  if (event.request.destination === 'document' ||
      event.request.url.endsWith('.html') ||
      event.request.url.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // fallback to cache if offline
    );
    return;
  }

  // Cache-first for everything else (images, fonts, etc.)
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
