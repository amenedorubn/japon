// Phase 12 Stage 6 verification: the AXIS navigation (Ideas <- Plan ->
// Confirmado). Rightward means more certain. The three primary regions map to
// existing views (sitios/itinerario/inicio); Mapa/Guia/Hoteles stay off-axis.
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
  // NOTE: no addEventListener -> the app guards document listeners behind a check
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
  ;return { showTab, axisGo, axisIndexOf, getCurTab: () => curTab, AXIS_REGIONS, setItinAlt };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// ---- 1) axis order: Ideas <- Plan -> Confirmado ----
check('axis: order is [Ideas=sitios, Plan=itinerario, Confirmado=inicio]',
  api.AXIS_REGIONS.join(',') === 'sitios,itinerario,inicio');
check('axisIndexOf: sitios=0 (Ideas)', api.axisIndexOf('sitios') === 0);
check('axisIndexOf: itinerario=1 (Plan)', api.axisIndexOf('itinerario') === 1);
check('axisIndexOf: inicio=2 (Confirmado)', api.axisIndexOf('inicio') === 2);
check('axisIndexOf: off-axis tabs return -1', api.axisIndexOf('mapa') === -1 && api.axisIndexOf('guia') === -1 && api.axisIndexOf('hoteles') === -1);

// ---- 2) rightward = more certain, leftward = less ----
api.showTab('itinerario');
api.axisGo(1);
check('axis: rightward from Plan reaches Confirmado (more certain)', api.getCurTab() === 'inicio');
api.axisGo(1);
check('axis: cannot go past the certain end (clamped)', api.getCurTab() === 'inicio');
api.axisGo(-1); api.axisGo(-1);
check('axis: leftward reaches Ideas (less certain)', api.getCurTab() === 'sitios');
api.axisGo(-1);
check('axis: cannot go past the loose end (clamped)', api.getCurTab() === 'sitios');

// ---- 3) off-axis tab: axisGo is a no-op ----
api.showTab('mapa');
api.axisGo(1);
check('axis: axisGo is a no-op from an off-axis tab (Mapa)', api.getCurTab() === 'mapa');

// ---- 4) Command Dot: single contextual action ----
api.showTab('sitios');
check('command dot: shown with an action on Ideas', els['#commandDot'].style.display === 'flex' && !!els['#commandDot']._action);
api.showTab('itinerario'); api.setItinAlt('trip');
check('command dot: hidden at Plan/Trip altitude', els['#commandDot'].style.display === 'none');
api.setItinAlt('day');
check('command dot: shown at Plan/Day altitude (+ parada)', els['#commandDot'].style.display === 'flex');
api.showTab('mapa');
check('command dot: absent on off-axis tabs', els['#commandDot'].style.display === 'none');

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
