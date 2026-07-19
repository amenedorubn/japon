// Verificación 12.53: el eje de ZONA (geografía derivada de coordenadas).
// La zona es un eje NUEVO E INDEPENDIENTE: se deriva de lat/lng, nunca se
// escribe a mano, y no toca el campo region, ni el eje de fuente, ni el de
// confirmado, ni los gemelos. Esta suite fija esas fronteras.
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
    addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){}, createPane: () => ({ style: {} }) }),
  tileLayer: () => mkLayer(), polyline: () => mkLayer(), marker: () => mkLayer(),
  circleMarker: () => mkLayer(), polygon: () => mkLayer(), geoJSON: () => mkLayer(),
  layerGroup: () => ({ addTo(){ return this; }, addLayer(){} }),
  divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }),
};
const fetchStub = () => Promise.resolve({ ok: true, json: async () => [] });

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return { state, ZONES, ZONE_NONE, zoneOf, zoneLabel, pointInPolygon, placeView, listablePlaces,
            TOKYO_CITY_POLYGON, provenanceOf, placeProvenances, bookedHotels, isConfirmed,
            TWIN_GROUPS, isTwinMember, renderSitios, renderZones, activeMapCategories,
            setPlaceZone: v => { placeZone = v; },
            getPlaceZone: () => placeZone };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const places = api.state.places;
const zoneOf = api.zoneOf;
const byName = n => places.find(p => p && p.name === n);

// ================= 1) LA ZONA ES DERIVADA Y ESTABLE =================
check('zona: es función pura de las coordenadas (mismo punto, misma zona)',
  zoneOf({ lat: 35.6762, lng: 139.6503 }) === zoneOf({ lat: 35.6762, lng: 139.6503 }));
check('zona: no depende del orden en que se recorran los lugares',
  JSON.stringify(places.map(zoneOf)) ===
  JSON.stringify(places.slice().reverse().map(zoneOf).reverse()));
check('zona: sin coordenadas no hay zona (no se inventa)',
  zoneOf({ lat: null, lng: null }) === null && zoneOf(null) === null && zoneOf({}) === null);
check('zona: un punto fuera de todos los radios no tiene zona (Okinawa)',
  zoneOf({ lat: 26.2124, lng: 127.6809 }) === null);
// La zona NO se guarda: no se puede escribir a mano, ni quedarse vieja, ni
// viajar a la nube. Vive solo como lectura derivada en placeView.
check('zona: NO se escribe en state.places (nunca a mano)',
  places.every(p => !('zone' in p)));
check('zona: se lee derivada desde placeView',
  api.placeView(byName('Templo Sensō-ji')).zone === 'tokio');
const moved = { lat: 35.0116, lng: 135.7681 };
check('zona: si un sitio se mueve, su zona se recalcula sola (caché por coordenada)',
  api.placeView(Object.assign({}, byName('Templo Sensō-ji'), moved)).zone === 'kioto');

// ================= 2) POLÍGONO manda sobre RADIO =================
// Franja del suroeste de Tokio (Ōta) que está DENTRO del polígono de los 23
// barrios pero más cerca del ancla de Yokohama (12,2 km) que de la de Tokio
// (13,8 km): sin el polígono caería en Yokohama. Hoy ningún sitio real cae
// ahí — el polígono es la guarda para cuando alguno caiga.
const otaSW = { lat: 35.552, lng: 139.656 };
const distTo = (p, ll) => api.ZONES && Math.round(
  Math.hypot((p.lat - ll[0]) * 111, (p.lng - ll[1]) * 91));
check('zona: dentro del polígono de Tokio, aunque el ancla de Yokohama esté más cerca',
  api.pointInPolygon(otaSW, api.TOKYO_CITY_POLYGON) &&
  distTo(otaSW, [35.4437, 139.6380]) < distTo(otaSW, [35.6762, 139.6503]) &&
  zoneOf(otaSW) === 'tokio');
check('zona: Yokohama sigue siendo Yokohama (no la absorbe Tokio)',
  zoneOf({ lat: 35.4437, lng: 139.6380 }) === 'yokohama');
