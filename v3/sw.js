/* ================================================================
   JAPÓN 2027 · v3 · Service worker de desarrollo, scope /v3/
   Aislado a propósito del SW raíz de v2.1 (scope /): nombre de caché
   con prefijo 'jp27v3-', que NO empieza por 'japon27-' a propósito.
   El SW raíz borra en su 'activate' cualquier caché que empiece por
   'japon27-' salvo la suya; con este prefijo distinto no puede
   alcanzar la caché de v3 aunque el raíz se reactive algún día.
================================================================ */
'use strict';
const CACHE = 'jp27v3-dev';
const SHELL = ['./', './lib/timezone.js', './lib/model.js', './lib/storage.js', './lib/hecho-overrides.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k.startsWith('jp27v3-') && k !== CACHE)
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
