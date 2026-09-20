const CACHE_NAME = 'smartloan-ai-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/css/style.css',
  '/js/background.js',
  '/js/interactions.js',
  '/js/theme.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never cache API/prediction calls — ML prediction must always be live, never offline
  if (event.request.url.includes('/loan/') || event.request.url.includes('/admin/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => caches.match('/')))
  );
});