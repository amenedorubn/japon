// Phase 1.5 verification: TWIN GROUPS (gemelos Dani <-> IA fusionados en un
// solo pin/tarjeta con multi-procedencia). Boots the real app.js under Node
// with DOM/Leaflet stubs and checks: single appearance under 'all' and under
// each single-source filter, the union of provenance chips, the preserved
// Dani note in the fused detail, that non-twins are unaffected, and the
// count sanity (422 data entries, 60 folded duplicates).
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

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
  ;return { state, placeById, placeView, listablePlaces, sourceMatchesFilter, renderSitios, openPlace,
    TWIN_GROUPS, twinGroupOf, isTwinMember, twinGroupProvenances, placeProvenances, twinDaniNotes,
    provTag, provenanceLabel,
    setSrc: v => { placeSrc = v; }, setRegion: v => { placeRegion = v; } };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);

const gridIds = () => {
  const out = [];
  const re = /class="card place-card" data-pid="([^"]+)"/g;
  let m; while ((m = re.exec(els['#placesGrid'].innerHTML))) out.push(m[1]);
  return out;
};
const idsFor = (src, region) => { api.setSrc(src); api.setRegion(region || ''); api.renderSitios(); return gridIds(); };
const countOf = (list, id) => list.filter(x => x === id).length;

// ---- 1) registry sanity: 60 groups, each with exactly 1 dani member ----
check('registry: 60 twin groups', api.TWIN_GROUPS.length === 60);
check('registry: every group has exactly 1 member', api.TWIN_GROUPS.every(g => g.members.length === 1));
check('registry: every anchor resolves to a real place', api.TWIN_GROUPS.every(g => !!byId(g.anchor)));
check('registry: every member resolves to a real place', api.TWIN_GROUPS.every(g => !!byId(g.members[0])));
check('registry: Arashiyama special case present (anchor=kimono_forest)',
  api.TWIN_GROUPS.some(g => g.anchor === 'kimono_forest' && g.members.includes('dani_arashiyama_station')));

// ---- 2) provenanceOf() axis untouched (Fase 1 guard): each raw member keeps ITS OWN single provenance ----
check('axis intact: anchor kiyomizu keeps its own provenance ai', byId('kiyomizu').provenance === 'ai');
check('axis intact: member dani_kiyomizu keeps its own provenance dani', byId('dani_kiyomizu').provenance === 'dani');
check('axis intact: union lives only in twinGroupProvenances(), not on the raw place',
  api.twinGroupProvenances(api.twinGroupOf('kiyomizu')).length === 2 &&
  byId('kiyomizu').provenance === 'ai' && byId('dani_kiyomizu').provenance === 'dani');

// ---- 3) isTwinMember / listablePlaces: only the non-anchor folds away ----
check('isTwinMember: dani_kiyomizu is a member (folds)', api.isTwinMember('dani_kiyomizu') === true);
check('isTwinMember: kiyomizu the anchor does NOT fold', api.isTwinMember('kiyomizu') === false);
const listable = api.listablePlaces().map(p => p.id);
check('listablePlaces: anchor kiyomizu present', listable.includes('kiyomizu'));
check('listablePlaces: member dani_kiyomizu absent (folded into its anchor)', !listable.includes('dani_kiyomizu'));

// ---- 4) Sitios list: appears exactly once under 'all', with BOTH chips ----
(function(){
  const rgn = byId('kiyomizu').region;
  const all = idsFor('all', rgn);
  check('sitios[all]: kiyomizu (fused group) appears exactly once', countOf(all, 'kiyomizu') === 1);
  check('sitios[all]: the dani twin never appears on its own', !all.includes('dani_kiyomizu'));
  const html = els['#placesGrid'].innerHTML;
  const start = html.indexOf('data-pid="kiyomizu"');
  const next = html.indexOf('class="card place-card"', start + 1);
  const cardSlice = html.slice(start, next === -1 ? html.length : next);
  check('sitios[all]: fused card carries BOTH the Dani and IA chips',
    start >= 0 && /prov-dani/.test(cardSlice) && /prov-ai/.test(cardSlice));
})();