check('zona: pointInPolygon acierta dentro y fuera',
  api.pointInPolygon({ lat: 35.6762, lng: 139.6503 }, api.TOKYO_CITY_POLYGON) &&
  !api.pointInPolygon({ lat: 34.6937, lng: 135.5023 }, api.TOKYO_CITY_POLYGON));

// ================= 3) LO QUE VENÍA A ARREGLAR =================
// "Osaka" y "Dani · Osaka" son la MISMA geografía: la zona los colapsa sin
// tocar el eje de fuente (cada uno conserva su procedencia).
const osakaish = places.filter(p => /^(Dani · )?Osaka$/.test(p.region || '') && zoneOf(p));
check('zona: "Osaka" y "Dani · Osaka" colapsan en una sola zona',
  osakaish.length > 40 && osakaish.every(p => zoneOf(p) === 'osaka') &&
  new Set(osakaish.map(p => p.region)).size === 2);
check('zona: …y sus procedencias siguen siendo distintas (el eje de fuente no se toca)',
  new Set(osakaish.map(p => api.provenanceOf(p))).size >= 2);
// "Kioto y Nara" es una etiqueta con dos ciudades dentro: las coordenadas deciden.
const kn = places.filter(p => p.region === 'Kioto y Nara');
check('zona: "Kioto y Nara" se reparte por coordenadas entre Kioto y Nara',
  kn.length === 46 && kn.filter(p => zoneOf(p) === 'kioto').length === 38 &&
  kn.filter(p => zoneOf(p) === 'nara').length === 8);
check('zona: Tōdai-ji cae en Nara y Kinkaku-ji en Kioto',
  zoneOf(byName('Tōdai-ji')) === 'nara' && zoneOf(byName('Kinkaku-ji (Pabellón Dorado)')) === 'kioto');
// Un sitio mal etiquetado a mano no engaña a la geografía.
check('zona: un sitio de la lista "Tokio" que está en el Fuji cae en Monte Fuji',
  byName('Lake Kawaguchi').region === 'Tokio' && zoneOf(byName('Lake Kawaguchi')) === 'fuji');

// ================= 4) LAS ZONAS SON LAS PEDIDAS =================
// 12.55: "Fukuoka" pasó a ser "Kyūshū" (cubre toda la isla).
const LABELS = ['Tokio', 'Kioto', 'Osaka', 'Nara', 'Hiroshima', 'Miyajima', 'Himeji', 'Nikko',
  'Kamakura', 'Yokohama', 'Monte Fuji', 'Alpes', 'Nagoya', 'Kanazawa', 'Nagano', 'Kyūshū'];
check('zonas: son exactamente las 16 pedidas (14 de 12.53/12.55 + Kanazawa y Himeji de la Ruta)',
  JSON.stringify(api.ZONES.map(z => z.label)) === JSON.stringify(LABELS));
check('zonas: Ideas/Excursiones/Aeropuerto NO son zonas',
  !api.ZONES.some(z => /ideas|excursion|aeropuerto/i.test(z.label)));
// 12.55: además de las 3 ciudades, Kyūshū tiene polígono (la isla entera).
check('zonas: 3 ciudades + isla de Kyūshū tienen polígono; todas tienen anclaje y radio',
  api.ZONES.filter(z => z.polygon).map(z => z.id).join() === 'tokio,kioto,osaka,kyushu' &&
  api.ZONES.every(z => z.anchors.length >= 1 && z.r > 0));

// ================= 4b) 12.55 · KYŪSHŪ CUBRE LA ISLA, NO HONSHU =================
// Rename + ampliación: "Fukuoka" → "Kyūshū", su polígono es la isla. Los tres
// lugares del sur caen en la MISMA zona; el estrecho de Kanmon corta al norte
// para no colarse a Honshu (Shimonoseki/Yamaguchi). Solo cambia la ZONA
// (derivada): ni la fuente ni las coordenadas de los lugares se tocan.
check('kyushu: el id se renombró (ya no hay zona "fukuoka")',
  !api.ZONES.some(z => z.id === 'fukuoka') && api.zoneLabel('kyushu') === 'Kyūshū');
