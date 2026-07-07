// Phase 7c verification: runs the REAL code extracted from index.html.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

function sliceBetween(startMarker, endMarker, endOffset) {
  const s = appJs.indexOf(startMarker);
  if (s < 0) throw new Error('start not found: ' + startMarker);
  const e = appJs.indexOf(endMarker, s);
  if (e < 0) throw new Error('end not found: ' + endMarker);
  return appJs.slice(s, e + (endOffset || 0));
}
function extractFn(name) {
  const start = appJs.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  const end = appJs.indexOf('\n}', start);
  return appJs.slice(start, end + 2);
}

// Real code slices
const catsBlock = sliceBetween('const CATS = {', '\nconst catOf =', 0) + "\nconst catOf = p => CATS[p.cat] || CATS.otro;\n";
const placesStart = appJs.indexOf('function P(name');
const placesObjStart = appJs.indexOf('const PLACES = {');
const placesEnd = appJs.indexOf('\n};', placesObjStart) + 3;
const placesBlock = appJs.slice(placesStart, placesEnd);
const catalogStart = appJs.indexOf('const TRIP_START =');
const seedFnStart = appJs.indexOf('function buildSeedPlaces(){');
const seedFnEnd = appJs.indexOf('\n}', seedFnStart) + 2;
const catalogBlock = appJs.slice(catalogStart, seedFnEnd);
const aliasBlock = sliceBetween('const CATALOG_ALIAS = {', '\n};', 3);
const helpers = [
  extractFn('sourceValueForPlace'), extractFn('sourceMatchesFilter'), extractFn('sharedListables'),
  sliceBetween("const SRC_FILTER_OPTS =", '\n}', 2), // includes srcChipsHTML
  extractFn('userPlaceView'), extractFn('daysBetween'), extractFn('userHotels'),
  extractFn('hotelBasePlaceholders'), extractFn('hotelCardHTML'),
].join('\n');
const sitiosBlock = sliceBetween("let placeQ = '', placeRegion = ''", '\n}', 2); // renderSitios
const hotelesBlock = sliceBetween("let hotelSrc = 'ours';", '\n}', 2); // renderHoteles

// DOM stub
const els = {};
const $ = sel => (els[sel] = els[sel] || { innerHTML: '', textContent: '', addEventListener(){}, classList: { toggle(){} } });
const $$ = () => [];
const esc = s => String(s == null ? '' : s);

const src = [catsBlock, placesBlock, catalogBlock, aliasBlock, helpers,
  'let state = {places: buildSeedPlaces(), days: []};',
  sitiosBlock, hotelesBlock,
  `return {PLACES, CATS, CATALOG_ALIAS, state,
    renderSitios, renderHoteles,
    setSrc: v => { placeSrc = v; }, setHotelSrc: v => { hotelSrc = v; }};`
].join('\n');

const api = new Function('$', '$$', 'esc', src)($, $$, esc);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// 1) Alias integrity: every key is a seeded shared id, every value a curated PLACES key
const seedIds = new Set(api.state.places.map(p => p.id));
const badKeys = Object.keys(api.CATALOG_ALIAS).filter(k => !seedIds.has(k));
const badVals = Object.values(api.CATALOG_ALIAS).filter(v => !api.PLACES[v]);
check('alias keys all exist in seed (' + Object.keys(api.CATALOG_ALIAS).length + ')', badKeys.length === 0);
check('alias values all exist in PLACES', badVals.length === 0);
if (badKeys.length) console.log('  bad keys:', badKeys.join(','));
if (badVals.length) console.log('  bad values:', badVals.join(','));

