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
    setDaniLines: v => { daniLinesVisible = v; },
    setItinMode, getItinMode: () => itinMode,
    itineraryPlaceIds, itineraryDays, provenanceOf, canonicalPid,
    activeMapCategories, CATS, FLIGHTS,
    _reseedDays: () => { // fixture: días con paradas (el plan real nace vacío, 12.49)
      const fresh = buildSeedState();
      state.days.forEach((d, i) => { const f = fresh.days[i]; d.stops = f.stops; d.trans = f.trans; d.pre = f.pre; d.post = f.post; }); },
  };`);
const api = boot(documentStub, windowStub, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const layersOfType = t => [...api.getMap()._layers].filter(l => l._type === t);
const zoneChildren = t => [...api.getZonesLayer()._children].filter(l => l._type === t);

(async () => {
  // Boot sanity: app evaluated, merged seed built (2 airports + 38 catalog +
  // 150 dani + 106 curated folded in = 296, Fase 10a/12; +1 Louis House (Fase 12 §9.4) = 297)
  // María (provenance 'maria') es aditiva; se excluye del recuento del catálogo base.
  check('boot: merged seed state built (297 places excl. María)', api.state.places.filter(p => p.provenance !== 'maria').length === 297);

  // Open the itinerary tab (12.54: el mapa vive embebido en Itinerarios; ya no
  // hay pestaña "Mapa" suelta). 12.56: el mapa muestra SOLO el itinerario activo
  // y arranca en "Todos" (mapDay -1). initMapView se difiere 60ms.
  api._reseedDays(); // Realidad necesita días con paradas (fixture)
  api.showTab('itinerario');
  await sleep(1500);
  check('R1: initial tiles are light (voyager)', tileUrls.length === 1 && tileUrls[0].includes('voyager'));
  check('12.56: por defecto el itinerario activo es Realidad (ours)', api.getItinMode() === 'ours');
  check('12.56: el mapa arranca en "Todos" (todo el itinerario, no un día)', api.getMapDay() === -1);

  // Realidad + Todos: solo marcadores (POIs de Realidad), sin rutas ni OSRM.
  const polyBefore = Lstats.polyline;
  const fetchBefore = fetchCount;
  api.renderMapDay();
  await sleep(400); // deja disparar callbacks async rezagados (el token debe bloquearlos)
  check('Realidad/Todos: cero polilíneas de ruta', Lstats.polyline === polyBefore);
  check('Realidad/Todos: cero fetches OSRM/rail', fetchCount === fetchBefore);
  const oursPois = layersOfType('circleMarker').length;
  check('Realidad/Todos: dibuja los POIs de Realidad (procedencia ours)', oursPois > 10);
  check('P6: day chips include Todos', els['#mapDayChips'].innerHTML.includes('Todos'));

  // Realidad + un día con paradas → marcadores numerados + rutas calculadas.
  const dayIdx = api.state.days.findIndex(d => d.stops && d.stops.length >= 4);
  api.setMapDay(dayIdx);
  api.renderMapDay();
  await sleep(400);
  check('Realidad/día: dibuja los marcadores numerados de las paradas (>=4)',
    layersOfType('marker').length >= 4);
  api.setMapDay(-1);
  api.renderMapDay();

  // R1: theme switch swaps the tile layer without stacking
  api.setTheme('dark');
  check('R1: dark tiles applied', tileUrls.length === 2 && tileUrls[1].includes('dark_all'));
  check('R1: exactly one tile layer on the map', layersOfType('tileLayer').length === 1);
  api.setTheme('light');
  check('R1: back to light, still one tile layer', tileUrls[2].includes('voyager') && layersOfType('tileLayer').length === 1);

  // no leaks: re-render keeps the map layer count stable
  const before = api.getMap()._layers.size;
  api.renderMapDay(); api.renderMapDay();
  check('leak: repeated renders keep layer count stable', api.getMap()._layers.size === before);

  // M4: vuelos en Realidad/Todos = 4 arcos; markers en el mapa = 4 aviones + 3 aeropuertos
  const p0 = Lstats.polyline;
  api.setFlights(true);
  api.renderMapDay();
  check('M4: 4 arcos de círculo máximo (Realidad, Todos)', Lstats.polyline - p0 === 4);
  check('M4: 4 aviones + 3 aeropuertos en el mapa', layersOfType('marker').length === 7);

  // M4: día de vuelo (día 0, legs 1+2, sin paradas) = 2 arcos + 2 aviones + 3 aeropuertos
  api.setMapDay(0);
  const p1 = Lstats.polyline;
  api.renderMapDay();
  check('M4: el día de vuelo dibuja sus 2 tramos', Lstats.polyline - p1 === 2);
  check('M4: el día de vuelo dibuja 2 aviones + 3 aeropuertos', layersOfType('marker').length === 5);
  api.setFlights(false);
  api.setMapDay(-1);

  // ============ 12.56 · SCOPING DEL MAPA POR ITINERARIO ============
  // El mapa muestra SOLO los elementos del itinerario activo. Membership, no
  // procedencia: la Propuesta (IA) incluye lugares 'ai'; las ideas sueltas
  // (insta / ai fuera de un itinerario) no aparecen en ningún mapa.
  const oursIds = api.itineraryPlaceIds('ours');
  const seedIds = api.itineraryPlaceIds('seed');
  const daniIds = api.itineraryPlaceIds('dani');
  const mariaIds = api.itineraryPlaceIds('maria');
  const hasCanon = (set, p) => set.has(api.canonicalPid(p.id)) || set.has(p.id);
  // (a) La Propuesta (seed) SÍ incluye lugares de procedencia 'ai' (es la IA).
  const seedAiPlaces = api.state.places.filter(p => p && hasCanon(seedIds, p) && api.provenanceOf(p) === 'ai');
  check('scoping: la Propuesta incluye lugares de procedencia ai (es el itinerario de la IA)',
    seedAiPlaces.length > 0);
  // (b) Las ideas sueltas 'insta'/'ai' que NO están en la Propuesta no entran en
  //     NINGÚN itinerario (ni Realidad, ni Dani, ni María, ni la propia seed).
  const looseIdeas = api.state.places.filter(p => p && !p.airport && !p.baseLayer && !p.cityBase &&
    (api.provenanceOf(p) === 'instagram' || api.provenanceOf(p) === 'ai') && !hasCanon(seedIds, p));
  const anyLooseInItin = looseIdeas.some(p =>
    hasCanon(oursIds, p) || hasCanon(daniIds, p) || hasCanon(mariaIds, p));
  check('scoping: ninguna idea suelta (insta / ai fuera de la Propuesta) pertenece a otro itinerario',
    looseIdeas.length > 0 && !anyLooseInItin);
  // (c) Instagram nunca pertenece a un itinerario.
  const instaPlaces = api.state.places.filter(p => p && api.provenanceOf(p) === 'instagram');
  check('scoping: los sitios de Instagram no están en ningún itinerario',
    instaPlaces.every(p => !hasCanon(oursIds, p) && !hasCanon(seedIds, p) &&
      !hasCanon(daniIds, p) && !hasCanon(mariaIds, p)));

  // Dani: al seleccionar su itinerario, el mapa pinta sus puntos; con el toggle
  // de líneas ON dibuja 14 polilíneas de ruta (una por jornada) y 0 con OFF.
  api.setItinMode('dani');
  api.setDaniLines(false);
  api.renderMapDay();
  const daniPois = layersOfType('circleMarker').length;
  check('Dani: el mapa pinta los puntos de la ruta de Dani', daniPois > 30);
  const pn = Lstats.polyline;
  api.setDaniLines(true);
  api.renderMapDay();
  check('Dani: con el toggle de líneas ON añade 14 polilíneas de ruta', Lstats.polyline - pn === 14);
  const pOff = Lstats.polyline;
  api.setDaniLines(false);
  api.renderMapDay();
  check('Dani: con el toggle OFF no dibuja ninguna línea (0 nuevas)', Lstats.polyline - pOff === 0);

  // María: su mapa pinta sus sitios (procedencia maria), no los de otros.
  api.setItinMode('maria');
  api.renderMapDay();
  const mariaPois = layersOfType('circleMarker').length;
  check('María: el mapa pinta los sitios de María', mariaPois > 100);

  // Propuesta: su mapa pinta sus lugares (y ninguno es un aeropuerto/base).
  api.setItinMode('seed');
  api.renderMapDay();
  check('Propuesta: el mapa pinta los lugares de la Propuesta', layersOfType('circleMarker').length > 10);

  // M5: el filtro de categoría reduce POIs (en María, con muchos sitios diversos)
  api.setItinMode('maria');
  api.renderMapDay();
  const allPois = layersOfType('circleMarker').length;
  ['templo', 'comida', 'compras'].forEach(c => api.activeMapCategories.delete(c));
  api.renderMapDay();
  const filteredPois = layersOfType('circleMarker').length;
  check(`M5: filtrar categorías reduce POIs (${allPois} -> ${filteredPois})`, filteredPois < allPois && filteredPois > 0);
  ['templo', 'comida', 'compras'].forEach(c => api.activeMapCategories.add(c));
  api.setItinMode('ours');

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
