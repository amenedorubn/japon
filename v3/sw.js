/* ================================================================
   JAPÓN 2027 · v3 · Service worker de desarrollo, scope /v3/
   Aislado a propósito del SW raíz de v2.1 (scope /): nombre de caché
   con prefijo propio 'japon27-v3-' para que ninguno de los dos borre
   la caché del otro en su limpieza de 'activate'.
================================================================ */
'use strict';
const CACHE = 'japon27-v3-dev';
const SHELL = ['./'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k.startsWith('japon27-v3-') && k !== CACHE)
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req);
    const refresh = fetch(req).then(res => {
      if(res && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || refresh;
  }));
});
