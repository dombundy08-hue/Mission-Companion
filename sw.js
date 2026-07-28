/* Mission Companion service worker.
   Bump CACHE to ship a new version — the old cache is cleared on activate,
   and updated files flow in via stale-while-revalidate on the next load.
   Supabase data traffic is never cached, so cloud sync stays live/fresh. */
const CACHE = 'mission-companion-v1';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
];
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Core app shell must all cache for offline to work.
    await cache.addAll(CORE);
    // The CDN script is best-effort — don't fail install if it's unreachable.
    try { await cache.add(CDN); } catch (e) { /* will be cached on first fetch */ }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Serve from cache immediately, refresh the cache from the network in the
   background so the newest version is ready for the next load. */
async function staleWhileRevalidate(request, key) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(key, res.clone());
    }
    return res;
  }).catch(() => null);
  return cached || network.then(r => r || cache.match('./index.html'));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // never intercept cloud writes
  const url = new URL(req.url);

  // Supabase data API / auth / realtime — always straight to the network so
  // sync is never served stale. Offline failures are handled by the app.
  if (url.hostname.endsWith('.supabase.co')) return;

  // App shell navigations: SWR, falling back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(req, './index.html'));
    return;
  }

  // Our own static assets + the Supabase CDN script: cache-first + bg refresh.
  if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(staleWhileRevalidate(req, req));
    return;
  }

  // Anything else: normal network.
});
