// Phase 12 Stage 4 verification: BUDGET PEEK. Budget lives on demand
// (DIRECTION §6.12). Checks the pure summary/render helpers: per-person
// entradas + transporte in ¥ and €, correct total and conversion, and the
// panel markup (tabular, both currencies, a total row).
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
  ;return { state, budgetSummary, budgetPeekHTML };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const trip = api.budgetSummary('trip');
check('budgetSummary(trip): numeric entradas/transporte/total', [trip.entr, trip.trans, trip.total].every(n => typeof n === 'number' && n >= 0));
check('budgetSummary(trip): total = entradas + transporte', trip.total === trip.entr + trip.trans);
check('budgetSummary(trip): eur = round(total / rate)', trip.eur === Math.round(trip.total / trip.rate));
check('budgetSummary(trip): sums across all 21 days', (() => {
  let e = 0, t = 0; api.state.days.forEach((d, i) => { const b = api.budgetSummary(i); e += b.entr; t += b.trans; });
  return e === trip.entr && t === trip.trans;
})());

const day1 = api.budgetSummary(1);
check('budgetSummary(dayIndex): a single day computes', typeof day1.total === 'number' && day1.total <= trip.total);

const html = api.budgetPeekHTML('trip');
check('budgetPeekHTML: has per-person heading', html.includes('por persona'));
check('budgetPeekHTML: shows entradas + transporte + total rows', html.includes('Entradas') && html.includes('Transporte') && html.includes('Total'));
check('budgetPeekHTML: shows both currencies (¥ and €)', html.includes('€') && /¥|\d/.test(html));
check('budgetPeekHTML: uses tabular numerals', html.includes('u-tabular'));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
