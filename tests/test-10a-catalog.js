// Phase 10a verification: REAL catalog fusion. Boots the ENTIRE app.js under
// Node with DOM/Leaflet stubs and checks the single merged catalog:
// fold correctness, user-edit protection, canonical pids, list surfaces.
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
  ;return { state, PLACES, LEGACY_PID_MAP, CATALOG_VERSION,
    placeById, placeView, listablePlaces, canonicalizeDayPids, applyCatalogUpdate,
    renderSitios, renderHoteles, dayCosts, openAddStop, hotelBasePlaceholders,
    setSrc: v => { placeSrc = v; }, setHotelSrc: v => { hotelSrc = v; },
    setRegion: v => { placeRegion = v; } };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);

// ---- 1) merged seed: single catalog, no dups, no alias ids ----
const ids = api.state.places.map(p => p.id);
const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
// María es aditiva (Exploración, provenance 'maria'): se excluye del recuento
// del catálogo fusionado para que re-importar sus listas no rompa el test.
const nonMaria = api.state.places.filter(p => p.provenance !== 'maria');
check('seed: 283 merged places excl. María (190 shared + 92 curated + Louis House booking)', nonMaria.length === 283);
check('seed: María curation seeded as Exploración (provenance maria)', api.state.places.some(p => p.provenance === 'maria'));
check('seed: no duplicate ids', dupIds.length === 0);
const aliasKeys = Object.keys(api.LEGACY_PID_MAP);
check('seed: no curated alias key survives as id (24 folded)',
  aliasKeys.length === 24 && aliasKeys.every(k => !ids.includes(k)));
check('seed: curated-only entries exist as ids (nakamise, kagetsudo, hotel_tokyo, nrt)',
  ['nakamise', 'kagetsudo', 'hotel_tokyo', 'nrt'].every(k => ids.includes(k)));

// ---- 2) fold correctness on an alias pair ----
const sensoji = byId('catalog_sensoji');
check('fold: curated display fields win over unedited seed (name)', sensoji.name === 'Templo Sensō-ji');
check('fold: rich fields folded in (price/hours/web/dur/yen)',
  sensoji.price === 'Gratis' && !!sensoji.hours && !!sensoji.web && sensoji.dur === 75 && sensoji.yen === 0);
const shibuya = byId('catalog_shibuya');
check('fold: shared geometry preserved (catalog_shibuya keeps polygon/boundary)',
  Array.isArray(shibuya.polygon) && !!shibuya.boundaryQuery);
check('fold: yen 0 (gratis) survives the view', api.placeById('catalog_sensoji').yen === 0);

// ---- 3) user-edit protection (the PARITY risk-1 closure) ----
(function(){
  const akiba = byId('catalog_akihabara');
  akiba.category = 'compras';           // simulate the real production edit
  akiba.notes = 'nota editada por uno de los tres';
  delete akiba.price; delete akiba.dur; // pretend rich fields never folded
  api.state.catalogVersion = 'vieja';
  const changed = api.applyCatalogUpdate();
  const after = byId('catalog_akihabara');
  check('edits: applyCatalogUpdate reports change on version bump', changed === true);
  check('edits: user category survives re-fusion (compras, not zona)', after.category === 'compras');
  check('edits: user notes survive re-fusion', after.notes === 'nota editada por uno de los tres');
  check('edits: rich fields re-folded anyway', !!after.price || after.dur > 0);
  check('edits: version stamped current', api.state.catalogVersion === api.CATALOG_VERSION);
})();

// ---- 4) idempotency / determinism ----
(function(){
  const snap = JSON.stringify(api.state.places);
  api.state.catalogVersion = 'vieja-2';
  api.applyCatalogUpdate();
  check('idempotent: second fusion leaves the array byte-identical', JSON.stringify(api.state.places) === snap);
})();

// ---- 5) canonical pids ----
check('pids: seed itinerary uses canonical ids (catalog_sensoji on day 2)',
  api.state.days[2].stops.some(s => s.pid === 'catalog_sensoji') &&
  !api.state.days.some(d => d.stops.some(s => s.pid === 'sensoji')));
check('pids: curated-only pids kept as-is (nrt, hotel_tokyo on day 1)',
  api.state.days[1].stops.some(s => s.pid === 'nrt') && api.state.days[1].stops.some(s => s.pid === 'hotel_tokyo'));
(function(){
  const days = [{ stops: [{ pid: 'sensoji' }, { pid: 'nrt' }, { pid: 'dani_gion' }] }];
  const changed = api.canonicalizeDayPids(days);
  check('pids: canonicalizeDayPids maps legacy slugs and only those',
    changed && days[0].stops[0].pid === 'catalog_sensoji' && days[0].stops[1].pid === 'nrt' && days[0].stops[2].pid === 'dani_gion');
})();
check('pids: placeById resolves canonical id with rich view', api.placeById('catalog_kinkakuji').price === '¥500');
check('pids: placeById does NOT resolve legacy slugs (single store, no dual layer)', api.placeById('sensoji') === null);

// ---- 6) budget still counts entradas through the merged catalog ----
const c = api.dayCosts(api.state.days[2]);
check('budget: day-2 entradas > 0 via merged yen fields', c.entr > 0);

