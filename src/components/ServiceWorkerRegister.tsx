'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    navigator.serviceWorker
      .register('/sw.js')
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        if (cancelled) return;

        const worker = navigator.serviceWorker.controller || registration.active;
        if (!worker) return;

        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => new URL(entry.name, window.location.href))
          .filter((url) => url.origin === window.location.origin)
          .map((url) => `${url.pathname}${url.search}`);

        worker.postMessage({ type: 'CACHE_URLS', urls: ['/', window.location.pathname, ...urls] });
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
