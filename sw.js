/*
   Mission Companion was retired from this domain on 2026-09-28. missionarycompanion.com
   now serves one thing: the player for the voice memo in Dominic's weekly letter home.

   This file is a tombstone, and it has to keep being served.

   Phones that installed the old app still have a service worker registered at the root
   scope. That worker cached the app shell and served it stale-while-revalidate, so simply
   deleting sw.js would leave those phones showing a cached Mission Companion - possibly
   at a letter's address - and referencing /assets/ files that no longer exist. A worker
   only stands down if it is replaced by one that stands itself down, which is what this
   is: it takes over immediately, throws away every cache, unregisters itself, and reloads
   whatever windows it had, which then get the real pages from the network.

   It intercepts no fetches at all. Leave it here.
*/

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) { /* nothing cached, or storage refused - either way, carry on */ }

    try { await self.registration.unregister(); } catch (e) {}

    try {
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach(c => { try { c.navigate(c.url); } catch (e) {} });
    } catch (e) {}
  })());
});
