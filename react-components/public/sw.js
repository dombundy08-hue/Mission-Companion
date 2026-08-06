/* Mission Companion service worker.
   Bump CACHE to ship a new version — the old cache is cleared on activate,
   and updated files flow in via stale-while-revalidate on the next load.
   Supabase data traffic is never cached, so cloud sync stays live/fresh.
   v9: large batch deploy (nav lock during workouts, per-section color
   tints, consolidated Health Stats/Exercise Log, onboarding flow, API
   keys moved out of Settings into a build-time embed, new built-in
   workouts, and a pile of smaller UX fixes) — bumping forces every
   session to pick up the new shell instead of trickling in piecemeal. */
const CACHE = 'mission-companion-v9';

/* v4: the React app is now the primary site (was previously the vanilla
   index.html + an embedded react-build/ iframe). Bumping CACHE purges
   every old cached entry on activate, so no stale vanilla page can ever
   be served. Vite's own bundled JS/CSS use hashed filenames that change
   every build, so they're intentionally NOT precached here — they flow
   in via the fetch handler's stale-while-revalidate on first request,
   keyed by their real (hashed) URL like everything else. Only truly
   stable, unhashed public/ assets are safe to precache by name.
   v5: section icon PNGs changed content under the same unhashed filename
   (background removed, etc.) — stale-while-revalidate alone left old
   cached bytes visible until a background revalidation happened to land.
   Bumping CACHE forces every device to refetch them fresh on next load.
   v6: same issue for favicon.png and app-icon-192/512.png (logo swap).
   v7: favicon/app-icon swapped again — Book of Mormon logo -> missionary
   silhouette pair (elder + sister) on the same navy background.
   v8: found a real crash, not just staleness — deploys after v7 deleted
   the OLD hashed JS/CSS files from the repo as part of the deploy step.
   A PWA session whose cached HTML shell (this SW's own precached/SWR'd
   index.html) hadn't yet revalidated past that point kept referencing a
   now-deleted /assets/index-XXXX.js — 404, React never mounts, blank
   white screen, and the in-app update banner never gets a chance to run
   since it's part of the React app that just failed to load. Deploys
   going forward MUST keep old hashed asset files around indefinitely
   (they're small, immutable, and harmless to leave) instead of deleting
   them — that turns "stale shell" back into "runs a slightly older but
   working version" instead of a hard crash. This bump forces every
   session to purge its cache and refetch a shell matching what's
   actually live right now. */
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './fonts/lexend-variable.woff2',
  './fonts/newsreader-variable.woff2',
];
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', event => {
  self.skipWaiting();   // activate a new SW version immediately, don't wait for old tabs to close
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

  // App shell navigations: SWR, keyed by the actual URL requested. The app is
  // entirely client-side-routed (React Router) now — every same-origin
  // navigation IS the app shell (just rendering a different view once the
  // JS loads), so every one of them falls back to the cached shell when
  // offline and uncached. GitHub Pages itself has no server-side rewrite for
  // client-side routes, so a fresh 404.html (a copy of index.html) handles
  // the direct-navigation/reload case at the host level; this SW fallback
  // covers the offline case.
  if (req.mode === 'navigate') {
    const isAppShell = url.origin === self.location.origin;
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
