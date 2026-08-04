/* Mission Companion service worker.
   Bump CACHE to ship a new version — the old cache is cleared on activate,
   and updated files flow in via stale-while-revalidate on the next load.
   Supabase data traffic is never cached, so cloud sync stays live/fresh. */
const CACHE = 'mission-companion-v2';

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
   background so the newest version is ready for the next load. `key` is
   always the actual request being served — every distinct URL (the app
   shell, the react-build iframe pages, etc.) gets its own cache entry.
   `fallback` is what to serve if this exact URL was never cached and the
   network is unreachable (true offline fallback, not a forced substitution). */
async function staleWhileRevalidate(request, fallback) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(request, res.clone());
    }
    return res;
  }).catch(() => null);
  return cached || network.then(r => r || (fallback ? cache.match(fallback) : null));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // never intercept cloud writes
  const url = new URL(req.url);

  // Supabase data API / auth / realtime — always straight to the network so
  // sync is never served stale. Offline failures are handled by the app.
  if (url.hostname.endsWith('.supabase.co')) return;

  // App shell navigations: SWR, keyed by the actual URL requested. Only the
  // top-level app itself falls back to the cached shell when offline and
  // uncached — the react-build iframe pages (?app=health / ?app=exercise)
  // must never be substituted with the outer app shell.
  if (req.mode === 'navigate') {
    const isAppShell = url.pathname === '/' || url.pathname.endsWith('/index.html') && !url.pathname.includes('react-build');
    event.respondWith(staleWhileRevalidate(req, isAppShell ? './index.html' : null));
    return;
  }

  // Our own static assets + the Supabase CDN script: cache-first + bg refresh.
  if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(staleWhileRevalidate(req, null));
    return;
  }

  // Anything else: normal network.
});
