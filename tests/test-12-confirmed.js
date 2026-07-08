// Phase 12 Stage 5 verification: the CONFIRMED state (Foil Press model).
// Confirmed is a deliberate, additive place flag orthogonal to provenance (§4):
// flights and the two booked hotels are confirmed by nature; sealing sets an
// explicit `confirmed` flag; unsealing only clears an explicit flag (never the
// by-nature ones); provenance is never touched.
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
  ;return { state, isBookedHotel, isConfirmed, sealPlace, unsealPlace, placeView, provenanceOf, openPlace };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);

// ---- 1) isBookedHotel ----
check('isBookedHotel: booked reservation (apa) true', api.isBookedHotel(byId('apa_asakusabashi')) === true);
check('isBookedHotel: "por reservar" base false', api.isBookedHotel(byId('hotel_tokyo')) === false);
check('isBookedHotel: a temple is not a hotel', api.isBookedHotel(byId('catalog_sensoji')) === false);

// ---- 2) confirmed by nature vs not ----
check('isConfirmed: booked hotel is confirmed by nature', api.isConfirmed(byId('apa_asakusabashi')) === true);
check('isConfirmed: a plain place is not confirmed initially', api.isConfirmed(byId('catalog_sensoji')) === false);

// ---- 3) sealing is a deliberate act, sets the additive flag ----
const before = byId('catalog_sensoji').provenance;
check('seal: sealPlace confirms a place', api.sealPlace('catalog_sensoji') === true && api.isConfirmed(byId('catalog_sensoji')) === true);
check('seal: sets the additive confirmed flag', byId('catalog_sensoji').confirmed === true);
check('seal: provenance is NOT touched by sealing (§12.13 axis separation)', byId('catalog_sensoji').provenance === before);
check('seal: sealing an already-confirmed place is a no-op', api.sealPlace('catalog_sensoji') === false);

// ---- 4) unsealing clears only an explicit flag ----
check('unseal: unsealPlace clears an explicit confirmed flag', api.unsealPlace('catalog_sensoji') === true && api.isConfirmed(byId('catalog_sensoji')) === false);
check('unseal: a by-nature confirmed hotel cannot be unsealed here', api.unsealPlace('apa_asakusabashi') === false && api.isConfirmed(byId('apa_asakusabashi')) === true);

// ---- 5) placeView exposes confirmed ----
check('placeView exposes confirmed', api.placeView(byId('apa_asakusabashi')).confirmed === true);
check('placeView: unconfirmed place reads confirmed=false', api.placeView(byId('catalog_ueno') || byId('catalog_sensoji')).confirmed === false);

// ---- 6) Foil Press UI in the place detail (openPlace) ----
api.openPlace('apa_asakusabashi'); // confirmed by nature
const m1 = els['#modalBox'].innerHTML;
check('detail: confirmed place shows "✓ Confirmado"', m1.includes('Confirmado'));
check('detail: by-nature confirmed offers no seal button and no unseal', !m1.includes('id="pfSeal"') && !m1.includes('id="pfUnseal"'));
api.openPlace('catalog_sensoji'); // unconfirmed (sealed then unsealed above)
const m2 = els['#modalBox'].innerHTML;
check('detail: unconfirmed place offers hold-to-seal', m2.includes('id="pfSeal"') && m2.toLowerCase().includes('sellar'));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
