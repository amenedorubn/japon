/* ================================================================
   JAPÓN 2027 · Service worker (Fase 10c, cierra R4)
   Cache-first con refresco en segundo plano: la app entera (un solo
   index.html + PDF de Dani + CDNs versionadas) funciona sin conexión
   por Japón, y cuando hay red se refresca sola; la siguiente apertura
   estrena la versión nueva, sin avisos ni recargas a mitad de uso.
   El nombre de caché solo hay que subirlo si cambia la lista SHELL:
   el contenido se renueva solo en cada visita con red.
================================================================ */
'use strict';
const CACHE = 'japon27-v1';
const SHELL = ['./', './JAPON-DEFINITIVO-Dani.pdf'];

/* CDNs de recursos estáticos versionados, cacheables bajo demanda.
   Todo lo demás (teselas del mapa, Nominatim, OSRM, Overpass, RTDB)
   va SIEMPRE por red: son datos vivos o con su propia caché local. */
const RUNTIME_HOSTS = [
  'unpkg.com',            // Leaflet js/css
  'fonts.googleapis.com', // hoja de estilos de Inter / Noto Serif JP
  'fonts.gstatic.com',    // ficheros woff2
  'www.gstatic.com'       // módulos de Firebase (URL con versión)
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k.startsWith('japon27-') && k !== CACHE)
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Sirve de caché al instante y refresca en segundo plano. Solo se
   guardan respuestas completas (200) u opacas de CDN; nunca parciales
   (206 del visor de PDF) ni errores. */
function cacheFirst(e, req, fallbackKey){
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = (await cache.match(req)) || (fallbackKey ? await cache.match(fallbackKey) : null);
    const refresh = fetch(req).then(res => {
      if(res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || refresh;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  // Navegación: el shell (index.html), con './' como red de seguridad
  if(req.mode === 'navigate'){ cacheFirst(e, req, './'); return; }
  const url = new URL(req.url);
  if(url.origin === self.location.origin || RUNTIME_HOSTS.includes(url.hostname)){
    cacheFirst(e, req);
  }
  // resto: red directa (sin respondWith el navegador sigue su curso)
});
