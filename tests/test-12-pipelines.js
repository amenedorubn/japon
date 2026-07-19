// Phase 2 verification: ensureInstaPlaces()/ensureAiPlaces() close the
// import->bake->seed pipeline for INSTA_PLACES/AI_PLACES, mirroring
// ensureMariaPlaces(). Two tracks:
//  A) extracted-function sandbox (same technique as test-7b-dani.js): the
//     seeding logic in isolation, with fake baked arrays (empty-safe, adds
//     with correct id/provenance/fields, idempotent).
//  B) real boot (empty AI_PLACES/INSTA_PLACES, as actually committed): the
//     boot doesn't break, the exposed functions are no-ops on empty arrays,
//     and a place carrying 'ai'/'instagram' provenance (as ensureAiPlaces/
//     ensureInstaPlaces would produce) coexists correctly with Fase 1's
//     fallback and Fase 1.5's twin grouping.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// ================================================================
// Track A: extracted-function sandbox with fake baked data
// ================================================================
function extractFn(name) {
  const start = appJs.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  const end = appJs.indexOf('\n}', start);
  return appJs.slice(start, end + 2);
}
const CATS = { museo: {}, comida: {}, templo: {}, otro: {} };

function runSandbox(AI_PLACES, INSTA_PLACES){
  const src = [extractFn('aiSlug'), extractFn('ensureAiPlaces'),
    extractFn('instaSlug'), extractFn('ensureInstaPlaces')].join('\n');
  const state = { places: [] };
  const fn = new Function('AI_PLACES', 'INSTA_PLACES', 'state', 'CATS', src + `
    return { ensureAiPlaces, ensureInstaPlaces, aiSlug, instaSlug };
  `);
  const api = fn(AI_PLACES, INSTA_PLACES, state, CATS);
  return { api, state };
}

// ---- 1) empty arrays: no-op, never breaks ----
(function(){
  const { api, state } = runSandbox([], []);
  check('empty AI_PLACES: ensureAiPlaces() returns false, no throw', api.ensureAiPlaces() === false);
  check('empty INSTA_PLACES: ensureInstaPlaces() returns false, no throw', api.ensureInstaPlaces() === false);
  check('empty arrays: state.places untouched', state.places.length === 0);
})();

// ---- 2) sample data: seeds with correct id/provenance/fields ----
(function(){
  const AI_PLACES = [{ name: 'teamLab Planets Tokyo', city: 'Tokio', lat: 35.6469, lng: 139.7934, cat: 'museo', notes: 'Museo inmersivo.' }];
  const INSTA_PLACES = [{ name: 'Cafe Kissa', city: 'Kioto', lat: 34.9999, lng: 135.75, cat: 'comida', notes: 'Reel guardado.' }];
  const { api, state } = runSandbox(AI_PLACES, INSTA_PLACES);
  const changedAi = api.ensureAiPlaces();
  const changedInsta = api.ensureInstaPlaces();
  check('sample: ensureAiPlaces() reports a change', changedAi === true);
  check('sample: ensureInstaPlaces() reports a change', changedInsta === true);
  const ai = state.places.find(p => p.name === 'teamLab Planets Tokyo');
  const insta = state.places.find(p => p.name === 'Cafe Kissa');
  check('sample: ai place has id prefix ai_', !!ai && /^ai_/.test(ai.id));
  check('sample: ai place has provenance ai', !!ai && ai.provenance === 'ai');
  check('sample: ai place keeps category/region/notes', !!ai && ai.category === 'museo' && ai.region === 'Tokio' && ai.notes === 'Museo inmersivo.');
  check('sample: insta place has id prefix insta_', !!insta && /^insta_/.test(insta.id));
  check('sample: insta place has provenance instagram, source insta', !!insta && insta.provenance === 'instagram' && insta.source === 'insta');
  check('sample: insta place keeps category/region/notes', !!insta && insta.category === 'comida' && insta.region === 'Kioto' && insta.notes === 'Reel guardado.');
  check('sample: no invented data (only the 2 seeded places)', state.places.length === 2);

  // idempotency: re-running never duplicates
  const n0 = state.places.length;
  check('idempotent: second ensureAiPlaces() run reports no change', api.ensureAiPlaces() === false);
  check('idempotent: second ensureInstaPlaces() run reports no change', api.ensureInstaPlaces() === false);
  check('idempotent: places count unchanged', state.places.length === n0);
})();

