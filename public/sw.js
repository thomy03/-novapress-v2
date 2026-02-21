/**
 * NovaPress AI — Service Worker v2.1
 * 
 * Strategy:
 *   - Network-first for everything (dev-friendly)
 *   - Cache images and fonts for offline
 *   - Push notifications support
 *   - Background sync for offline actions
 */

const CACHE_VERSION = 'novapress-v2.1';
const CACHE_NAME = `${CACHE_VERSION}-runtime`;

// ─── Install ───

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2.1...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// ─── Activate ───

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2.1...');

  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from same origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.protocol === 'chrome-extension:') return;

  // Skip Next.js HMR / dev websockets
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;
  if (url.pathname.startsWith('/__nextjs')) return;

  // Images & fonts → cache-first (safe, they don't change often)
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else → network-first (always fresh, cache as fallback)
  event.respondWith(networkFirst(request));
});

// ─── Strategies ───

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Only cache successful responses
    if (response.ok && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed → try cache
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Serving from cache:', request.url);
      return cached;
    }
    // No cache either → return offline page for navigation
    if (request.destination === 'document') {
      return new Response(
        '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>📡 Hors connexion</h1><p>NovaPress n\'est pas disponible hors ligne pour le moment.</p><button onclick="location.reload()">Réessayer</button></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      );
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return transparent pixel for failed images
    if (request.destination === 'image') {
      return new Response(
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        { headers: { 'Content-Type': 'image/gif' } }
      );
    }
    throw error;
  }
}

// ─── Push Notifications ───

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'NovaPress AI', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || `novapress-${Date.now()}`,
    data: { url: data.url || '/' },
    requireInteraction: data.requireInteraction || false,
    actions: [
      { action: 'open', title: '📰 Lire' },
      { action: 'close', title: 'Fermer' },
    ],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'NovaPress AI', options)
  );
});

// ─── Notification Click ───

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── Background Sync ───

self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('[SW] Performing background sync...');
}

// ─── Messages ───

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});