// 2) Sitios: per-filter render, no duplicate ids, aliased ids never listed
const gridIds = () => {
  const ids = [];
  const re = /openPlace\('([^']+)'\)/g;
  let m; while ((m = re.exec(els['#placesGrid'].innerHTML))) ids.push(m[1]);
  return ids;
};
const nameOf = pid => (api.PLACES[pid] ? api.PLACES[pid].name : (api.state.places.find(p => p.id === pid) || {}).name);
for (const f of ['ours', 'dani', 'insta', 'all']) {
  api.setSrc(f); api.renderSitios();
  const ids = gridIds();
  const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
  const aliased = ids.filter(id => api.CATALOG_ALIAS[id]);
  const names = ids.map(nameOf).map(n => String(n).toLowerCase());
  check(`sitios[${f}]: ${ids.length} items, no dup ids`, ids.length > 0 === (f !== 'insta') && dupIds.length === 0);
  check(`sitios[${f}]: no aliased ids listed`, aliased.length === 0);
  if (f === 'ours') {
    // Dentro de "Nuestros" un nombre no puede salir dos veces (D1 lo garantiza)
    const dupNames = [...new Set(names.filter((x, i) => names.indexOf(x) !== i))];
    check('sitios[ours]: no duplicate names', dupNames.length === 0);
    if (dupNames.length) console.log('  dup names:', dupNames.join(' | '));
  }
  if (f === 'all') {
    // En "Todos" solo se admite el par intencional curado/catálogo ↔ dani_*
    // (fuentes paralelas por diseño hasta la consolidación de Fase 10)
    const byName = {};
    ids.forEach(id => { const n = String(nameOf(id)).toLowerCase(); (byName[n] = byName[n] || []).push(id); });
    const badGroups = Object.entries(byName).filter(([, g]) =>
      g.length > 1 && g.filter(id => !id.startsWith('dani_')).length > 1);
    check('sitios[all]: every duplicate name is a curated↔dani pair', badGroups.length === 0);
    if (badGroups.length) console.log('  non-dani dup groups:', badGroups.map(([n, g]) => n + '(' + g.join(',') + ')').join(' | '));
  }
}
api.setSrc('ours'); api.renderSitios();
let ids = gridIds();
check('sitios[ours]: unaliased catalog zone listed (catalog_harajuku)', ids.includes('catalog_harajuku'));
check('sitios[ours]: curated twin listed once (sensoji), catalog_sensoji hidden', ids.includes('sensoji') && !ids.includes('catalog_sensoji'));
check('sitios[ours]: no dani places', !ids.some(i => i.startsWith('dani_')));
check('sitios[ours]: no base city zones / airports / hotels', !ids.includes('catalog_tokio') && !ids.includes('airport_narita_llegada'));
api.setSrc('dani'); api.renderSitios();
ids = gridIds();
check('sitios[dani]: dani places listed, hotels excluded', ids.includes('dani_fushimi_inari') && !ids.includes('dani_rise_osaka'));
check('D7: excursion category maps to Excursiones (not otro)',
  !!api.CATS.excursion && api.CATS.excursion.label === 'Excursiones' && api.CATS.excursion.emoji === '🗾');
check('D7: dani excursion place renders 🗾 (shirakawago in grid)',
  els['#placesGrid'].innerHTML.includes('🗾') && gridIds().includes('dani_shirakawago'));
check('sitios[dani]: cat chips include Excursiones', els['#catChips'].innerHTML.includes('Excursiones'));

// 3) Adoption flow: dani place adopted -> moves from dani to ours
const dp = api.state.places.find(p => p.id === 'dani_kagetsudo');
dp.source = 'user'; dp.dani = false; dp.daniAdopted = true; dp.catalogItem = false;
api.setSrc('dani'); api.renderSitios();
check('adopt: gone from dani filter', !gridIds().includes('dani_kagetsudo'));
api.setSrc('ours'); api.renderSitios();
check('adopt: appears under ours', gridIds().includes('dani_kagetsudo'));

// 4) Hoteles: dani hotels visible under dani/all, ours empty with pure seed
api.setHotelSrc('dani'); api.renderHoteles();
const daniHotels = (els['#hotelsList'].innerHTML.match(/🏨/g) || []).length;
check('hoteles[dani]: 6 Dani lodgings with D pill', daniHotels >= 6 && els['#hotelsList'].innerHTML.includes('D Dani'));
api.setHotelSrc('ours'); api.renderHoteles();
check('hoteles[ours]: seed has none, empty message', els['#hotelsList'].innerHTML.includes('Todavía no hay hoteles'));
api.setHotelSrc('all'); api.renderHoteles();
check('hoteles[all]: count label "en total"', els['#hotelCount'].textContent.includes('en total'));

console.log(fail ? ('\n' + fail + ' FAILURES') : '\nALL PASS');
process.exit(fail ? 1 : 0);
