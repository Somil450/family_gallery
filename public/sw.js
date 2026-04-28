/**
 * FamVault Service Worker
 * Handles Web Share Target POST requests and forwards files to the main app.
 */

const CACHE_NAME = 'famvault-v1';

// ── Install / Activate ────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── Share Target POST handler ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
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