check('kyushu: Fukuoka, Takachiho y "Kyūshū (isla)" caen los tres en kyushu',
  zoneOf(byName('Fukuoka')) === 'kyushu' &&
  zoneOf(byName('Garganta de Takachiho')) === 'kyushu' &&
  zoneOf(byName('Kyūshū (isla)')) === 'kyushu');
const KYU_POLY = api.ZONES.find(z => z.id === 'kyushu').polygon;
check('kyushu: no se cuela a Honshu (Shimonoseki y Yamaguchi fuera)',
  zoneOf({lat: 33.9576, lng: 130.9412}) !== 'kyushu' &&
  zoneOf({lat: 34.1785, lng: 131.4737}) !== 'kyushu' &&
  !api.pointInPolygon({lat: 33.9576, lng: 130.9412}, KYU_POLY));
check('kyushu: en la zona caen esos 3 + los 3 sitios de Fukuoka y su base de hotel (Ruta)',
  places.filter(p => zoneOf(p) === 'kyushu').length === 7);

// ================= 5) NO ROMPE LOS OTROS EJES =================
// Fuente: los 139 de María siguen siendo de María, etc.
check('no rompe el eje de fuente: las procedencias no cambian',
  places.filter(p => api.provenanceOf(p) === 'maria').length === 139 &&
  places.filter(p => api.provenanceOf(p) === 'dani').length > 0);
check('no rompe el campo region: sigue intacto y editable',
  byName('Lake Kawaguchi').region === 'Tokio' &&
  places.some(p => p.region === 'Dani · Osaka') && places.some(p => p.region === 'Kioto y Nara'));
// Confirmado: los 2 hoteles reservados siguen siéndolo.
check('no rompe el eje confirmado: siguen los 2 hoteles reservados',
  api.bookedHotels().length === 2);
check('no rompe el plan: los 21 días siguen ahí y sin campo zone',
  api.state.days.length === 21 && api.state.days.every(d => !('zone' in d)));
// Gemelos: la zona no los toca (y como es geografía, los dos caen en la misma).
check('no rompe los gemelos: TWIN_GROUPS intacto',
  Array.isArray(api.TWIN_GROUPS) && api.TWIN_GROUPS.length > 0);
// Un gemelo es el MISMO sitio visto por dos fuentes: si la zona fuese de
// verdad geográfica, ancla y miembros tienen que caer en la misma.
check('gemelos: ancla y miembros comparten zona (son el mismo sitio)',
  api.TWIN_GROUPS.every(g => {
    const zs = [g.anchor].concat(g.members)
      .map(id => places.find(x => x && x.id === id)).filter(Boolean).map(zoneOf);
    return new Set(zs).size <= 1;
  }));

// ================= 6) EL FILTRO =================
api.setPlaceZone('');
api.renderSitios();
const allHTML = els['#placesGrid'].innerHTML;
check('filtro Ideas: hay chips de zona', els['#zoneChips'].innerHTML.includes('Todas las zonas'));
check('filtro Ideas: el chip "Sin zona" aparece porque hay sitios fuera de toda zona',
  els['#zoneChips'].innerHTML.includes('Sin zona'));
api.setPlaceZone('miyajima');
api.renderSitios();
const miyaHTML = els['#placesGrid'].innerHTML;
const miyaCount = (miyaHTML.match(/class="card place-card"/g) || []).length;
check('filtro Ideas: al elegir Miyajima solo quedan los de Miyajima',
  miyaCount > 0 && miyaCount < (allHTML.match(/class="card place-card"/g) || []).length &&
  miyaHTML.includes('Itsukushima') === true);
api.setPlaceZone(api.ZONE_NONE);
api.renderSitios();
check('filtro Ideas: "Sin zona" enseña los que no caen en ninguna (no los esconde)',
  (els['#placesGrid'].innerHTML.match(/class="card place-card"/g) || []).length > 0);
api.setPlaceZone('');

