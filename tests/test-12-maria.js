// Verificación 12.52: la ficha de referencia de María (su viaje de 2024).
// Cubre lo que el importador extrae, el puente ciudad→lista de Google Maps, el
// render de solo lectura y — lo más importante — que NADA privado del xlsx
// llegue a index.html ni al JSON. El repo es PÚBLICO (GitHub Pages): esta suite
// es la red que impide publicar los enlaces de reserva, el id de reserva o el
// alojamiento particular de su anfitriona.
const fs = require('fs');
const path = require('path');
const appJs = fs.readFileSync(process.argv[2], 'utf8');
const ROOT = path.join(__dirname, '..');

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
  ;return { startApp, state, MARIA_TRIP_2024, MARIA_HOTELS_2024, MARIA_MAPS, MARIA_PLACES, MARIA_CITY_LIST,
            mariaMapsForCities, renderMariaItinerary, setItinMode, provenanceOf };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
api.startApp(); // Prioridad 4: arranque real gateado tras auth; los tests lo disparan a mano.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tripJson = fs.readFileSync(path.join(ROOT, 'import', 'maria-trip.json'), 'utf8');
const importer = require(path.join(ROOT, 'tools', 'maria-xlsx-import.js'));

// ================= 1) PRIVACIDAD (el repo es PÚBLICO) =================
// Esta suite se versiona, así que NO puede llevar dentro los secretos que
// vigila: comprobarlos por lista negra los publicaría aquí. Se comprueba por
// LISTA BLANCA — lo único que puede salir del xlsx es el pin de Google Maps —
// y la lista negra real se deriva del xlsx (que no se versiona) en el
// importador. Todo enlace publicado tiene que ser un pin de Maps.
const publishedUrls = src => [...new Set(src.match(/https?:\/\/[^"'\s)]+/g) || [])];
const MARIA_BLOCK = (html.match(/@@MARIA_TRIP_START([\s\S]*?)@@MARIA_TRIP_END/) || [])[1] || '';
check('privacidad · el bloque horneado solo enlaza a maps.app.goo.gl',
  MARIA_BLOCK.length > 0 && publishedUrls(MARIA_BLOCK).every(u => u.startsWith('https://maps.app.goo.gl/')));
check('privacidad · maria-trip.json solo enlaza a maps.app.goo.gl',
  publishedUrls(tripJson).every(u => u.startsWith('https://maps.app.goo.gl/')));
check('privacidad · maria-trip.json no trae ningún enlace de reserva',
  !/booking|hotel-?reserv|yoyaku|reservation|plcal/i.test(tripJson));
check('privacidad · el JSON solo lleva los campos publicables',
  JSON.parse(tripJson).days.every(d => Object.keys(d).sort().join() === 'activities,cities,date,move,n,stay,weekday'));
check('privacidad · una noche de hotel solo lleva su número, sin datos de reserva',
  JSON.parse(tripJson).days.filter(d => d.stay && d.stay.kind === 'hotel')
    .every(d => Object.keys(d.stay).sort().join() === 'kind,n'));
check('privacidad · un hotel solo lleva nombre y pin de mapa',
  JSON.parse(tripJson).hotels.every(h => Object.keys(h).sort().join() === 'map,n,name'));
// La hoja "costs" (precios y reparto entre ellas) no se lee nunca.
check('privacidad · nada de la hoja de costes se publica',
  !/costs|Yen（|precio|price|￥|€/i.test(tripJson));
// Ni el importador ni esta suite pueden llevar los secretos escritos dentro —
// ni en el código, ni en un COMENTARIO: un ejemplo ilustrativo que cite la
// etiqueta real publica justo lo que venía a proteger. Cubre cada palabra
// suelta, no solo la etiqueta entera.
const guardSrc = fs.readFileSync(path.join(ROOT, 'tools', 'maria-xlsx-import.js'), 'utf8');
check('privacidad · el importador no lleva ningún secreto escrito dentro',
  publishedUrls(guardSrc).length === 0 && !/\d{10,}/.test(guardSrc));
check('privacidad · esta suite tampoco',
  !/\d{10,}/.test(fs.readFileSync(__filename, 'utf8')));
if (fs.existsSync(path.join(ROOT, 'planningjapon.xlsx'))) {
  const secretsNow = importer.collectPrivateStrings(importer.readSheet(path.join(ROOT, 'planningjapon.xlsx')));
  const inSrc = s => new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  check('privacidad · ningún secreto se cuela en los comentarios del importador',
    !secretsNow.some(s => inSrc(s).test(guardSrc)));
  check('privacidad · ni en los de esta suite',
    !secretsNow.some(s => inSrc(s).test(fs.readFileSync(__filename, 'utf8'))));
}
// El único enlace que puede salir del xlsx es el pin de Google Maps.
const mariaUrls = api.MARIA_HOTELS_2024.map(h => h.map).filter(Boolean);
check('privacidad · los 5 hoteles solo enlazan a maps.app.goo.gl',
  mariaUrls.length === 5 && mariaUrls.every(u => u.startsWith('https://maps.app.goo.gl/')));
// 7 noches en casa de su anfitriona (el día 1 y del 9 al 14) y 7 de hotel; el
// día 15 vuela de vuelta y ya no duerme allí.
check('privacidad · las 7 noches de alojamiento particular viajan sin nombre',
  api.MARIA_TRIP_2024.filter(d => d.stay && d.stay.kind === 'private').length === 7 &&
  api.MARIA_TRIP_2024.every(d => !d.stay || !d.stay.name));
// El xlsx crudo nunca se versiona: es la fuente, y lleva todo lo de arriba.
const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: ROOT }).toString();
check('privacidad · planningjapon.xlsx NO está versionado', !/planningjapon\.xlsx/.test(tracked));
check('privacidad · .gitignore lo mantiene fuera',
  /planningjapon\.xlsx/.test(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')));
// La guarda del importador tiene que MORDER, no solo existir. Se prueba con
// secretos de mentira: los de verdad no pueden vivir en un fichero versionado.
const bites = (trip, secrets) => {
  try { importer.assertNoPrivateData(trip, secrets); return false; } catch (e) { return true; }
};
check('privacidad · la guarda corta cualquier enlace que no sea un pin de Maps',
  bites({ days: [{ leak: 'https://reservas.example/Share-ABC123' }] }, []));
check('privacidad · la guarda corta un secreto derivado del xlsx (p.ej. el alojamiento particular)',
  bites({ days: [{ who: 'Habitacion De Alguien' }] }, ['Habitacion De Alguien']));
check('privacidad · la guarda corta también una palabra suelta del secreto',
  bites({ days: [{ who: 'noche en Fulanita' }] }, ['Fulanita']));
check('privacidad · la guarda deja pasar lo publicable',
  !bites({ days: [{ ok: 'TOKYO→OSAKA' }], hotels: [{ map: 'https://maps.app.goo.gl/abc' }] }, ['Fulanita']));
// Y el derivador tiene que encontrar los secretos DE VERDAD en el xlsx local.
if (fs.existsSync(path.join(ROOT, 'planningjapon.xlsx'))) {
  const secrets = importer.collectPrivateStrings(importer.readSheet(path.join(ROOT, 'planningjapon.xlsx')));
  check('privacidad · el derivador saca los secretos reales del xlsx (>= 6)', secrets.length >= 6);
  check('privacidad · y ninguno de ellos está publicado',
    !secrets.some(s => new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(html + tripJson)));
} else {
  console.log('SKIP privacidad · sin planningjapon.xlsx en local (no se versiona): no se puede derivar');
}

// ================= 2) EL VIAJE EXTRAÍDO =================
const t = api.MARIA_TRIP_2024;
check('viaje: 15 días', t.length === 15);
check('viaje: del 29 feb al 14 mar de 2024 (año bisiesto)',
  t[0].date === '2024-02-29' && t[14].date === '2024-03-14');
check('viaje: todos los días tienen ciudad', t.every(d => d.cities.length >= 1));
check('viaje: 6 actividades', t.reduce((n, d) => n + d.activities.length, 0) === 6);
check('viaje: las actividades son las suyas',
  JSON.stringify(t.flatMap(d => d.activities)) === JSON.stringify(
    ['Japanese Sweets Making Experience', '9 Onsen hopping', 'Snow Monkey Park', 'Onsen Shrine', 'Disney Sea', 'TEAM LAB']));
check('viaje: "Departure"/"Arrival" son traslado, no actividad',
  t[0].move.join().includes('Arrival') && t[14].move.join().includes('Departure') &&
  !t[0].activities.length && !t[14].activities.length);
check('viaje: 5 hoteles', api.MARIA_HOTELS_2024.length === 5);
// La trampa del xlsx: las tarjetas de hotel NO están alineadas con las columnas
// de los días. Por columna, el ① caería en el día 1 y el ⑤ en el 9: por número
// caen donde ella durmió de verdad.
check('viaje: el hotel ① es la noche del día 2 (no la del 1)',
  !(t[0].stay && t[0].stay.kind === 'hotel') && t[1].stay.kind === 'hotel' && t[1].stay.n === 1);
check('viaje: el hotel ⑤ es la noche del día 8 (no la del 9)',
  t[7].stay.n === 5 && t[8].stay.kind === 'private');
check('viaje: el "→" arrastra el hotel ③ tres noches (días 4, 5 y 6)',
  [3, 4, 5].every(i => t[i].stay.kind === 'hotel' && t[i].stay.n === 3));
check('viaje: el último día ya no duerme allí', t[14].stay === null);

// ================= 3) EL PUENTE CIUDAD → MAPA =================
check('mapas: María compartió 5 listas, una por ciudad', api.MARIA_MAPS.length === 5 &&
  api.MARIA_MAPS.every(m => !!m.city));
check('mapas: cada ciudad del puente tiene su lista',
  Object.values(api.MARIA_CITY_LIST).every(c => api.MARIA_MAPS.some(m => m.city === c)));
// La etiqueta city de MARIA_MAPS es la misma que el importador copió en cada
// sitio: si dejaran de coincidir, la ficha enlazaría a la lista equivocada.
const placeCities = [...new Set(api.MARIA_PLACES.map(p => p.city))];
check('mapas: la etiqueta de cada lista coincide con la de sus 139 sitios',
  placeCities.length === 5 && placeCities.every(c => api.MARIA_MAPS.some(m => m.city === c)));
check('mapas: TOKYO → su lista de Tokio',
  api.mariaMapsForCities(['TOKYO']).map(m => m.city).join() === 'Tokio');
check('mapas: NARA/KYOTO comparten lista y enlazan UNA vez',
  api.mariaMapsForCities(['NARA', 'KYOTO']).map(m => m.city).join() === 'Kioto y Nara');
check('mapas: un día de traslado enlaza las DOS ciudades',
  api.mariaMapsForCities(['NAGOYA', 'NAGANO']).map(m => m.city).join() === 'Nagoya,Nagano');
check('mapas: una ciudad desconocida no inventa enlace', api.mariaMapsForCities(['BERLIN']).length === 0);
check('mapas: los 15 días resuelven al menos un mapa',
  t.every(d => api.mariaMapsForCities(d.cities).length >= 1));

// ================= 4) EL RENDER =================
api.setItinMode('maria');
const panel = els['#dayPanel'].innerHTML;
check('ficha: pinta los 15 días', (panel.match(/class="m-washi seed-day"/g) || []).length === 15);
// Su viaje cruza de febrero a marzo: sin el mes, "vie 1" no dice de cuándo es.
check('ficha: cada fecha lleva su mes (el viaje cruza feb→mar)',
  /29 feb/.test(panel) && /\b1 mar/.test(panel) && /14 mar/.test(panel));
check('ficha: dice que es su viaje, no el nuestro', panel.includes('El viaje de María') && panel.includes('no una propuesta'));
check('ficha: enlaza sus mapas de ciudad', panel.includes('https://maps.app.goo.gl/3kJQast3HFWRjzB78'));
check('ficha: rotula el enlace como mapa de la CIUDAD (no del día)', panel.includes('Su mapa de la ciudad'));
check('ficha: muestra el hotel de la noche con su pin', panel.includes('Sekai Hotel Fuse') &&
  panel.includes('https://maps.app.goo.gl/kACax4t6BeE91duWA?g_st=ic'));
check('ficha: el alojamiento particular sale sin nombre', panel.includes('Alojamiento particular'));
check('ficha: muestra sus actividades', panel.includes('Japanese Sweets Making Experience') && panel.includes('TEAM LAB'));
check('ficha: es de SOLO LECTURA (no se planta ni se adopta nada)',
  !panel.includes('b-plant') && !panel.includes('b-pasar') && !panel.includes('add-stop'));
check('ficha: el panel solo enlaza a maps.app.goo.gl (nada de reservas)',
  publishedUrls(panel).length > 0 && publishedUrls(panel).every(u => u.startsWith('https://maps.app.goo.gl/')));
// Sus 139 sitios ya viven en Exploración: la ficha no los duplica.
check('ficha: no duplica sus 139 sitios (siguen en state.places)',
  api.MARIA_PLACES.length === 139 &&
  api.state.places.filter(p => api.provenanceOf(p) === 'maria').length === 139);

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