// ---- 7) Sitios list: one source, no dups, right exclusions ----
const gridIds = () => {
  const out = [];
  const re = /class="card place-card" data-pid="([^"]+)"/g;
  let m; while ((m = re.exec(els['#placesGrid'].innerHTML))) out.push(m[1]);
  return out;
};
// La vista Ideas agrupa por región y limita cada grupo (divulgación progresiva);
// para comprobar la presencia de un lugar concreto se fuerza el modo plano
// fijando su región (con región elegida se listan todos los de esa región).
const idsFor = (src, region) => { api.setSrc(src); api.setRegion(region || ''); api.renderSitios(); return gridIds(); };
// Los filtros de Ideas son por PROCEDENCIA (curador), cubos exclusivos.
for (const f of ['all', 'ours', 'dani', 'maria', 'instagram', 'ai']) {
  api.setSrc(f); api.setRegion(''); api.renderSitios();
  const g = gridIds();
  const dups = g.filter((x, i) => g.indexOf(x) !== i);
  check(`sitios[${f}]: no dup ids`, dups.length === 0);
}
// El catálogo semilla es procedencia 'ai' (andamiaje de exploración), NO "Nuestros".
let g = idsFor('ai', byId('catalog_sensoji').region);
check('sitios[ai]: merged twin listed once (catalog_sensoji), legacy slug gone',
  g.includes('catalog_sensoji') && !g.includes('sensoji'));
check('sitios[ai]: unaliased catalog zone listed (catalog_harajuku)',
  idsFor('ai', byId('catalog_harajuku').region).includes('catalog_harajuku'));
check('sitios[ai]: curated-only entry listed (nakamise)',
  idsFor('ai', byId('nakamise').region).includes('nakamise'));
check('sitios[ai]: no city bases, airports, hotels, transporte',
  !g.some(i => i.startsWith('dani_')) && !g.includes('catalog_tokio') &&
  !g.includes('airport_narita_llegada') && !g.includes('nrt') && !g.includes('hotel_tokyo'));
// "Nuestros" ya NO contiene el catálogo 'ai': AI y Ours quedan separados.
check('sitios[ours]: seed catalog separated out (catalog_sensoji NOT here)',
  !idsFor('ours', byId('catalog_sensoji').region).includes('catalog_sensoji'));
g = idsFor('dani', byId('dani_fushimi_inari').region);
check('sitios[dani]: dani places listed, hotels excluded', g.includes('dani_fushimi_inari') && !g.includes('dani_rise_osaka'));
(function(){ const m = api.state.places.find(p => /^maria_/.test(p.id));
  check('sitios[maria]: María curation listed under her bucket', !!(m && idsFor('maria', m.region).includes(m.id))); })();

// ---- 8) adoption: provenance is immutable (§12.13) ----
(function(){
  const dp = byId('dani_kagetsudo');
  const rgn = dp.region;
  dp.source = 'user'; dp.dani = false; dp.daniAdopted = true; dp.catalogItem = false;
  // Adoptar cambia el estado (pasa a plantable), NO la procedencia: sigue bajo "Dani".
  check('adopt: stays under dani (provenance immutable)', idsFor('dani', rgn).includes('dani_kagetsudo'));
  check('adopt: not relabeled into ours', !idsFor('ours', rgn).includes('dani_kagetsudo'));
})();

// ---- 9) Hoteles: APA now a real booked card; bases stay placeholders ----
api.setHotelSrc('ours'); api.renderHoteles();
check('hoteles[ours]: APA (curated, reservado) listed as real hotel',
  els['#hotelsList'].innerHTML.includes('APA Hotel Asakusabashi') && els['#hotelsList'].innerHTML.includes('✓ Reservado'));
check('hoteles[ours]: por-reservar bases NOT in the booked list',
  !els['#hotelsList'].innerHTML.includes('Alojamiento en Tokio') && !els['#hotelsList'].innerHTML.includes('Alojamiento en Kioto'));
check('hoteles: 3 bases por reservar as placeholders',
  api.hotelBasePlaceholders().length === 3 && els['#hotelPlaceholders'].innerHTML.includes('Por reservar'));
api.setHotelSrc('dani'); api.renderHoteles();
check('hoteles[dani]: 6 Dani lodgings with D pill',
  (els['#hotelsList'].innerHTML.match(/🏨/g) || []).length >= 6 && els['#hotelsList'].innerHTML.includes('D Dani'));

// ---- 10) Add-stop search: single catalog, right exclusions ----
api.openAddStop(2);
const addHtml = els['#addList'].innerHTML;
check('add-stop: merged catalog addable (catalog_harajuku, catalog_sensoji, kagetsudo adopted-dani ok)',
  addHtml.includes('data-pid="catalog_harajuku"') && addHtml.includes('data-pid="catalog_sensoji"') && addHtml.includes('data-pid="dani_kagetsudo"'));
check('add-stop: no airports, no city bases, no unadopted dani (first page)',
  !addHtml.includes('data-pid="airport_narita_llegada"') && !addHtml.includes('data-pid="catalog_tokio"') && !addHtml.includes('data-pid="dani_fushimi_inari"'));

console.log(fail ? ('\n' + fail + ' FAILURES') : '\nALL PASS');
process.exit(fail ? 1 : 0);