// ---- 3) entries without name/coords never invent data (defensive, mirrors maria) ----
(function(){
  const { api, state } = runSandbox([{ city: 'Tokio', lat: 1, lng: 2, cat: 'otro' }], [{ name: '' }]);
  check('ai entry without name: skipped, not seeded', api.ensureAiPlaces() === false && state.places.length === 0);
})();
(function(){
  const { api, state } = runSandbox([{ name: '' }], [{ city: 'Tokio', lat: 1, lng: 2, cat: 'otro' }]);
  check('insta entry without name: skipped, not seeded', api.ensureInstaPlaces() === false && state.places.length === 0);
})();

// ================================================================
// Track B: real boot (committed AI_PLACES/INSTA_PLACES, currently empty)
// ================================================================
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
  ;return { state, AI_PLACES, INSTA_PLACES, ensureAiPlaces, ensureInstaPlaces, provenanceOf,
    listablePlaces, sourceMatchesFilter, isTwinMember, placeProvenances, twinGroupOf };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

// ---- 4) real committed arrays are still empty; boot didn't break ----
check('real build: AI_PLACES is empty (no real data curated yet)', Array.isArray(api.AI_PLACES) && api.AI_PLACES.length === 0);
check('real build: INSTA_PLACES is empty (no real data curated yet)', Array.isArray(api.INSTA_PLACES) && api.INSTA_PLACES.length === 0);
check('real build: ensureAiPlaces() exposed and a no-op on empty', api.ensureAiPlaces() === false);
check('real build: ensureInstaPlaces() exposed and a no-op on empty', api.ensureInstaPlaces() === false);
check('real build: boot unaffected, seed still 436 places', api.state.places.filter(Boolean).length === 436);

// ---- 5) coexistence (Fase 1): a synthetic 'ai'-imported place and a
// synthetic unattributed ('ai' fallback) place both resolve to 'ai',
// on purpose, without collision ----
(function(){
  const imported = { id: 'ai_teamlab_planets_tokyo', name: 'teamLab Planets Tokyo', category: 'museo',
    region: 'Tokio', lat: 35.6469, lng: 139.7934, notes: 'Museo inmersivo.', source: 'user', provenance: 'ai',
    catalog: true, catalogItem: true, dayId: null, time: '' };
  const unattributed = { id: 'id_random_manual', name: 'Sitio suelto', category: 'otro', lat: 1, lng: 1 };
  check('coexist: ai-imported place resolves to ai (explicit)', api.provenanceOf(imported) === 'ai');
  check('coexist: unattributed place also resolves to ai (fallback)', api.provenanceOf(unattributed) === 'ai');
  check('coexist: both are ai on purpose, distinguishable only by id/fields, not by a different provenance value',
    api.provenanceOf(imported) === api.provenanceOf(unattributed));
})();

// ---- 6) an ai/instagram place NOT registered in TWIN_GROUPS behaves like
// any ordinary standalone place (Fase 1.5 untouched by Fase 2) ----
(function(){
  const n0 = api.state.places.length;
  api.state.places.push({ id: 'ai_teamlab_planets_tokyo', name: 'teamLab Planets Tokyo', category: 'museo',
    region: 'Tokio', lat: 35.6469, lng: 139.7934, notes: 'Museo inmersivo.', source: 'user', provenance: 'ai',
    catalog: true, catalogItem: true, dayId: null, time: '' });
  api.state.places.push({ id: 'insta_cafe_kissa', name: 'Cafe Kissa', category: 'comida',
    region: 'Kioto', lat: 34.9999, lng: 135.75, notes: 'Reel guardado.', source: 'insta', provenance: 'instagram',
    catalog: true, catalogItem: true, dayId: null, time: '' });
  check('new ai place: no twin group (not in the confirmed 60)', api.twinGroupOf('ai_teamlab_planets_tokyo') === null);
  check('new ai place: not folded away (isTwinMember false)', api.isTwinMember('ai_teamlab_planets_tokyo') === false);
  check('new ai place: listablePlaces includes it exactly once',
    api.listablePlaces().filter(p => p.id === 'ai_teamlab_planets_tokyo').length === 1);
  check('new ai place: single provenance (no union, standalone)',
    api.placeProvenances('ai_teamlab_planets_tokyo').length === 1 && api.placeProvenances('ai_teamlab_planets_tokyo')[0] === 'ai');
  check('new insta place: matches the instagram filter, not the ai filter',
    api.sourceMatchesFilter(api.state.places.find(p => p.id === 'insta_cafe_kissa'), 'instagram') &&
    !api.sourceMatchesFilter(api.state.places.find(p => p.id === 'insta_cafe_kissa'), 'ai'));
  check('sanity: visible identity count grew by exactly 2 (no folding, no loss)',
    api.state.places.length === n0 + 2 &&
    api.listablePlaces().filter(p => p.id === 'ai_teamlab_planets_tokyo' || p.id === 'insta_cafe_kissa').length === 2);
})();

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
