// Phase 12 verification: PROVENANCE model. Boots the real app.js under Node
// with DOM/Leaflet stubs and checks the stable, historical provenance axis
// (ours | dani | instagram | ai): seed backfill, id-based history, immutability
// under adoption (§12.13), idempotency, and placeView exposure.
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
  ;return { state, provenanceOf, ensureProvenance, placeView, provenanceLabel, provTag, DOCX_OURS, isBookedHotel };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);
const VALID = ['ours', 'dani', 'instagram', 'ai', 'maria'];

// ---- 1) Every seed place has a valid provenance ----
check('seed: every place has a provenance in {ours,dani,instagram,ai,maria}',
  api.state.places.length > 0 && api.state.places.every(p => VALID.indexOf(p.provenance) >= 0));
check('maria_* place → maria (Exploración curator, immutable)',
  api.state.places.some(p => /^maria_/.test(p.id) && p.provenance === 'maria'));
// Repair: a maria_* place persisted with a stale 'ai' provenance (a past bug
// left them invisible to the María filter/layer) is corrected back to 'maria'.
(function(){
  const corrupt = { id: 'maria_test_repair', source: 'user', provenance: 'ai', category: 'otro' };
  api.state.places.push(corrupt);
  const did = api.ensureProvenance(api.state.places);
  check('repair: maria_* stored as ai is restored to maria', did && corrupt.provenance === 'maria');
  api.state.places.splice(api.state.places.indexOf(corrupt), 1);
})();

// ---- 2) the source of truth for 'ours' is Itinerario.docx (12.48) ----
check('dani_* place → dani', byId('dani_fushimi_inari') && byId('dani_fushimi_inari').provenance === 'dani');
check('docx place (catalog_sensoji) → ours', byId('catalog_sensoji') && byId('catalog_sensoji').provenance === 'ours');
check('docx excursion (catalog_kanazawa) → ours', byId('catalog_kanazawa') && byId('catalog_kanazawa').provenance === 'ours');
check('non-docx curated entry (nakamise) → ai', byId('nakamise') && byId('nakamise').provenance === 'ai');
check('airport marker (nrt) → ai', byId('nrt') && byId('nrt').provenance === 'ai');
// Repair: docx places persisted as 'ai' by the old backfill are restored to
// 'ours'; an old-definition manual 'ours' (id_*, not booked) is recomputed.
(function(){
  const docxStale = { id: 'catalog_gion', source: 'user', provenance: 'ai', category: 'zona' };
  const manualStale = { id: 'id_manual_x', source: 'user', provenance: 'ours', category: 'otro' };
  const did = api.ensureProvenance([docxStale, manualStale]);
  check('repair: docx place stored as ai is restored to ours', did && docxStale.provenance === 'ours');
  check('repair: manual id_* stored as ours (old definition) becomes ai', manualStale.provenance === 'ai');
})();

// ---- 3) hotels: booked reservation vs "por reservar" placeholder ----
check('booked hotel (apa_asakusabashi) → ours', byId('apa_asakusabashi') && byId('apa_asakusabashi').provenance === 'ours');
check('hotel base placeholder (hotel_tokyo) → ai', byId('hotel_tokyo') && byId('hotel_tokyo').provenance === 'ai');

// ---- 4) provenanceOf classifies synthetic inputs correctly ----
check('provenanceOf: manual id_* (not docx, not booked) → ai',
  api.provenanceOf({ id: 'id_abc123', source: 'user', category: 'otro' }) === 'ai');
check('provenanceOf: booked hotel stays ours (PROJECT §9.4 rule kept)',
  api.provenanceOf({ id: 'id_h1', source: 'user', category: 'alojamiento', lat: 35.7, lng: 139.7, checkIn: '2027-04-09', checkOut: '2027-04-12' }) === 'ours');
check('provenanceOf: source insta → instagram',
  api.provenanceOf({ id: 'id_x', source: 'insta', category: 'otro' }) === 'instagram');