// ================= 6b) EL FILTRO DE REGION SE RETIRÓ, EL CAMPO NO =================
// Lo geográfico se filtra solo por zona. El campo region sigue vivo: en la
// ficha, en el formulario y como subtítulo de cada tarjeta.
check('Ideas: ya no hay filtro por region (era el ruido que la zona arregla)',
  !/id="regionChips"/.test(appJs + fs.readFileSync(process.argv[2], 'utf8')) &&
  !/placeRegion\s*=/.test(appJs));
check('el CAMPO region sigue en el formulario de un sitio', /id="fpRegion"/.test(appJs));
check('el CAMPO region sigue leyéndose de los lugares', places.some(p => !!p.region));
api.setPlaceZone('');
api.renderSitios();
const gridHTML = els['#placesGrid'].innerHTML;
check('el CAMPO region sigue como subtítulo de las tarjetas',
  gridHTML.includes('Dani · Osaka') || gridHTML.includes('Kioto y Nara') || /Tokio/.test(gridHTML));
// La vista general agrupa por el MISMO eje por el que se filtra.
check('Ideas: la vista general agrupa por zona, no por region',
  gridHTML.includes('ideas-more') && /data-zone="/.test(gridHTML) && !/data-region="/.test(gridHTML));
// Nada se queda inalcanzable al quitar el filtro de region: los cubos que
// vivían ahí siguen teniendo su chip de zona o de categoría.
const listable = api.listablePlaces();
const excursiones = listable.filter(p => p.region === 'Excursiones');
check('reachability: los de "Excursiones" siguen alcanzables por categoría',
  excursiones.length === 6 && excursiones.every(p => p.category === 'excursion'));
check('reachability: …y también por zona (o por "Sin zona")',
  excursiones.every(p => zoneOf(p) || true) && excursiones.filter(p => zoneOf(p)).length === 5);
const ideasBucket = listable.filter(p => p.region === 'Ideas');
check('reachability: los de "Ideas" siguen alcanzables por zona o por "Sin zona"',
  ideasBucket.length === 11 && ideasBucket.every(p => !!api.placeView(p).cat));
// Los aeropuertos nunca estuvieron en Ideas: listablePlaces() ya los excluía.
check('reachability: los aeropuertos no se pierden (nunca estuvieron en Ideas)',
  places.filter(p => p.airport).length > 0 && !listable.some(p => p.airport));

// ================= 7) ZONA ES EJE INDEPENDIENTE DE LA FUENTE =================
// Las zonas de barrio se pintan siempre (la geografía no depende de quién
// propuso el sitio ni del itinerario activo). En 12.56 se retiraron del mapa
// las capas por fuente (srcState): ya no existen en el código.
api.renderZones(); // se pinta sin depender de ninguna fuente
check('renderZones: ya no depende de la fuente (srcState retirado del mapa)',
  !/srcState/.test(appJs));
check('renderZones: sigue respetando el filtro de categoría (M5)',
  /activeMapCategories\.has/.test(appJs));

// ================= 7b) 12.54 · DOS MAPAS: ZONA EN IDEAS, DÍAS EN EL PLAN ======
// El mapa del PLAN (Itinerarios) se filtra SOLO por días: el filtro geográfico
// por zona se retiró de él (ya no existe mapZone en el código).
check('mapa del plan: ya no filtra por zona (mapZone retirado del código)',
  !/\bmapZone\b/.test(appJs));
// El filtro geográfico por zona vive ahora en el mapa de IDEAS, que reutiliza
// el MISMO filtro de zona que la lista (placeZone), "Sin zona" incluido.
check('mapa de Ideas: existe y se alimenta de los items ya filtrados de la lista',
  /function renderIdeasMap/.test(appJs) && /renderIdeasMap\(items\)/.test(appJs));
check('mapa de Ideas: el eje geográfico es placeZone e incluye "Sin zona"',
  /placeZone === ZONE_NONE \? !x\.p\.zone : x\.p\.zone === placeZone/.test(appJs));
check('filtro de zona de Ideas: arranca en "todas"', api.getPlaceZone() === '');
api.setPlaceZone('kioto');
check('filtro de zona de Ideas: se puede fijar una zona', api.getPlaceZone() === 'kioto');
api.setPlaceZone('');

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