// ---- 5) appears under 'solo Dani' and under 'solo IA' ----
(function(){
  const rgn = byId('kiyomizu').region;
  check('sitios[dani]: fused group visible under the Dani-only filter', idsFor('dani', rgn).includes('kiyomizu'));
  check('sitios[ai]: fused group visible under the IA-only filter', idsFor('ai', rgn).includes('kiyomizu'));
  check('sitios[maria]: fused group NOT visible under an unrelated filter', !idsFor('maria', rgn).includes('kiyomizu'));
})();

// ---- 6) non-twins are unaffected (ordinary ai place, ordinary ours place) ----
(function(){
  check('sanity: toji has no twin group (test fixture check)', api.twinGroupOf('toji') === null);
  const rgnAi = byId('toji').region; // ai, standalone, no twin
  check('non-twin: toji (ai, no group) still listed once under ai', countOf(idsFor('ai', rgnAi), 'toji') === 1);
  check('non-twin: toji absent under dani (no group to union it in)', !idsFor('dani', rgnAi).includes('toji'));
  const rgnOurs = byId('catalog_sensoji').region;
  check('non-twin: catalog_sensoji (ours, no group) still listed once under ours', countOf(idsFor('ours', rgnOurs), 'catalog_sensoji') === 1);
})();

// ---- 7) Nota de Dani preserved in the fused detail (user's key adjustment) ----
(function(){
  const g = api.twinGroupOf('kiyomizu');
  const notes = api.twinDaniNotes(g);
  check('twinDaniNotes: dani_kiyomizu note is preserved verbatim', notes.length === 1 && notes[0] === byId('dani_kiyomizu').notes);
  api.openPlace('kiyomizu');
  const modalHtml = els['#modalBox'].innerHTML;
  check('detail: fused pin shows "Nota de Dani" with the preserved text',
    modalHtml.includes('Nota de Dani') && modalHtml.includes(esc(byId('dani_kiyomizu').notes)));
  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
})();

// ---- 8) Arashiyama special case: matiz "estación + bosque" kept on kimono_forest ----
(function(){
  const g = api.twinGroupOf('kimono_forest');
  check('arashiyama: group resolved, anchor=kimono_forest', !!g && g.anchor === 'kimono_forest');
  const notes = api.twinDaniNotes(g);
  check('arashiyama: dani_arashiyama_station note preserved (matiz estación+bosque)',
    notes.length === 1 && notes[0] === byId('dani_arashiyama_station').notes);
  api.openPlace('kimono_forest');
  check('arashiyama: detail shows the preserved Dani note', els['#modalBox'].innerHTML.includes('Nota de Dani'));
})();

// ---- 9) opening the dani twin member DIRECTLY (e.g. from Ruta Dani) is untouched ----
(function(){
  api.openPlace('dani_kiyomizu');
  const html = els['#modalBox'].innerHTML;
  check('direct-open member: shows its own single whisper (De Dani), not a union',
    html.includes(api.provenanceLabel('dani')) && !html.includes(api.provenanceLabel('ai')));
  check('direct-open member: no redundant "Nota de Dani" block (it IS the dani entry)',
    !html.includes('Nota de Dani'));
})();

// ---- 10) count sanity: 422 data entries unchanged; 60 members folded away ----
check('sanity: total data entries still 422 (nothing deleted)', api.state.places.filter(Boolean).length === 422);
const foldedCount = api.state.places.filter(p => p && api.isTwinMember(p.id)).length;
check('sanity: exactly 60 places fold away as non-anchor twins', foldedCount === 60);
check('sanity: visible identities with everything active = 422 - 60 = 362',
  api.state.places.filter(Boolean).length - foldedCount === 362);

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
