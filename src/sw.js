/**
 * FamVault Service Worker
 * Handles Web Share Target POST requests and forwards files to the main app.
 */

import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// This is the injection point for Vite PWA to insert all hashed assets (HTML, JS, CSS)
precacheAndRoute(self.__WB_MANIFEST);

// ── Install / Activate ────────────────────────────────────────────────────────
self.skipWaiting();
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Share Target & Offline Fallback ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Handle Web Share Target POST
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Navigation requests let Workbox / HTML handle it
  if (event.request.mode === 'navigate') {
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
