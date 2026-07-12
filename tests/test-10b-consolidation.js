// Phase 10b verification: single itinerary/transfer model. Boots the ENTIRE
// real app.js and exercises the one-time migration of the original model
// (pair-based transfers + dayId assignments) into the canonical v2 model.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

// ---------- DOM stubs ----------
const els = {};
const mkEl = () => ({
  _attrs: {}, innerHTML: '', textContent: '', value: '', href: '', style: {}, dataset: {},
  classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
  getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; },
  addEventListener(){}, appendChild(){}, click(){}, focus(){}, blur(){},
  querySelector: () => mkEl(), querySelectorAll: () => [],
});
const documentStub = {
  documentElement: { _attrs: { 'data-theme': 'light' },
    getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; } },
  activeElement: null,
  querySelector: sel => (els[sel] = els[sel] || mkEl()),
  querySelectorAll: () => [],
  createElement: () => mkEl(),
  body: { style: {}, appendChild(){} },
};
const store = { jp27_sync: '0' };
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
  ;return { state, adoptRemote, pushRemote, maybeMigrateOriginal,
    parseLegacyMinutes, parseLegacyYen, legacyMode, legacyOptionToV2,
    _setFb: (f, on) => { fb = f; syncOn = on; },
    _clearFlag: () => { state.migratedOrig = null; },
    _reseedDays: () => { // reconstruye el escenario histórico 10b: el plan aún llevaba la propuesta (huecos seed)
      const fresh = buildSeedState();
      state.days.forEach((d, i) => { const f = fresh.days[i]; d.stops = f.stops; d.trans = f.trans; d.pre = f.pre; d.post = f.post; });
      state.seedRetired = null; } };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dayByDate = date => api.state.days.find(d => d.date === date);

