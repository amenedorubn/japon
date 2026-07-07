// Tests the REAL Phase 7b functions extracted from index.html's JS.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

function extractFn(name) {
  const start = appJs.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  const end = appJs.indexOf('\n}', start);
  return appJs.slice(start, end + 2);
}

const src = [extractFn('sourceValueForPlace'), extractFn('renderDaniItinerary'), extractFn('drawDaniRoutes')].join('\n');

// ---- stubs ----
const dom = { innerHTML: '' };
const layers = [];
const fakeLine = () => ({ bindTooltip(){ return this; }, addTo(){ layers.push('line'); return this; } });
const fakeMarker = () => ({ bindTooltip(){ return this; }, addTo(){ layers.push('badge'); return this; } });
const sandbox = {
  $: () => dom,
  esc: s => String(s == null ? '' : s),
  CATS: { templo: { emoji: '⛩️', color: '#123' }, otro: { emoji: '📍', color: '#456' } },
  catOfShared: p => (p.category === 'templo' ? { emoji: '⛩️', color: '#123' } : { emoji: '📍', color: '#456' }),
  DANI_ROUTE_GROUPS: [
    { id: 'r1', label: 'Dani · día 1', color: '#C1440E', placeIds: ['dani_a', 'dani_b', 'dani_missing'] },
    { id: 'r2', label: 'Dani · día 2', color: '#223A5E', placeIds: ['dani_only'] }, // <2 resolvable pts
  ],
  state: { places: [
    { id: 'dani_a', name: 'Templo A', category: 'templo', source: 'dani', dani: true, lat: 1, lng: 2, notes: 'nota A' },
    { id: 'dani_b', name: 'Hotel B', category: 'otro', source: 'user', daniAdopted: true, lat: 3, lng: 4, address: 'Calle 1', checkIn: '2025-06-09', bookingRef: 'REF9' },
    { id: 'dani_only', name: 'Solo', category: 'otro', source: 'dani', lat: 5, lng: 6 },
  ]},
  L: { polyline: fakeLine, marker: fakeMarker, divIcon: o => o },
  map: {},
  mapLayers: [],
};

const fn = new Function(...Object.keys(sandbox), src + `
  return {sourceValueForPlace, renderDaniItinerary, drawDaniRoutes};
`);
const api = fn(...Object.values(sandbox));

// sourceValueForPlace
console.log('src(dani flag)=', api.sourceValueForPlace({ dani: true }));
console.log('src(insta)=', api.sourceValueForPlace({ source: 'insta' }));
console.log('src(user)=', api.sourceValueForPlace({ source: 'user' }));
console.log('src(null)=', api.sourceValueForPlace(null));

// renderDaniItinerary
api.renderDaniItinerary();
const h = dom.innerHTML;
console.log('hasD1=', h.includes('>D1<'), 'hasD2=', h.includes('>D2<'));
console.log('hasTemploA=', h.includes('Templo A'), 'hasNota=', h.includes('nota A'));
console.log('pasarForDani=', h.includes("adoptPlace('dani_a')"));
console.log('adoptedPill=', /✓ nuestro/.test(h) && !h.includes("adoptPlace('dani_b')"));
console.log('hotelExtra=', h.includes('Calle 1') && h.includes('REF9') && h.includes('2025-06-09'));
console.log('missingSkipped=', !h.includes('dani_missing'));

// drawDaniRoutes: route 1 has 2 resolvable points -> line+badge; route 2 has 1 -> skipped
api.drawDaniRoutes();
console.log('layers=', layers.join(','), 'mapLayersLen=', sandbox.mapLayers.length);
