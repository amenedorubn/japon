/* ============================================================================
   EXPORTADOR DE CALENDARIO (.ics) — Prioridad 5, fase de viaje
   ----------------------------------------------------------------------------
   Genera ficheros .ics ESTÁTICOS a partir de index.html, publicados junto a
   la app en GitHub Pages con una URL ESTABLE (mismo patrón que
   Ruta-21-dias.docx/JAPON-DEFINITIVO-Dani.pdf: assets versionados en la raíz
   del repo, no generados en tiempo de ejecución). Eso permite suscribirse
   desde Google Calendar ("Otros calendarios → Desde URL") en vez de solo
   descargar un .ics suelto cada vez.

   LIMITACIÓN RECONOCIDA (no maquillada): GitHub Pages es estático — no hay
   servidor que regenere el fichero al vuelo en cada petición. "Se actualiza
   solo" significa "se actualiza la próxima vez que alguien ejecuta este
   script y hace commit + push", igual que ya pasa con el docx de la Ruta.
   Automatizarlo de verdad (p.ej. una GitHub Action programada que también
   lea el volcado EN VIVO de Firebase) es una decisión de arquitectura aparte
   — no implementado aquí sin decisión explícita del usuario.

   ruta-japon-2027.ics: siempre completo, sale ÍNTEGRO de RUTA_DAYS/TRANSPORT/
   FLIGHTS (datos horneados en index.html, sin dependencia externa).

   realidad-japon-2027.ics: el plan real vive en Firebase (sincronizado entre
   los 3 móviles), no en el repo — "el plan real nace vacío" (M10/12.49). Sin
   argumento extra, este script genera solo lo que ya hay horneado en la
   semilla (los 2 días de vuelo). Para el plan real completo, pásale un
   volcado en vivo (mismo patrón que test-8c-gate.js):
     curl https://viaje-japon-8748a-default-rtdb.firebaseio.com/proyectos/viaje-japon.json > live.json
     node tools/ics-export.js live.json

   USO:  node tools/ics-export.js [volcado-firebase.json]
============================================================================ */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>\s*<\/body>/);
if(!m){ console.error('No se encontró el bloque <script> principal en index.html'); process.exit(1); }
const appJs = m[1];

const mkEl = () => ({
  _attrs: {}, innerHTML: '', textContent: '', value: '', href: '', style: {}, dataset: {},
  classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
  getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; },
  addEventListener(){}, appendChild(){}, click(){}, focus(){}, blur(){},
  querySelector: () => mkEl(), querySelectorAll: () => [],
});
const documentStub = {
  documentElement: { _attrs: {}, getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; } },
  activeElement: null,
  querySelector: () => mkEl(), querySelectorAll: () => [],
  createElement: () => mkEl(), body: { style: {}, appendChild(){} },
};
const store = { jp27_sync: '0' };
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const L = {
  map: () => ({ setView(){ return this; }, on(){ return this; }, invalidateSize(){}, getZoom(){ return 11; },
    addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){}, createPane: () => ({ style: {} }) }),
  tileLayer: () => ({addTo(){ return this; }}), polyline: () => ({addTo(){ return this; }, bindPopup(){ return this; }}),
  marker: () => ({addTo(){ return this; }, bindPopup(){ return this; }, bindTooltip(){ return this; }}),
  circleMarker: () => ({addTo(){ return this; }}), polygon: () => ({addTo(){ return this; }}),
  geoJSON: () => ({addTo(){ return this; }}), layerGroup: () => ({addTo(){ return this; }, addLayer(){}}),
  divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }),
};
const fetchStub = () => Promise.resolve({ ok: true, json: async () => ({}) });

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return { rutaICS, realidadICS, adoptRemote, state };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

const liveDumpPath = process.argv[2];
if(liveDumpPath){
  const payload = JSON.parse(fs.readFileSync(liveDumpPath, 'utf8'));
  api.adoptRemote(payload);
  console.log('Volcado en vivo aplicado: ' + liveDumpPath);
} else {
  console.log('Sin volcado en vivo: realidad-japon-2027.ics saldrá solo con los días de vuelo (la semilla nace sin paradas).');
}

fs.writeFileSync(path.join(root, 'ruta-japon-2027.ics'), api.rutaICS());
fs.writeFileSync(path.join(root, 'realidad-japon-2027.ics'), api.realidadICS());
console.log('Escritos ruta-japon-2027.ics y realidad-japon-2027.ics en la raíz del repo.');
