// Phase 3A verification: the DANI importer (import->bake->seed).
// El array inline de daniPlace() se retiró: los 150 lugares salen ahora del
// bloque horneado DANI_PLACES (tools/dani-import.js, verificado contra el PDF)
// y un adaptador los devuelve a la forma de semilla. Lo crítico aquí es la
// PARIDAD: DANI_PLACES_RAW debe ser idéntico, campo a campo y en el mismo
// orden de claves, al snapshot congelado ANTES del refactor
// (tests/dani-seed-snapshot.json). Y los ids son inmutables: TWIN_GROUPS (60
// gemelos) y DANI_ROUTE_GROUPS (Ruta Dani) dependen de ellos.
const fs = require('fs');
const path = require('path');
const appJs = fs.readFileSync(process.argv[2], 'utf8');
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(__dirname, 'dani-seed-snapshot.json'), 'utf8'));
const IMPORTED = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'import', 'dani-places.json'), 'utf8'));

const mkEl = () => ({
  _attrs: {}, innerHTML: '', textContent: '', value: '', href: '', style: {}, dataset: {},
  classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
  getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; },
  addEventListener(){}, appendChild(){}, click(){}, focus(){}, blur(){},
  querySelector: () => mkEl(), querySelectorAll: () => [],
});
const els = {};
const documentStub = {
  documentElement: { _attrs: { 'data-theme': 'light' },
    getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; } },
  activeElement: null,
  querySelector: sel => (els[sel] = els[sel] || mkEl()),
  querySelectorAll: () => [],
  createElement: () => mkEl(),
  body: { style: {}, appendChild(){} },
};
const store = {};
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const mkLayer = () => ({ addTo(){ return this; }, bindPopup(){ return this; }, bindTooltip(){ return this; }, on(){ return this; },
  setLatLng(){ return this; }, setView(){ return this; } });
const L = {
  map: () => ({ setView(){ return this; }, on(){ return this; }, invalidateSize(){}, getZoom(){ return 11; },
    addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){} }),
  tileLayer: () => mkLayer(), polyline: () => mkLayer(), marker: () => mkLayer(),
  circleMarker: () => mkLayer(), polygon: () => mkLayer(), geoJSON: () => mkLayer(),
  layerGroup: () => ({ addTo(){ return this; }, addLayer(){} }),
  divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }),
};
const fetchStub = () => Promise.resolve({ ok: true, json: async () => [] });

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return { startApp, state, DANI_PLACES, DANI_PLACES_RAW, daniSeedEntry, ensureDaniPlaces,
    DANI_ROUTE_GROUPS, TWIN_GROUPS, twinGroupOf, provenanceOf, isConfirmed, isBookedHotel };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
api.startApp(); // Prioridad 4: arranque real gateado tras auth; los tests lo disparan a mano.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// ---- 1) PARIDAD TOTAL con el snapshot pre-refactor ----
check('snapshot: la referencia congelada trae 150 lugares', SNAPSHOT.length === 150);
check('bake: DANI_PLACES horneado trae 150 lugares', api.DANI_PLACES.length === 150);
check('adapter: DANI_PLACES_RAW reconstruye 150 lugares', api.DANI_PLACES_RAW.length === 150);
check('PARIDAD: DANI_PLACES_RAW es idéntico al snapshot pre-refactor (campos, valores y orden de claves)',
  JSON.stringify(api.DANI_PLACES_RAW) === JSON.stringify(SNAPSHOT));
if (JSON.stringify(api.DANI_PLACES_RAW) !== JSON.stringify(SNAPSHOT)) {
  const snapById = new Map(SNAPSHOT.map(p => [p.id, p]));
  api.DANI_PLACES_RAW.forEach(p => {
    const s = snapById.get(p.id);
    if (!s) { console.log('  SOBRA:', p.id); return; }
    if (JSON.stringify(s) !== JSON.stringify(p)) console.log('  DIFF:', p.id);
  });
}
// El orden del array también importa: buildSeedPlaces lo recorre en secuencia.
check('PARIDAD: mismo orden de lugares que antes del refactor',
  api.DANI_PLACES_RAW.every((p, i) => SNAPSHOT[i] && SNAPSHOT[i].id === p.id));

// ---- 2) El JSON importado y el bloque horneado son la misma verdad ----
check('import/dani-places.json trae 150 lugares', IMPORTED.length === 150);
check('bake == import: el bloque horneado coincide con import/dani-places.json',
  JSON.stringify(api.DANI_PLACES) === JSON.stringify(IMPORTED));
check('import: todos los ids llevan prefijo dani_ y son únicos',
  IMPORTED.every(p => /^dani_/.test(p.id)) && new Set(IMPORTED.map(p => p.id)).size === 150);
