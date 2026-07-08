// Phase 12 verification: PROVENANCE model. Boots the real app.js under Node
// with DOM/Leaflet stubs and checks the stable, historical provenance axis
// (ours | dani | instagram | ai): seed backfill, id-based history, immutability
// under adoption (§12.13), idempotency, and placeView exposure.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

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
  ;return { state, provenanceOf, ensureProvenance, placeView };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);
const VALID = ['ours', 'dani', 'instagram', 'ai'];

// ---- 1) Every seed place has a valid provenance ----
check('seed: every place has a provenance in {ours,dani,instagram,ai}',
  api.state.places.length > 0 && api.state.places.every(p => VALID.indexOf(p.provenance) >= 0));

// ---- 2) id prefix is the historical signal ----
check('dani_* place → dani', byId('dani_fushimi_inari') && byId('dani_fushimi_inari').provenance === 'dani');
check('catalog_* place → ai', byId('catalog_sensoji') && byId('catalog_sensoji').provenance === 'ai');
check('curated-key entry (nakamise) → ai', byId('nakamise') && byId('nakamise').provenance === 'ai');
check('airport marker (nrt) → ai', byId('nrt') && byId('nrt').provenance === 'ai');

// ---- 3) hotels: booked reservation vs "por reservar" placeholder ----
check('booked hotel (apa_asakusabashi) → ours', byId('apa_asakusabashi') && byId('apa_asakusabashi').provenance === 'ours');
check('hotel base placeholder (hotel_tokyo) → ai', byId('hotel_tokyo') && byId('hotel_tokyo').provenance === 'ai');

// ---- 4) provenanceOf classifies synthetic inputs correctly ----
check('provenanceOf: user-created id_* → ours',
  api.provenanceOf({ id: 'id_abc123', source: 'user', category: 'otro' }) === 'ours');
check('provenanceOf: source insta → instagram',
  api.provenanceOf({ id: 'id_x', source: 'insta', category: 'otro' }) === 'instagram');
check('provenanceOf: plain catalog place → ai',
  api.provenanceOf({ id: 'catalog_x', category: 'templo' }) === 'ai');

// ---- 5) Immutability under adoption (§12.13): a Dani place adopted stays dani ----
const adoptedDani = { id: 'dani_fake', source: 'user', dani: false, daniAdopted: true, category: 'otro' };
check('adopted Dani place still classifies as dani (id + daniAdopted)',
  api.provenanceOf(adoptedDani) === 'dani');

// ---- 6) Backfill is idempotent and never overwrites an existing provenance ----
const kept = { id: 'catalog_keepme', category: 'templo', provenance: 'dani' }; // deliberately "wrong" but pre-set
api.ensureProvenance([kept]);
check('ensureProvenance never overwrites an existing provenance (history is immutable)', kept.provenance === 'dani');
const before = JSON.stringify(api.state.places.map(p => p.provenance));
api.ensureProvenance(api.state.places);
check('ensureProvenance is idempotent on the seed (no changes on 2nd run)',
  JSON.stringify(api.state.places.map(p => p.provenance)) === before);

// ---- 7) placeView exposes provenance to the UI ----
const pv = api.placeView(byId('dani_fushimi_inari'));
check('placeView exposes provenance', pv && pv.provenance === 'dani');

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
