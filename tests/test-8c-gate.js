// Phase 8c gate: (1) real adoptRemote consumes the LIVE production payload,
// (2) push functions audited with an injected fake fb - every write target
// and payload shape is checked against the v2-only policy.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');
const livePayload = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

const els = {};
const mkEl = () => ({
  _attrs: {}, innerHTML: '', textContent: '', value: '', href: '', style: {}, dataset: {},
  classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
  getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; },
  addEventListener(){}, appendChild(){}, click(){}, focus(){}, blur(){},
  querySelector: () => mkEl(), querySelectorAll: () => [],
});
const documentStub = {
  documentElement: { _attrs: { 'data-theme': 'light' }, getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; } },
  activeElement: null,
  querySelector: sel => (els[sel] = els[sel] || mkEl()),
  querySelectorAll: () => [], createElement: () => mkEl(), body: { style: {}, appendChild(){} },
};
const store = { jp27_sync: '0' };
const localStorageStub = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const mkLayer = () => ({ addTo(){ return this; }, bindPopup(){ return this; }, bindTooltip(){ return this; }, on(){ return this; } });
const L = { map: () => ({ setView(){ return this; }, on(){ return this; }, invalidateSize(){}, getZoom(){ return 11; }, addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){} }),
  tileLayer: () => mkLayer(), polyline: () => mkLayer(), marker: () => mkLayer(), circleMarker: () => mkLayer(), polygon: () => mkLayer(), geoJSON: () => mkLayer(),
  layerGroup: () => ({ addTo(){ return this; }, addLayer(){} }), divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }) };

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return { state, adoptRemote, pushRemote, pushPlaces, pushTitle,
    _setFb: (f, on) => { fb = f; syncOn = on; }, getState: () => state };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L,
  () => Promise.resolve({ ok: true, json: async () => [] }), () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // ---- (1) real adoptRemote x LIVE payload ----
  const localBefore = api.state.places.length;
  const res = api.adoptRemote(livePayload);
  check('live: adoptRemote consumes production payload without throwing', !!res);
  check('live: remote places adopted (220 from prod)', api.state.places.length === 220 && res.changed === true);
  check('live: original days mirrored to origDays (21)', api.state.origDays.length === 21 &&
    api.state.origDays.every(d => d.label && d.date));
  check('live: v2 detected (not missing)', res.v2Missing === false);
  check('live: v2 days restored with arrays repaired', Array.isArray(api.state.days) && api.state.days.length === 21 &&
    api.state.days.every(d => Array.isArray(d.stops) && Array.isArray(d.trans)));
  check('live: tripTitle adopted', api.state.tripTitle === livePayload.tripTitle);
  check('live: seed count was ' + localBefore + ', no data invented', localBefore === 190);

  // ---- (2) push audit with injected fake fb ----
  const writes = [];
  const fakeFb = {
    set: (node, payload) => { writes.push({ node, payload }); return Promise.resolve(); },
    v2Node: 'NODE:state/v2', titleNode: 'NODE:tripTitle', placesNode: 'NODE:state/places', rootNode: 'NODE:root',
  };
  api._setFb(fakeFb, true);

  api.pushRemote();
  check('policy: pushRemote targets state/v2 only', writes.length === 1 && writes[0].node === 'NODE:state/v2');
  const v2keys = Object.keys(writes[0].payload).sort();
  check('policy: v2 payload = {check,days,rate,updatedAt,v} exactly', JSON.stringify(v2keys) === JSON.stringify(['check','days','rate','updatedAt','v']));
  check('policy: v2 payload has NO places/transfers/tripTitle/origDays',
    !('places' in writes[0].payload) && !('transfers' in writes[0].payload) &&
    !('tripTitle' in writes[0].payload) && !('origDays' in writes[0].payload));

  writes.length = 0;
  api.pushPlaces(); await sleep(900); // debounced 800ms
  check('policy: pushPlaces targets state/places only', writes.length === 1 && writes[0].node === 'NODE:state/places');
  check('policy: pushPlaces sends the places array as-is', Array.isArray(writes[0].payload) && writes[0].payload.length === 220);

  writes.length = 0;
  api.state.tripTitle = 'Gate 8c';
  api.pushTitle(); await sleep(700); // debounced 600ms
  check('policy: pushTitle targets tripTitle scalar only', writes.length === 1 && writes[0].node === 'NODE:tripTitle' && writes[0].payload === 'Gate 8c');

  // ---- no write path can ever reach the original model ----
  check('policy: no fb.set on rootNode anywhere in source', !/fb\.set\(fb\.rootNode/.test(appJs));
  check('policy: exactly 3 fb.set call sites in source', (appJs.match(/fb\.set\(/g) || []).length === 3);

  console.log(fail ? '\n' + fail + ' FAILURES' : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
