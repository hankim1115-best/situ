/* Situ service worker — offline app shell + saved data.
   Bump CACHE whenever the file list or any cached file changes. */
const CACHE = 'situ-v2';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './src/styles.css',
  './src/app.js',
  './src/router.js',
  './src/chrome.js',
  './src/store.js',
  './src/api.js',
  './src/prompt.js',
  './src/ui.js',
  './src/tts.js',
  './src/packview.js',
  './src/views/home.js',
  './src/views/result.js',
  './src/views/library.js',
  './src/views/setDetail.js',
  './src/views/review.js',
  './src/views/practice.js',
  './src/views/keywords.js',
  './src/views/settings.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon-32.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map((url) => cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache API traffic.
  if (url.hostname === 'api.anthropic.com') return;
  // Only handle our own origin.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      // Refresh in the background.
      fetchAndPut(request).catch(() => {});
      return cached;
    }
    try {
      return await fetchAndPut(request);
    } catch (err) {
      const shell = await caches.match('./index.html');
      if (shell && request.mode === 'navigate') return shell;
      throw err;
    }
  })());
});

async function fetchAndPut(request) {
  const res = await fetch(request);
  if (res && res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, res.clone());
  }
  return res;
}
