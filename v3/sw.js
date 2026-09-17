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
const SHELL = ['./', './lib/timezone.js', './lib/model.js', './lib/storage.js', './lib/hecho-overrides.js', './lib/bases.js', './lib/agenda.js'];

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

/* import/*.json es DATO VIVO (el volcado que escribe tools/v3-migrate-import.js
   cada vez que se re-ejecuta), no shell estático: va SIEMPRE por red, nunca
   por caché — mismo criterio que v2 con RTDB/Nominatim/OSRM.

   El resto del shell (html/js propios) va RED PRIMERO, caché de respaldo
   solo si la red falla — al revés que el cache-first de v2 (adecuado ahí,
   la app ya está publicada). Aquí, en desarrollo activo, cache-first hacía
   que cada cambio tardase una recarga extra en verse: la primera mostraba
   lo viejo, la segunda ya lo nuevo (bug real, encontrado 2026-09-16 al
   probar los cambios de esta misma fase). Con red primero se ve al
   instante y solo cae a caché sin conexión — que es justo lo que este SW
   de desarrollo necesita demostrar, no más. */
// Solo http/https del propio origen o de una CDN permitida son cacheables
// (bug real, 2026-09-17: la Cache API rechaza cualquier otro esquema --
// "Request scheme 'chrome-extension' is unsupported" -- al recargar con
// alguna extensión de Chrome instalada, el fetch de sus propios recursos
// pasaba por este listener igual que cualquier petición de la página).
// Lo que no cumple esto se IGNORA del todo (sin respondWith): la red lo
// sirve directamente, como si este SW no existiera para esa petición.
const CDNS_PERMITIDAS = ['unpkg.com'];
function esCacheable(url){
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.origin === self.location.origin || CDNS_PERMITIDAS.includes(url.hostname);
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(!esCacheable(url)) return; // deja pasar, sin respondWith: red directa
  if(url.pathname.includes('/import/')) return; // deja pasar, sin respondWith: red directa
  e.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const res = await fetch(req);
      if(res && res.status === 200) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req);
      if(hit) return hit;
      throw err;
    }
  }));
});
