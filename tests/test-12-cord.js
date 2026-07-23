// Phase 12 Stage 3 verification: the CORD composite (Cord + DayNode + Hotel
// Thread). Boots the real app.js with DOM/Leaflet stubs, renders the Cord into
// #cord, and checks: 21 DayNodes, certainty materials (Ink planned / Washi
// empty), the --stay-* hotel thread grouped by consecutive city, flight-day
// clasp, and the fill indicator.
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
  ;return { startApp, state, renderCord, cordStays, cordFill, zoomToDay, zoomOut, setItinAlt, addPlaceToDay };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
api.startApp(); // Prioridad 4: arranque real gateado tras auth; los tests lo disparan a mano.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const count = (s, sub) => s.split(sub).length - 1;

// ---- render the Cord ----
api.renderCord();
const html = els['#cord'].innerHTML;

// ---- 1) one DayNode per day ----
check('cord: one DayNode per day (21)', count(html, 'class="cord-day') === api.state.days.length && api.state.days.length === 21);

// ---- 2) certainty materials present ----
check('cord: planned days render as Ink (m-ink)', html.includes('cord-day m-ink'));
const hasEmpty = api.state.days.some(d => !d.flight && (!d.stops || d.stops.length === 0));
check('cord: empty day renders as Washi (m-washi) when one exists', !hasEmpty || html.includes('m-washi'));

// ---- 3) flight days are gold clasps ----
check('cord: flight day carries is-flight-day clasp', html.includes('is-flight-day'));

// ---- 4) hotel thread uses the --stay-* neutral ramp (not the accent) ----
check('cord: hotel thread uses --stay-* ramp', /--stay:var\(--stay-[1-4]\)/.test(html));

// ---- 5) fill indicator present ----
check('cord: fill indicator rendered', html.includes('cord-fill'));

// ---- 6) cordStays: the thread follows the REAL booking (12.52) ----
// It used to group by day.city — the proposal speaking for the trip. Now the
// thread only exists where a confirmed booking covers the night; an unbooked
// night has nothing to thread (tone 0). Fixture = two real bookings.
api.state.places.push(
  { id: 'test_stay_a', name: 'Reserva A', category: 'alojamiento', source: 'user', provenance: 'ours',
    region: 'Tokio', lat: 35.7, lng: 139.7, checkIn: '2030-01-01', checkOut: '2030-01-03' },
  { id: 'test_stay_b', name: 'Reserva B', category: 'alojamiento', source: 'user', provenance: 'ours',
    region: 'Kioto', lat: 35.0, lng: 135.7, checkIn: '2030-01-04', checkOut: '2030-01-06' },
);
const stays = api.cordStays([
  { date: '2030-01-01' }, { date: '2030-01-02' },   // reserva A, dos noches
  { date: '2030-01-03', flight: [1] },              // vuelo: rompe el hilo
  { date: '2030-01-04' }, { date: '2030-01-05' },   // reserva B, dos noches
  { date: '2030-01-09' },                           // noche sin reserva
]);
const tones = stays.map(s => s.tone);
check('cordStays: consecutive nights on ONE booking share a tone (unbroken thread)', tones[0] === 1 && tones[1] === 1);
check('cordStays: flight day breaks the thread (tone 0)', tones[2] === 0 && stays[2].flight === true);
check('cordStays: a different booking starts a new tone', tones[3] === 2 && tones[4] === 2);
check('cordStays: an unbooked night has no thread (tone 0 — asserts nothing)', tones[5] === 0);
api.state.places = api.state.places.filter(p => !/^test_stay_/.test(p.id));

// ---- 7) cordFill: 0..3 filled dots ----
check('cordFill: 0 stops -> no filled dots', api.cordFill(0) === '<i class=""></i><i class=""></i><i class=""></i>');
check('cordFill: 2 stops -> 2 filled dots', count(api.cordFill(2), 'class="on"') === 2);
check('cordFill: 5 stops -> capped at 3 filled dots', count(api.cordFill(5), 'class="on"') === 3);

// ---- 8) The Zoom: altitude switching (Trip <-> Day) ----
const view = () => els['#view-itinerario']._attrs['data-alt'];
api.setItinAlt('trip');
check('zoom: starts at Trip altitude', view() === 'trip');
api.zoomToDay(3);
check('zoom in: tapping a day switches to Day altitude', view() === 'day');
api.zoomOut();
check('zoom out: returns to Trip altitude', view() === 'trip');

// ---- 9) Plant: adding a place lands on the day at Day altitude ----
els['#addToDay'] = mkEl(); els['#addToDay'].value = '1';
const beforeN = api.state.days[1].stops.length;
api.addPlaceToDay('catalog_sensoji');
check('plant: place added to the chosen day', api.state.days[1].stops.length === beforeN + 1 && api.state.days[1].stops.some(s => s.pid === 'catalog_sensoji'));
check('plant: lands at Day altitude (zoomed in)', view() === 'day');

// ---- 10) EmptyState: an empty day is an invitation, not blank ----
api.state.days[5].stops = [];
api.zoomToDay(5);
check('empty day: shows a "Día libre" invitation (not blank)', els['#dayPanel'].innerHTML.includes('Día libre'));

// ---- 11) provenance is visible in the itinerary flow ----
api.zoomToDay(1); // day 1 holds the planted stop (catalog_sensoji)
check('itinerary: stops do NOT show provenance marks (our trip, one voice — certainty over provenance)',
  !els['#dayPanel'].innerHTML.includes('prov-tag'));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
