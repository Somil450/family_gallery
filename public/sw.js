/**
 * FamVault Service Worker
 * Handles Web Share Target POST requests and forwards files to the main app.
 */

const CACHE_NAME = 'famvault-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg'
];

// ── Install / Activate ────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// ── Share Target & Offline Fallback ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Handle Web Share Target POST
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // 2. Network-first strategy for navigation / app shell
  if (event.request.mode === 'navigate' || APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and update cache
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request) || caches.match('/'))
    );
    return;
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = [];

    // Collect all shared files
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && (value.type.startsWith('image/') || value.type.startsWith('video/'))) {
        files.push(value);
      }
    }

    if (files.length > 0) {
      // Forward files to all open app windows
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SHARE_TARGET_FILES', files });
      }
    }
  } catch (err) {
    console.error('[FamVault SW] Share target error:', err);
  }

  // Redirect to the app root (with marker so the app knows to handle shared files)
  return Response.redirect('/?share-target=1', 303);
}
