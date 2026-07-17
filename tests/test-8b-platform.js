// Phase 8b verification: boots the ENTIRE real app.js under Node with stubs.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

// ---------- DOM stubs (with attribute support for <meta theme-color>) ----------
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
const windowStub = { scrollTo(){} };
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
const fetchedUrls = [];
const fetchStub = url => { fetchedUrls.push(String(url)); return Promise.resolve({ ok: true, json: async () => [] }); };

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return { setTheme, nominatimSearch, parseTimeToMinutes, formatMinutes, inferTimeForInsert,
    reorderStop, moveStop, moveStopToDay, addPlaceToDay, setItinMode, renderItinerary, state,
    _reseedDays: () => { // fixture: días con las paradas de la propuesta (el plan real nace vacío, 12.49)
      const fresh = buildSeedState();
      state.days.forEach((d, i) => { const f = fresh.days[i]; d.stops = f.stops; d.trans = f.trans; d.pre = f.pre; d.post = f.post; }); } };`);
const api = boot(documentStub, windowStub, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

(async () => {
  // ---- M12: theme-color meta follows setTheme ----
  const meta = documentStub.querySelector('meta[name="theme-color"]');
  api.setTheme('dark');
  check('M12: theme-color dark = #131217 (fondo sumi, fase 9)', meta._attrs.content === '#131217');
  api.setTheme('light');
  check('M12: theme-color light = #f6f4ee', meta._attrs.content === '#f6f4ee');

  // ---- R3: Japan viewbox in nominatimSearch, retry present in source ----
  await api.nominatimSearch('cafe con vistas');
  const u = fetchedUrls.find(x => x.includes('nominatim'));
  check('R3: viewbox=122,46,146,20&bounded=0 in URL', !!u && u.includes('viewbox=122,46,146,20') && u.includes('bounded=0'));
  check('R3: keeps jsonv2 + accept-language=es', u.includes('format=jsonv2') && u.includes('accept-language=es'));
  check('R3: ", Japan" retry logic present', /nominatimSearch\(q \+ ', Japan'\)/.test(appJs));

  // ---- M11: pure function unit cases (original semantics) ----
  const T = api.inferTimeForInsert;
  check('M11: midpoint between 10:00 and 12:00 -> 11:00', T([{time:'10:00'},{time:'12:00'}], 1, null) === '11:00');
  check('M11: tight gap 10:00/10:05 -> prev+5', T([{time:'10:00'},{time:'10:05'}], 1, null) === '10:05');
  check('M11: after last 10:00 -> 11:00', T([{time:'10:00'}], 1, null) === '11:00');
  check('M11: before first 09:00 -> 08:00', T([{time:'09:00'}], 0, null) === '08:00');
  check('M11: empty day, keeps own time', T([], 0, {time:'14:20'}) === '14:20');
  check('M11: empty day, no time -> 10:00', T([], 0, null) === '10:00');
  check('M11: parse guards', api.parseTimeToMinutes('25:00') === null && api.parseTimeToMinutes('9:30') === 570);

  // ---- M11: integration with the seed-proposal fixture (day 1: 13:05, 16:15, 17:30, 19:30) ----
  api._reseedDays();
  const d1 = api.state.days[1];
  const movedId = d1.stops[0].id;
  api.reorderStop(1, 0, 3); // insert first stop between 17:30 and 19:30
  check('M11: reorder infers midpoint 18:30', d1.stops[2].id === movedId && d1.stops[2].time === '18:30');
  const d2 = api.state.days[2];
  const lastTime = d2.stops[d2.stops.length - 1].time; // 16:45
  const beforeLen = d2.stops.length;
  api.moveStopToDay(1, 2, 2); // move the moved stop to day 2 (appends)
  check('M11: cross-day move appends with last+60', d2.stops.length === beforeLen + 1 &&
    d2.stops[d2.stops.length - 1].time === api.formatMinutes(api.parseTimeToMinutes(lastTime) + 60));
  documentStub.querySelector('#addToDay').value = '3';
  const d3 = api.state.days[3];
  const d3last = api.parseTimeToMinutes(d3.stops[d3.stops.length - 1].time);
  api.addPlaceToDay('catalog_sensoji');
  check('M11: add-to-day infers last+60', d3.stops[d3.stops.length - 1].time === api.formatMinutes(d3last + 60));

  // ---- 12.52: la vista "Original" se retiró; el DATO origDays sobrevive ----
  // Se retiró la vista, no el linaje: origDays sigue siendo el espejo que
  // adoptRemote rellena desde la app original y que viaja en las copias.
  api.state.origDays = [
    {id: 'd_2027-04-10', label: 'Día 10', date: '2027-04-10', isFlightDay: false},
    {id: 'd_2027-04-09', label: 'Día 9', date: '2027-04-09', isFlightDay: false},
  ];
  api.setItinMode('ours');
  check('12.52: el espejo origDays se conserva intacto (dato, no vista)',
    api.state.origDays.length === 2 && api.state.origDays[0].label === 'Día 10');
  check('12.52: REALIDAD no pinta el archivo original',
    !els['#dayPanel'].innerHTML.includes('Día 10') && !els['#dayPanel'].innerHTML.includes('Todavía no ha llegado'));
  check('12.52: REALIDAD sigue siendo la línea editable', els['#dayPanel'].innerHTML.includes('add-stop'));

  console.log(fail ? '\n' + fail + ' FAILURES' : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
