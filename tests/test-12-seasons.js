// Phase 12 Stage 7 verification: SEASONS. The product evolves with the trip:
// planning -> countdown -> threshold -> during -> after, on objective
// thresholds around COUNTDOWN_TARGET (2027-04-08 10:15 +02) and TRIP_END
// (2027-04-28). Plus dayRecap (per-day summary for the Recap).
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
  ;return { state, tripPhase, dayRecap };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const at = s => new Date(s);

// ---- 1) the Seasons state machine ----
check('phase: far out is planning', api.tripPhase(at('2026-01-01T00:00:00Z')) === 'planning');
check('phase: 16 days out is still planning', api.tripPhase(at('2027-03-23T10:15:00+02:00')) === 'planning');
check('phase: <=14 days out is countdown', api.tripPhase(at('2027-04-01T10:15:00+02:00')) === 'countdown');
check('phase: the eve/day-0 is threshold', api.tripPhase(at('2027-04-07T12:00:00+02:00')) === 'threshold');
check('phase: at departure it is during', api.tripPhase(at('2027-04-08T10:15:00+02:00')) === 'during');
check('phase: mid-trip is during', api.tripPhase(at('2027-04-15T09:00:00+02:00')) === 'during');
check('phase: after TRIP_END is after (memory)', api.tripPhase(at('2027-05-01T00:00:00Z')) === 'after');

// ---- 2) dayRecap ----
const d = api.state.days.find(x => x.stops && x.stops.length) || api.state.days[2];
const r = api.dayRecap(d);
check('dayRecap: stops matches the day', r.stops === (d.stops ? d.stops.length : 0));
check('dayRecap: done <= stops, numeric costs', r.done <= r.stops && typeof r.entr === 'number' && typeof r.trans === 'number');
check('dayRecap: null-safe', (() => { const z = api.dayRecap(null); return z.stops === 0 && z.done === 0; })());

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
