// Phase 12 §9.4 verification: HOTEL HYGIENE (ensureHotelFixes). Idempotent,
// no-loss: merges the id_* APA Asakusabashi twin into the canonical
// apa_asakusabashi (fold booking fields, re-point itinerary pids, remove twin)
// and adds Louis House Otsuka Nishi as a confirmed booking (provenance ours).
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
  ;return { state, ensureHotelFixes, isBookedHotel, isConfirmed, provenanceOf, hotelForNight };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);

// ---- 1) Louis House added by the startup fix ----
const louis = byId('id_louis_otsuka_nishi');
check('louis: added at startup', !!louis);
check('louis: confirmed booked hotel, provenance ours', !!louis && api.isBookedHotel(louis) && api.isConfirmed(louis) &&
  (louis.provenance === 'ours' || api.provenanceOf(louis) === 'ours'));
check('louis: booking dates 9->12 abril', !!louis && louis.checkIn === '2027-04-09' && louis.checkOut === '2027-04-12');
check('louis: canonical id_* preserved', !!byId('id_louis_otsuka_nishi'));

// ---- 2) idempotent: no re-add ----
const n0 = api.state.places.length;
check('fix: idempotent (Louis not re-added)', api.ensureHotelFixes() === false && api.state.places.length === n0);

// ---- 3) APA twin merge (inject a live-style twin) ----
const apa = byId('apa_asakusabashi');
apa.checkIn = ''; apa.address = ''; apa.hotelPhone = '';
api.state.places.push({ id: 'id_test_twin', name: 'APA Hotel Asakusabashi Ekimae', category: 'alojamiento',
  source: 'user', lat: 35.698, lng: 139.785, checkIn: '2027-04-25', checkOut: '2027-04-27',
  address: 'Taito-ku Asakusabashi 1-27-9', hotelPhone: '+81 3-5821-6511' });
api.state.days[1].stops.push({ id: 'st_twin', pid: 'id_test_twin', time: '20:00', dur: 30, done: false });

const changed = api.ensureHotelFixes();
check('merge: reports a change', changed === true);
check('merge: twin removed from places', !byId('id_test_twin'));
check('merge: booking fields folded into canonical apa (no loss)',
  byId('apa_asakusabashi').checkIn === '2027-04-25' && /Asakusabashi/.test(byId('apa_asakusabashi').address || ''));
check('merge: itinerary stop re-pointed to canonical id (no dangling pid)',
  api.state.days[1].stops.some(s => s.id === 'st_twin' && s.pid === 'apa_asakusabashi') &&
  !api.state.days[1].stops.some(s => s.pid === 'id_test_twin'));
check('merge: canonical apa is still a confirmed booked hotel', api.isBookedHotel(byId('apa_asakusabashi')) && api.isConfirmed(byId('apa_asakusabashi')));

// ---- 4) hotelForNight: reservations connect to the real trip nights ----
check('night: a covered night maps to Louis House', api.hotelForNight('2027-04-10') && api.hotelForNight('2027-04-10').id === 'id_louis_otsuka_nishi');
check('night: the checkout night is not covered', !api.hotelForNight('2027-04-12'));
check('night: an unbooked night returns null', api.hotelForNight('2027-04-18') === null);

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
