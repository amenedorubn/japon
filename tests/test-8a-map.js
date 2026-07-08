// Phase 8a verification: boots the ENTIRE real app.js under Node with
// DOM + Leaflet stubs, then drives the actual map pipeline.
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
const windowStub = { scrollTo(){} };
const store = { jp27_sync: '0' }; // cloud OFF for the harness
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

// ---------- Leaflet stub ----------
const Lstats = { polyline: 0, marker: 0, circleMarker: 0, polygon: 0, geoJSON: 0, tileLayer: 0 };
const tileUrls = [];
function mkLayer(type){
  Lstats[type]++;
  return { _type: type,
    addTo(t){ t._isGroup ? t._children.add(this) : t.addLayer(this); return this; },
    bindPopup(){ return this; }, bindTooltip(){ return this; }, on(){ return this; },
  };
}
function mkLMap(){
  return { _layers: new Set(), zoom: 11, _isGroup: false,
    setView(){ return this; }, on(){ return this; }, invalidateSize(){},
    getZoom(){ return this.zoom; },
    addLayer(l){ this._layers.add(l); }, removeLayer(l){ this._layers.delete(l); },
    fitBounds(){},
  };
}
const L = {
  map: () => mkLMap(),
  tileLayer: url => { tileUrls.push(url); return mkLayer('tileLayer'); },
  polyline: () => mkLayer('polyline'),
  marker: () => mkLayer('marker'),
  circleMarker: () => mkLayer('circleMarker'),
  polygon: () => mkLayer('polygon'),
  geoJSON: () => mkLayer('geoJSON'),
  layerGroup: () => ({ _isGroup: true, _children: new Set(),
    addTo(m){ m.addLayer(this); return this; }, addLayer(l){ this._children.add(l); } }),
  divIcon: o => o,
  latLngBounds: () => ({ pad(){ return {}; } }),
};
let fetchCount = 0;
const fetchStub = () => { fetchCount++; return Promise.resolve({ ok: true, json: async () => ({ code: 'NoRoute', elements: [] }) }); };