(async () => {
  // ---- 0) canonical model shape after boot ----
  check('model: state has NO transfers mirror (single model)', !('transfers' in api.state));
  check('model: airport dayId seeds are NOT a migration signal (flag unset)', !api.state.migratedOrig);

  // ---- 1) pure converters (original text fields -> v2 numbers) ----
  check('parse: "~55 min" -> 55', api.parseLegacyMinutes('~55 min') === 55);
  check('parse: "~50-70 min" -> 50', api.parseLegacyMinutes('~50-70 min') === 50);
  check('parse: "~1 h 20" -> 80', api.parseLegacyMinutes('~1 h 20') === 80);
  check('parse: empty -> null', api.parseLegacyMinutes('') === null);
  check('parse: "¥3.070 aprox." -> 3070', api.parseLegacyYen('¥3.070 aprox.') === 3070);
  check('parse: "¥25.000-35.000+" -> 25000', api.parseLegacyYen('¥25.000-35.000+') === 25000);
  check('parse: "Gratis" -> 0', api.parseLegacyYen('Gratis') === 0);
  check('parse: "depende" -> null', api.parseLegacyYen('depende') === null);
  check('mode: car -> taxi, metro -> metro, plane -> walk fallback',
    api.legacyMode('car') === 'taxi' && api.legacyMode('metro') === 'metro' && api.legacyMode('plane') === 'walk');
  const conv = api.legacyOptionToV2({ mode: 'train', title: 'Tren X', duration: '~15 min', price: 'depende', notes: 'nota', url: 'https://ejemplo.jp' });
  check('convert: unparseable price preserved in the note', conv.y === null && conv.n.includes('Precio: depende') && conv.n.includes('https://ejemplo.jp'));

  // ---- 2) one-time migration: transfers -> gaps, dayId -> stops ----
  // Escenario histórico: cuando la 10b corrió en producción, el plan aún
  // llevaba la propuesta dentro (los huecos seed existían). Se reconstruye.
  api._reseedDays();
  api.state.places.push({ id: 'id_test1', name: 'Sitio prueba', lat: 35.0, lng: 135.0, category: 'otro', dayId: 'd_2027-04-20', time: '12:30' });
  api.state.places.push({ id: 'id_test2', name: 'Sitio B', lat: 35.01, lng: 135.01, category: 'otro', dayId: 'd_2027-04-20', order: 1 });
  api.state.places.push({ id: 'id_flightday', name: 'En día de vuelo', lat: 35, lng: 135, category: 'otro', dayId: 'd_2027-04-08' });
  const legacy = [
    { fromPlaceId: 'sensoji', toPlaceId: 'kagetsudo', options: [
      { mode: 'train', title: 'Tren X', duration: '~15 min', price: '¥200 aprox.', notes: 'nota original', url: 'https://ejemplo.jp', lineName: 'JR Yamanote' },
      { mode: 'car', title: 'Coche', duration: '~1 h 10', price: 'depende' },
    ]},
    { fromPlaceId: 'no_existe', toPlaceId: 'tampoco', options: [{ mode: 'walk', title: 'Perdido' }] },
  ];
  const d10 = dayByDate('2027-04-10');
  const gap = d10.trans[0];
  const optsBefore = gap.opts.length;
  const selBefore = gap.sel;
  const d20 = dayByDate('2027-04-20');
  const stopsBefore = d20.stops.length;

  const ran = api.maybeMigrateOriginal(legacy);
  check('migrate: runs once and reports true', ran === true && !!api.state.migratedOrig);
  check('migrate: legacy pair (sensoji->kagetsudo) canonicalized and matched to the v2 gap',
    gap.opts.length === optsBefore + 2);
  const train = gap.opts.find(o => o.t === 'Tren X');
  check('migrate: option converted (train, 15 min, ¥200, línea, nota+url)',
    !!train && train.m === 'train' && train.d === 15 && train.y === 200 &&
    train.l === 'JR Yamanote' && train.n.includes('nota original') && train.n.includes('https://ejemplo.jp'));
  const coche = gap.opts.find(o => o.t === 'Coche');
  check('migrate: car -> taxi with 70 min and price kept in note',
    !!coche && coche.m === 'taxi' && coche.d === 70 && coche.y === null && coche.n.includes('Precio: depende'));
  check('migrate: current selection untouched (v2 plan wins)', gap.sel === selBefore);
  check('migrate: unmatched pair adds nothing anywhere',
    !api.state.days.some(d => d.trans.some(t => t.opts.some(o => o.t === 'Perdido'))));
  check('migrate: dayId places appended to the v2 day (2)', d20.stops.length === stopsBefore + 2);
  const s1 = d20.stops.find(s => s.pid === 'id_test1');
  const s2 = d20.stops.find(s => s.pid === 'id_test2');
  check('migrate: original time kept, missing time inferred',
    !!s1 && s1.time === '12:30' && !!s2 && /^\d{2}:\d{2}$/.test(s2.time));
  check('migrate: order field respected (id_test2 before id_test1)',
    d20.stops.indexOf(s2) < d20.stops.indexOf(s1));
  check('migrate: transfers repaired to stops-1', d20.trans.length === d20.stops.length - 1);
  check('migrate: flight-day assignment skipped',
    !dayByDate('2027-04-08').stops.length);

  // ---- 3) migración única + idempotent content guards ----
  check('once: second call is a no-op', api.maybeMigrateOriginal(legacy) === false);
  api._clearFlag();
  const optsNow = gap.opts.length, stopsNow = d20.stops.length;
  api.maybeMigrateOriginal(legacy);
  check('dedup: re-running never duplicates options or stops',
    gap.opts.length === optsNow && d20.stops.length === stopsNow);

  // ---- 4) flag is monotonic across devices (travels inside v2) ----
  api._clearFlag();
  api.adoptRemote({ state: { places: [], v2: { days: [], updatedAt: 0, migratedOrig: '2026-07-07' } } });
  check('flag: adopted from remote v2 (monotonic)', api.state.migratedOrig === '2026-07-07');

  // ---- 5) offline/local edits newer than cloud -> re-upload signal ----
  api.state.updatedAt = 999;
  const res = api.adoptRemote({ state: { places: [], v2: { days: [{}], updatedAt: 5 } } });
  check('sync: localNewer flagged when local plan is fresher than cloud v2', res.localNewer === true);

  // ---- 6) v2 write payload carries the consolidation flag ----
  const writes = [];
  api._setFb({ set: (node, payload) => { writes.push({ node, payload }); return Promise.resolve(); },
    v2Node: 'NODE:state/v2', titleNode: 'NODE:tripTitle', placesNode: 'NODE:state/places', rootNode: 'NODE:root' }, true);
  api.pushRemote();
  const keys = Object.keys(writes[0].payload).sort();
  check('policy: v2 payload = {check,days,migratedOrig,rate,seedRetired,updatedAt,v} exactly',
    JSON.stringify(keys) === JSON.stringify(['check', 'days', 'migratedOrig', 'rate', 'seedRetired', 'updatedAt', 'v']));
  check('policy: still no places/transfers/tripTitle in the v2 payload',
    !('places' in writes[0].payload) && !('transfers' in writes[0].payload) && !('tripTitle' in writes[0].payload));

  console.log(fail ? '\n' + fail + ' FAILURES' : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