check('import: ningún lugar sin coordenadas (nunca se inventan)',
  IMPORTED.every(p => typeof p.lat === 'number' && typeof p.lng === 'number'));

// ---- 3) Los campos constantes que ponía daniPlace() los repone el adaptador ----
check('adapter: source/dani/dayId/time/catalogItem constantes en los 150',
  api.DANI_PLACES_RAW.every(p => p.source === 'dani' && p.dani === true &&
    p.dayId === null && p.time === '' && p.catalogItem === true));
check('adapter: los campos extra de reserva sobreviven (6 alojamientos de 2025)',
  api.DANI_PLACES_RAW.filter(p => p.checkIn).length === 6 &&
  api.DANI_PLACES_RAW.filter(p => p.bookingRef).length === 6 &&
  api.DANI_PLACES_RAW.filter(p => p.address).length === 2);
(function(){
  const rise = api.DANI_PLACES_RAW.find(p => p.id === 'dani_rise_osaka');
  check('adapter: las fechas de 2025 de Dani se conservan intactas (su viaje, no el nuestro)',
    rise && rise.checkIn === '2025-06-09' && rise.checkOut === '2025-06-11' &&
    rise.bookingRef === '380,22 €, pagado');
})();
check('adapter: daniSeedEntry no arrastra campos extra vacíos',
  api.DANI_PLACES_RAW.every(p => !('address' in p) || !!p.address));

// ---- 4) Ids INMUTABLES: gemelos (Fase 1.5) y Ruta Dani siguen resolviendo ----
const seedIds = new Set(api.DANI_PLACES_RAW.map(p => p.id));
const twinDaniMembers = api.TWIN_GROUPS.flatMap(g => g.members).filter(id => /^dani_/.test(id));
check('gemelos: los 60 grupos siguen declarando un miembro dani_*', twinDaniMembers.length === 60);
check('gemelos: los 60 miembros dani_* existen en la semilla importada',
  twinDaniMembers.every(id => seedIds.has(id)));
const missingTwins = twinDaniMembers.filter(id => !seedIds.has(id));
if (missingTwins.length) console.log('  gemelos huérfanos:', missingTwins.join(', '));
const routePids = new Set(api.DANI_ROUTE_GROUPS.flatMap(g => g.placeIds));
check('Ruta Dani: sus 14 jornadas siguen declarando paradas', api.DANI_ROUTE_GROUPS.length === 14 && routePids.size > 0);
check('Ruta Dani: todos sus placeIds existen en la semilla importada (sin paradas colgando)',
  Array.from(routePids).every(id => seedIds.has(id)));
const missingRoute = Array.from(routePids).filter(id => !seedIds.has(id));
if (missingRoute.length) console.log('  paradas huérfanas:', missingRoute.join(', '));

// ---- 5) Lo importado llega de verdad a state.places con procedencia dani ----
const inState = api.state.places.filter(p => p && /^dani_/.test(p.id));
check('siembra: los 150 lugares de Dani están en state.places', inState.length === 150);
check('siembra: todos con provenance dani', inState.every(p => (p.provenance || api.provenanceOf(p)) === 'dani'));

// ---- 6) ensureDaniPlaces: no-op en arranque normal, idempotente, repone huecos ----
check('ensureDaniPlaces: no-op en un arranque normal (la semilla ya los trae)',
  api.ensureDaniPlaces() === false);
(function(){
  const n0 = api.state.places.length;
  const idx = api.state.places.findIndex(p => p && p.id === 'dani_kix');
  const removed = api.state.places.splice(idx, 1)[0];
  check('ensureDaniPlaces: repone una entrada que faltaba (red de seguridad)',
    api.ensureDaniPlaces() === true && !!api.state.places.find(p => p.id === 'dani_kix'));
  const back = api.state.places.find(p => p.id === 'dani_kix');
  check('ensureDaniPlaces: lo repuesto es idéntico a la semilla (+ provenance)',
    back.name === removed.name && back.lat === removed.lat && back.category === removed.category &&
    back.source === 'dani' && back.dani === true && back.provenance === 'dani');
  check('ensureDaniPlaces: idempotente, no duplica en una 2ª pasada',
    api.ensureDaniPlaces() === false && api.state.places.length === n0);
})();

// ---- 7) El viaje de Dani sigue sin ser reserva nuestra tras el refactor ----
const daniLodgings = api.state.places.filter(p => p && /^dani_/.test(p.id) && p.category === 'alojamiento');
check('confirmado: sus 6 alojamientos de 2025 siguen sin contar como reservas',
  daniLodgings.length === 6 && daniLodgings.every(p => api.isBookedHotel(p) === false && api.isConfirmed(p) === false));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