// ---------- boot the real app ----------
const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return {
    showTab, initMapView, renderMapDay, renderZones, setTheme, state,
    getMap: () => map, getMapLayers: () => mapLayers, getZonesLayer: () => zonesLayer,
    setMapDay: v => { mapDay = v; }, getMapDay: () => mapDay,
    setFlights: v => { flightsVisible = v; },
    srcState, activeMapCategories, CATS, FLIGHTS,
  };`);
const api = boot(documentStub, windowStub, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const layersOfType = t => [...api.getMap()._layers].filter(l => l._type === t);
const zoneChildren = t => [...api.getZonesLayer()._children].filter(l => l._type === t);

(async () => {
  // Boot sanity: app evaluated, merged seed built (2 airports + 38 catalog +
  // 150 dani + 92 curated folded in = 282, Fase 10a; +1 Louis House (Fase 12 §9.4) = 283)
  check('boot: merged seed state built (283 places)', api.state.places.length === 283);

  // Open the map tab (initMapView is deferred by 60ms), then let the
  // day-mode OSRM queue drain fully (1 job / 250ms) before measuring.
  api.showTab('mapa');
  await sleep(1500);
  check('R1: initial tiles are light (voyager)', tileUrls.length === 1 && tileUrls[0].includes('voyager'));
  check('P6: default is a day (not all-days)', api.getMapDay() >= 0);
  const dayMarkers = layersOfType('marker').length;
  check('day mode: numbered stop markers drawn', dayMarkers >= 4);

  // R1: theme switch swaps the tile layer without stacking
  api.setTheme('dark');
  check('R1: dark tiles applied', tileUrls.length === 2 && tileUrls[1].includes('dark_all'));
  check('R1: exactly one tile layer on the map', layersOfType('tileLayer').length === 1);
  api.setTheme('light');
  check('R1: back to light, still one tile layer', tileUrls[2].includes('voyager') && layersOfType('tileLayer').length === 1);

  // P6: all-days = markers only, no route polylines, no OSRM status
  api.setMapDay(-1);
  const polyBefore = Lstats.polyline;
  const fetchBefore = fetchCount;
  api.renderMapDay();
  await sleep(400); // let any stale async route callbacks fire (token guard must block them)
  check('P6: all-days draws zero route polylines', Lstats.polyline === polyBefore);
  check('P6: all-days triggers no new OSRM/rail fetches', fetchCount === fetchBefore);
  check('P6: all-days draws POI markers', layersOfType('circleMarker').length > 80);
  check('P6: routeStatus hidden', els['#routeStatus'].style.display === 'none');
  check('P6: day chips include Todos active', els['#mapDayChips'].innerHTML.includes('Todos'));

  // no leaks: re-render keeps the map layer count stable
  const before = api.getMap()._layers.size;
  api.renderMapDay(); api.renderMapDay();
  check('leak: repeated renders keep layer count stable', api.getMap()._layers.size === before);

  // M4: flights in all-days mode = 4 arcs; map-attached markers = 4 planes + 3 airports
  // (Lstats.marker also counts zone pins inside zonesLayer, so count map markers)
  const p0 = Lstats.polyline;
  api.setFlights(true);
  api.renderMapDay();
  check('M4: 4 great-circle arcs', Lstats.polyline - p0 === 4);
  check('M4: 4 planes + 3 airports on map', layersOfType('marker').length === 7);

  // M4: flight day (day 0, legs 1+2, no stops) = 2 arcs + 2 planes + 3 airports
  api.setMapDay(0);
  const p1 = Lstats.polyline;
  api.renderMapDay();
  check('M4: flight day draws its 2 legs', Lstats.polyline - p1 === 2);
  check('M4: flight day draws 2 planes + 3 airports', layersOfType('marker').length === 5);
  api.setFlights(false);

  // M5: category filter reduces POIs (and integrates with sources)
  api.setMapDay(-1);
  api.renderMapDay();
  const allPois = layersOfType('circleMarker').length;
  ['templo', 'comida', 'compras'].forEach(c => api.activeMapCategories.delete(c));
  api.renderMapDay();
  const filteredPois = layersOfType('circleMarker').length;
  check(`M5: filtering cats reduces POIs (${allPois} -> ${filteredPois})`, filteredPois < allPois && filteredPois > 0);
  ['templo', 'comida', 'compras'].forEach(c => api.activeMapCategories.add(c));

  // source filter: Dani layer adds markers + 14 route polylines
  api.renderMapDay();
  const pn = Lstats.polyline, cn = layersOfType('circleMarker').length;
  api.srcState.d = true;
  api.renderMapDay();
  check('src: Dani layer adds circle markers', layersOfType('circleMarker').length > cn);
  check('M3/src: Dani layer adds 14 route polylines', Lstats.polyline - pn === 14);
  api.srcState.d = false;

  // M6: zone pins below threshold, polygons above
  api.getMap().zoom = 5;
  api.renderZones();
  const pinsLow = zoneChildren('marker').length;
  const polysLow = zoneChildren('polygon').length + zoneChildren('geoJSON').length;
  api.getMap().zoom = 16;
  api.renderZones();
  const pinsHigh = zoneChildren('marker').length;
  const polysHigh = zoneChildren('polygon').length + zoneChildren('geoJSON').length;
  check(`M6: low zoom degrades zones to pins (${pinsLow} pins, ${polysLow} polys)`, pinsLow > 10 && polysLow >= 3);
  check(`M6: high zoom draws polygons, no pins (${pinsHigh} pins, ${polysHigh} polys)`, pinsHigh === 0 && polysHigh > 15);
  // M5 on zones: hiding 'zona' category removes zone polygons (base cities stay)
  api.activeMapCategories.delete('zona');
  api.renderZones();
  const polysNoZona = zoneChildren('polygon').length + zoneChildren('geoJSON').length;
  check('M5: zona category off hides barrio zones (base cities remain)', polysNoZona < polysHigh && polysNoZona >= 3);
  api.activeMapCategories.add('zona');

  console.log(fail ? '\n' + fail + ' FAILURES' : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
