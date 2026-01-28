const CACHE_NAME = 'novapress-ai-v2.0.0';
const STATIC_CACHE_NAME = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE_NAME = `${CACHE_NAME}-dynamic`;
const API_CACHE_NAME = `${CACHE_NAME}-api`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/_next/static/css/app/layout.css',
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/polyfills.js'
];

// API endpoints to cache
const API_ROUTES = [
  '/api/articles',
  '/api/tags',
  '/api/categories'
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old caches that don't match current version
              return cacheName.includes('novapress-ai') && !cacheName.includes('v2.0.0');
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  // Skip cross-origin requests (backend API at different port)
  if (url.origin !== self.location.origin) {
    return;
  }

  
  // API requests - Network first strategy
  if (API_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(networkFirstStrategy(request, API_CACHE_NAME));
    return;
  }
  
  // Images - Cache first strategy
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE_NAME));
    return;
  }
  
  // Static assets - Cache first strategy
  if (url.pathname.startsWith('/_next/static/') || 
      url.pathname.startsWith('/static/') ||
      url.pathname.includes('.css') ||
      url.pathname.includes('.js')) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
    return;
  }
  
  // HTML pages - Stale while revalidate strategy
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE_NAME));
    return;
  }
  
  // Default to network
  event.respondWith(fetch(request));
});

// Cache first strategy - good for static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first strategy failed:', error);
    return new Response('Network error occurred', { 
      status: 500,
      statusText: 'Network Error'
    });
  }
}

// Network first strategy - good for dynamic content
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Network error and no cached version available', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stale while revalidate - good for frequently updated content
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, but we might have cache
    return cachedResponse;
  });
  
  // Return cached version immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'NovaPress AI',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || `novapress-${Date.now()}`,
    data: {
      url: data.url || '/',
    },
    requireInteraction: data.requireInteraction || false,
    actions: [
      { action: 'open', title: 'Lire' },
      { action: 'close', title: 'Fermer' },
    ],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'NovaPress AI', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a NovaPress window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here
  // For example, send queued analytics or user actions
  console.log('[SW] Performing background sync...');
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_ARTICLES') {
    // Cache specific articles for offline reading
    const articles = event.data.articles;
    cacheArticlesForOffline(articles);
  }
});

async function cacheArticlesForOffline(articles) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  
  for (const article of articles) {
    try {
      const response = await fetch(`/api/articles/${article.id}`);
      if (response.ok) {
        await cache.put(`/api/articles/${article.id}`, response.clone());
      }
    } catch (error) {
      console.error('[SW] Failed to cache article:', article.id, error);
    }
  }
}

// Cleanup old cache entries periodically
setInterval(async () => {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    if (cacheName.includes(DYNAMIC_CACHE_NAME)) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      // Remove entries older than 7 days
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const request of requests) {
        const response = await cache.match(request);
        const dateHeader = response?.headers.get('date');
        
        if (dateHeader && new Date(dateHeader).getTime() < oneWeekAgo) {
          await cache.delete(request);
        }
      }
    }
  }
}, 24 * 60 * 60 * 1000); // Run daily