check('provenanceOf: plain catalog place → ai',
  api.provenanceOf({ id: 'catalog_x', category: 'templo' }) === 'ai');

// ---- 5) Immutability under adoption (§12.13): a Dani place adopted stays dani ----
const adoptedDani = { id: 'dani_fake', source: 'user', dani: false, daniAdopted: true, category: 'otro' };
check('adopted Dani place still classifies as dani (id + daniAdopted)',
  api.provenanceOf(adoptedDani) === 'dani');

// ---- 6) Backfill is idempotent and never overwrites an existing provenance ----
const kept = { id: 'catalog_keepme', category: 'templo', provenance: 'dani' }; // deliberately "wrong" but pre-set
api.ensureProvenance([kept]);
check('ensureProvenance never overwrites an existing provenance (history is immutable)', kept.provenance === 'dani');
const before = JSON.stringify(api.state.places.map(p => p.provenance));
api.ensureProvenance(api.state.places);
check('ensureProvenance is idempotent on the seed (no changes on 2nd run)',
  JSON.stringify(api.state.places.map(p => p.provenance)) === before);

// ---- 7) placeView exposes provenance to the UI ----
const pv = api.placeView(byId('dani_fushimi_inari'));
check('placeView exposes provenance', pv && pv.provenance === 'dani');

// ---- 8) provenance whisper labels (DIRECTION §6.11) ----
check('provenanceLabel: ours -> Nuestro', api.provenanceLabel('ours') === 'Nuestro');
check('provenanceLabel: dani -> De Dani', api.provenanceLabel('dani') === 'De Dani');
check('provenanceLabel: instagram -> De Instagram', api.provenanceLabel('instagram') === 'De Instagram');
check('provenanceLabel: ai -> IA', api.provenanceLabel('ai') === 'IA');
check('provenanceLabel: unknown -> empty (no whisper)', api.provenanceLabel(undefined) === '');

// ---- 9) provTag: unified, clearly-distinct provenance mark ----
check('provTag: dani mark carries label + class', api.provTag('dani').includes('Dani') && api.provTag('dani').includes('prov-dani'));
check('provTag: ai mark is labelled IA', api.provTag('ai').includes('IA') && api.provTag('ai').includes('prov-ai'));
check('provTag: all four provenances are visually distinct', new Set(['ours', 'dani', 'instagram', 'ai'].map(p => api.provTag(p))).size === 4);
check('provTag: unknown -> empty', api.provTag(undefined) === '');

// ---- 10) maria: a new immutable exploration provenance ----
check('provenanceOf: source maria -> maria', api.provenanceOf({ id: 'x', source: 'maria', category: 'otro' }) === 'maria');
check('provenanceOf: maria_ id prefix -> maria', api.provenanceOf({ id: 'maria_abc', category: 'templo' }) === 'maria');
check('ensureProvenance never overwrites an explicit maria', (() => { const p = { id: 'y', provenance: 'maria' }; api.ensureProvenance([p]); return p.provenance === 'maria'; })());
check('provenanceLabel: maria -> De María', api.provenanceLabel('maria') === 'De María');
check('provTag: maria labelled María with class', api.provTag('maria').includes('María') && api.provTag('maria').includes('prov-maria'));
check('provTag: five provenances now distinct', new Set(['ours', 'dani', 'instagram', 'maria', 'ai'].map(p => api.provTag(p))).size === 5);

// ---- 11) GUARDAS Fase 12.53: el fallback 'ai' nunca debe "robar" una
// procedencia explícita. Estas guardas fijan la precedencia de provenanceOf
// y verifican, sobre la semilla REAL completa, que ningún lugar con marca
// explícita (source dani/insta/maria, id dani_*/maria_*, DOCX_OURS, o reserva
// de hotel) cae en 'ai'. Solo lo verdaderamente sin atribuir debe caer ahí. ----

