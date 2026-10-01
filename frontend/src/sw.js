/* global self, caches */
const PRECACHE = 'wv-shell-v2';
const API_CACHE_PREFIX = 'wv-api-';
const IMAGE_CACHE_PREFIX = 'wv-image-';
const OCR_CACHE = 'wv-tesseract-v1';
const MAX_IMAGE_ENTRIES = 50;
const MAX_API_AGE = 24 * 60 * 60 * 1000;
const PRECACHE_URLS = self.__WB_MANIFEST.map((entry) => entry.url);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('wv-shell-') && name !== PRECACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_USER_CACHE' && /^[A-Za-z0-9-]{1,100}$/.test(event.data.userId || '')) {
    event.waitUntil(Promise.all([
      caches.delete(`${API_CACHE_PREFIX}${event.data.userId}`),
      caches.delete(`${IMAGE_CACHE_PREFIX}${event.data.userId}`)
    ]));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/tesseract/')) {
    event.respondWith(cacheFirst(request, OCR_CACHE));
    return;
  }

  if (url.pathname.startsWith('/api/auth/')) return;

  if (url.pathname.startsWith('/api/')) {
    const userId = userIdFromRequest(request);
    if (!userId) return;
    const isImage = /^\/api\/products\/[^/]+\/images\/(?:bill|warranty-card)$/.test(url.pathname);
    const cacheName = `${isImage ? IMAGE_CACHE_PREFIX : API_CACHE_PREFIX}${userId}`;
    event.respondWith(isImage ? staleWhileRevalidate(request, cacheName, event) : networkFirst(request, cacheName, event));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
  }
});

function userIdFromRequest(request) {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+([^.]+)\./i)?.[1];
  if (!token) return '';
  try {
    const payload = JSON.parse(self.atob(token.replace(/-/g, '+').replace(/_/g, '/')));
    return /^[A-Za-z0-9-]{1,100}$/.test(payload.sub || '') ? payload.sub : '';
  } catch {
    return '';
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  let timeout;
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Network timeout')), 3000); })
    ]);
    if (response.ok) {
      event.waitUntil(cache.put(request, withCachedAt(response)));
      return response;
    }
    if (response.status === 401 || response.status === 403) return response;
    return cached || response;
  } catch {
    if (cached && Date.now() - Number(cached.headers.get('X-WV-Cached-At') || 0) <= MAX_API_AGE) return cached;
    if (cached) await cache.delete(request);
    return new Response(JSON.stringify({ title: 'Offline', detail: 'This record is not available offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/problem+json' }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGE_ENTRIES)).map((key) => cache.delete(key)));
    }

    return response;
  });
  if (cached) {
    event.waitUntil(update.catch(() => undefined));
    return cached;
  }
  return update;
}

function withCachedAt(response) {
  const headers = new Headers(response.headers);
  headers.set('X-WV-Cached-At', String(Date.now()));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
