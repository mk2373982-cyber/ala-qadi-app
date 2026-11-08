const CACHE_PREFIX = 'ala-qaddi-';
const CACHE_NAME = 'ala-qaddi-v2';
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      } catch {
        // Keep installing if an optional shell asset is temporarily unavailable.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_URLS' || !Array.isArray(event.data.urls)) return;

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = [...new Set(event.data.urls)]
      .filter((value) => typeof value === 'string')
      .map((value) => new URL(value, self.location.origin))
      .filter((url) => url.origin === self.location.origin && !url.pathname.startsWith('/api/'));

    await Promise.all(urls.map(async (url) => {
      try {
        const response = await fetch(url.href, { credentials: 'same-origin' });
        if (response.ok && response.type === 'basic') {
          await cache.put(url.href, response);
        }
      } catch {
        // An offline client can still use everything already in the cache.
      }
    }));
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const isNavigation = request.mode === 'navigate';
  const isAppAsset = url.pathname.startsWith('/_next/static/') || /\.(?:css|js|woff2?|png|svg|ico)$/i.test(url.pathname);
  if (!isNavigation && !isAppAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigation) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          try { await cache.put(request, response.clone()); } catch { /* Some dynamic responses cannot be cached. */ }
        }
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match('/')) || Response.error();
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        try { await cache.put(request, response.clone()); } catch { /* Use the network response even if it is not cacheable. */ }
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