// 11a) Cada señal explícita, aislada, resuelve a su procedencia (no a 'ai')
check('guard: source dani -> dani (no ai)', api.provenanceOf({ id: 'z1', source: 'dani' }) === 'dani');
check('guard: dani flag -> dani (no ai)', api.provenanceOf({ id: 'z2', dani: true }) === 'dani');
check('guard: id dani_* sin más marca -> dani (no ai)', api.provenanceOf({ id: 'dani_z3' }) === 'dani');
check('guard: source insta -> instagram (no ai)', api.provenanceOf({ id: 'z4', source: 'insta' }) === 'instagram');
check('guard: source maria -> maria (no ai)', api.provenanceOf({ id: 'z5', source: 'maria' }) === 'maria');
check('guard: maria flag -> maria (no ai)', api.provenanceOf({ id: 'z6', maria: true }) === 'maria');
check('guard: id maria_* sin más marca -> maria (no ai)', api.provenanceOf({ id: 'maria_z7' }) === 'maria');
check('guard: id en DOCX_OURS -> ours (no ai)',
  api.DOCX_OURS.size > 0 && api.provenanceOf({ id: Array.from(api.DOCX_OURS)[0] }) === 'ours');
check('guard: reserva de hotel real -> ours (no ai)',
  api.provenanceOf({ id: 'z8', category: 'alojamiento', lat: 1, lng: 1, source: 'user',
    checkIn: '2027-04-01', checkOut: '2027-04-02' }) === 'ours');

// 11b) Precedencia documentada: el id canónico dani_* manda incluso si además
// trae source 'insta' o 'maria' (señal contradictoria/corrupta) — dani_* es
// la marca más fiable porque es inmutable (§12.13).
check('guard: id dani_* manda sobre source insta contradictorio',
  api.provenanceOf({ id: 'dani_z9', source: 'insta' }) === 'dani');
check('guard: id dani_* manda sobre source maria contradictorio',
  api.provenanceOf({ id: 'dani_z10', source: 'maria' }) === 'dani');

// 11c) Sin NINGUNA marca -> ai (el único caso legítimo de fallback)
check('guard: sin marca alguna -> ai', api.provenanceOf({ id: 'z11', category: 'otro' }) === 'ai');
check('guard: place vacío/null -> ai', api.provenanceOf(null) === 'ai' && api.provenanceOf({}) === 'ai');

// 11d) Sobre la semilla REAL completa: ningún lugar con marca explícita cae
// en 'ai' (el fallback nunca "roba" atribución a las otras 4 fuentes).
// Reconstruye la clasificación esperada con la MISMA regla de precedencia
// que provenanceOf documenta, y la compara contra p.provenance ya fijado.
function expectedProvenance(p){
  const id = String(p.id || '');
  if(/^dani_/.test(id) || p.dani || p.daniAdopted || p.source === 'dani') return 'dani';
  if(p.source === 'insta') return 'instagram';
  if(p.source === 'maria' || p.maria || /^maria_/.test(id)) return 'maria';
  if(api.DOCX_OURS.has(id) || api.isBookedHotel(p)) return 'ours';
  return 'ai';
}
const misattributed = api.state.places.filter(Boolean).filter(p => p.provenance !== expectedProvenance(p));
check('guard: ningún lugar de la semilla real tiene procedencia distinta de la esperada (0 discrepancias)',
  misattributed.length === 0);
if(misattributed.length){
  console.log('  Discrepancias:', misattributed.map(p => `${p.id} (stored=${p.provenance}, expected=${expectedProvenance(p)})`).join(', '));
}
// Guarda específica pedida: ningún lugar con marca explícita de dani/insta/
// maria/DOCX_OURS/hotel reservado quedó etiquetado como 'ai'.
const explicitlyMarked = api.state.places.filter(Boolean).filter(p => expectedProvenance(p) !== 'ai');
const stolenByAi = explicitlyMarked.filter(p => p.provenance === 'ai');
check('guard: el fallback ai no robó ninguna procedencia explícita (0 casos)', stolenByAi.length === 0);

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
