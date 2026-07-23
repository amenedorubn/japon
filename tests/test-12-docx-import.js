// Phase 3B verification: the NUESTRA/docx importer.
// A diferencia del resto de fuentes, NUESTRA no crea lugares: marca como
// 'ours' entradas que YA existen en el catálogo. Lo importado son ids, y el
// Set manual DOCX_OURS se retiró en favor de DOCX_OURS_IDS, horneado desde
// Itinerario.docx por tools/docx-import.js.
// Lo crítico: el Set generado debe ser EXACTAMENTE el de siempre (35 ids,
// congelados en tests/docx-ours-snapshot.json antes del refactor), comparado
// como CONJUNTO — el orden nunca importó, DOCX_OURS solo se usa con .has().
const fs = require('fs');
const path = require('path');
const appJs = fs.readFileSync(process.argv[2], 'utf8');
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(__dirname, 'docx-ours-snapshot.json'), 'utf8'));
const IMPORTED = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'import', 'ours-places.json'), 'utf8'));

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
  ;return { startApp, state, DOCX_OURS, DOCX_OURS_IDS, provenanceOf, ensureProvenance, placeView,
    TWIN_GROUPS, twinGroupOf, isTwinMember, isBookedHotel, isConfirmed, bookedHotels };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
api.startApp(); // Prioridad 4: arranque real gateado tras auth; los tests lo disparan a mano.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);

// ---- 1) El Set generado == el snapshot congelado, como CONJUNTO ----
const snapSet = new Set(SNAPSHOT);
const genIds = Array.from(api.DOCX_OURS);
check('snapshot: la referencia congelada trae 35 ids', SNAPSHOT.length === 35);
check('bake: DOCX_OURS_IDS horneado trae 35 ids', api.DOCX_OURS_IDS.length === 35);
check('DOCX_OURS es un Set construido desde DOCX_OURS_IDS', api.DOCX_OURS instanceof Set && api.DOCX_OURS.size === 35);
check('PARIDAD: el Set generado no pierde ningún id del snapshot',
  SNAPSHOT.every(id => api.DOCX_OURS.has(id)));
check('PARIDAD: el Set generado no añade ningún id que no estuviera',
  genIds.every(id => snapSet.has(id)));
const missing = SNAPSHOT.filter(id => !api.DOCX_OURS.has(id));
const extra = genIds.filter(id => !snapSet.has(id));
if (missing.length) console.log('  FALTAN:', missing.join(', '));
if (extra.length) console.log('  SOBRAN:', extra.join(', '));
check('bake: sin ids duplicados', new Set(api.DOCX_OURS_IDS).size === api.DOCX_OURS_IDS.length);

// ---- 2) NUESTRA no crea lugares: cada id debe existir ya en el catálogo ----
check('NUESTRA no inventa: los 35 ids existen en el catálogo', genIds.every(id => !!byId(id)));
const orphans = genIds.filter(id => !byId(id));
if (orphans.length) console.log('  ids huérfanos:', orphans.join(', '));
check('NUESTRA no crea lugares: todos son ids catalog_* preexistentes',
  genIds.every(id => /^catalog_/.test(id)));

// ---- 3) El import y el bloque horneado son la misma verdad, y es trazable ----
check('import/ours-places.json trae los 35 ids', IMPORTED.length === 35);
check('bake == import: mismos ids y mismo orden',
  JSON.stringify(IMPORTED.map(r => r.id)) === JSON.stringify(api.DOCX_OURS_IDS));
check('trazabilidad: cada id importado declara la línea del docx que lo justifica',
  IMPORTED.every(r => typeof r.docx === 'string' && r.docx.length > 0));
check('trazabilidad: la línea "Excursión a Nara e Inari" justifica 2 ids (decisión curada)',
  IMPORTED.filter(r => /Nara e Inari/.test(r.docx)).map(r => r.id).sort().join(',') ===
    'catalog_nara,catalog_nara_inari_excursion');
check('rótulos: las bases de ciudad NO entran en NUESTRA (son andamiaje ai)',
  !api.DOCX_OURS.has('catalog_tokio') && !api.DOCX_OURS.has('catalog_kioto') && !api.DOCX_OURS.has('catalog_osaka'));

// ---- 4) La procedencia 'ours' sigue intacta sobre los datos reales ----
check('provenance: los 35 del documento resuelven a ours',
  genIds.every(id => api.provenanceOf(byId(id)) === 'ours'));
check('provenance: y así están guardados en state.places',
  genIds.every(id => (byId(id).provenance || api.provenanceOf(byId(id))) === 'ours'));
check('provenance: placeView expone ours', api.placeView(byId('catalog_sensoji')).provenance === 'ours');
check('provenance: un lugar del catálogo FUERA del documento sigue siendo ai (cubos exclusivos)',
  api.provenanceOf(byId('nakamise')) === 'ai' && !api.DOCX_OURS.has('nakamise'));
// La reparación de ensureProvenance depende de DOCX_OURS: debe seguir viva.
(function(){
  const stale = { id: 'catalog_gion', source: 'user', provenance: 'ai', category: 'zona' };
  const did = api.ensureProvenance([stale]);
  check('ensureProvenance: sigue restaurando a ours un id del documento guardado como ai',
    did && stale.provenance === 'ours');
})();
check('ensureProvenance: idempotente sobre la semilla tras el refactor',
  api.ensureProvenance(api.state.places) === false);

// ---- 5) Nada de esto toca los gemelos (Fase 1.5) ----
check('gemelos: los 60 grupos siguen intactos', api.TWIN_GROUPS.length === 60);
check('gemelos: ningún id del documento es ancla ni miembro de un par (cero solape, como en la puerta)',
  genIds.every(id => api.twinGroupOf(id) === null));
check('gemelos: ningún id del documento se pliega', genIds.every(id => api.isTwinMember(id) === false));
check('gemelos: un par de ejemplo sigue funcionando (kiyomizu ancla, dani_kiyomizu miembro)',
  api.twinGroupOf('kiyomizu') !== null && api.isTwinMember('dani_kiyomizu') === true);

// ---- 6) Ni el eje confirmado (incluido el fix de dani_) ----
check('confirmado: bookedHotels() sigue siendo solo nuestras 2 reservas reales',
  api.bookedHotels().map(p => p.id).sort().join(',') === 'apa_asakusabashi,id_louis_otsuka_nishi');
check('confirmado: ningún id del documento cuenta como reserva',
  genIds.every(id => api.isBookedHotel(byId(id)) === false));
check('confirmado: los alojamientos de Dani siguen sin colarse (fix intacto)',
  api.state.places.filter(p => p && /^dani_/.test(p.id) && p.category === 'alojamiento')
    .every(p => api.isConfirmed(p) === false));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
