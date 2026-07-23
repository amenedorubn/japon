// Verificación de las 5 prioridades de la fase de viaje (post-planificación):
// 1) "Líneas Dani" solo visible en el itinerario de Dani · 2) extras "si sobra
// tiempo" inlineados dentro del recorrido de un día concreto (panel + mapa) ·
// 3) agenda de Realidad: hora del hueco de transporte + aviso de reserva ·
// 4) export .ics de Realidad (misma fuente que su render editable) ·
// 5) indicador de intensidad del día (Ruta y Realidad).
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
const store = { jp27_sync: '0' }; // cloud OFF for the harness
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const Lstats = { polyline: 0, marker: 0 };
const mkLayer = type => { if(type) Lstats[type]++; return { addTo(){ return this; }, bindPopup(){ return this; },
  bindTooltip(){ return this; }, on(){ return this; }, setLatLng(){ return this; }, setView(){ return this; } }; };
const L = {
  map: () => ({ setView(){ return this; }, on(){ return this; }, invalidateSize(){}, getZoom(){ return 11; },
    addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){}, createPane: () => ({ style: {} }) }),
  tileLayer: () => mkLayer(), polyline: () => mkLayer('polyline'), marker: () => mkLayer('marker'),
  circleMarker: () => mkLayer(), polygon: () => mkLayer(), geoJSON: () => mkLayer(),
  layerGroup: () => ({ addTo(){ return this; }, addLayer(){} }),
  divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }),
};
const fetchStub = () => Promise.resolve({ ok: true, json: async () => ({ code: 'NoRoute', elements: [] }) });

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return {
    state, RUTA_DAYS, DAY_EXTRAS,
    setItinMode, getItinMode: () => itinMode, renderItinerary,
    setMapDay: v => { mapDay = v; }, getMapDay: () => mapDay, renderMapDay, getMapLayers: () => mapLayers,
    setExtrasVisible: v => { extrasVisible = v; },
    getMap: () => map, initMapView, showTab,
    transferHTML, realGapWindow, stopWindow, placeById, canonicalPid,
    realDayTimelineEntries, realidadICS, intensityScore, intensityFromScore,
    rutaDayIntensity, realDayIntensity,
    _reseedDays: () => { // fixture: días con paradas (el plan real nace vacío, 12.49)
      const fresh = buildSeedState();
      state.days.forEach((d, i) => { const f = fresh.days[i]; d.stops = f.stops; d.trans = f.trans; d.pre = f.pre; d.post = f.post; }); },
  };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const count = (s, sub) => s.split(sub).length - 1;

(async () => {
api.showTab('itinerario');
await new Promise(r => setTimeout(r, 200)); // initMapView se difiere 60ms

// ============ Prioridad 1 · "Líneas Dani" solo en el itinerario de Dani ============
api.setItinMode('ours');
check('P1: "Líneas Dani" oculto por defecto (Realidad)', els['#daniLinesToggle'].style.display === 'none');
api.setItinMode('dani');
check('P1: "Líneas Dani" visible viendo el itinerario de Dani', els['#daniLinesToggle'].style.display === '');
api.setItinMode('ruta');
check('P1: "Líneas Dani" vuelve a ocultarse en cualquier otro itinerario (Ruta)', els['#daniLinesToggle'].style.display === 'none');
api.setItinMode('ours');

// ============ Prioridad 2 · extras inlineados dentro del día ============
api._reseedDays();
api.setItinMode('ruta');
const rutaDayIdx = api.RUTA_DAYS.findIndex(d => (api.DAY_EXTRAS[d.date] || []).length > 0);
const nExtras = (api.DAY_EXTRAS[api.RUTA_DAYS[rutaDayIdx].date] || []).length;

api.setMapDay(-1); // "Todos": comportamiento global sin cambios (details colapsado)
api.renderItinerary();
const allDaysHTML = els['#dayPanel'].innerHTML;
check('P2: en "Todos" los extras siguen en su <details> colapsado (comportamiento global)',
  allDaysHTML.includes('class="m-washi spare-time"') && !allDaysHTML.includes('class="opt-stop"'));

api.setMapDay(rutaDayIdx); // día concreto: los extras se inlinean en el recorrido
api.renderItinerary();
const oneDayHTML = els['#dayPanel'].innerHTML;
check('P2 (Ruta): con un día concreto, los extras se leen dentro del recorrido (opt-stop), no aparte',
  count(oneDayHTML, 'class="opt-stop"') === nExtras && !oneDayHTML.includes('class="m-washi spare-time"'));

// Orden: DAY_EXTRAS no promete llegar en orden cronológico. Si el extra que
// hace referencia a la ÚLTIMA parada viene ANTES en el array que el que
// referencia la PRIMERA, deben seguir insertándose en orden de aparición en
// el día (offset acumulado por posición, no por orden de llegada).
{
  const rd = api.RUTA_DAYS[rutaDayIdx];
  const firstName = api.placeById(api.canonicalPid(rd.stops[0].pid)).name;
  const lastName = api.placeById(api.canonicalPid(rd.stops[rd.stops.length - 1].pid)).name;
  const savedExtras = api.DAY_EXTRAS[rd.date];
  api.DAY_EXTRAS[rd.date] = [
    { name: 'Extra del final', near: lastName, mins: 5, why: 'test' },
    { name: 'Extra del principio', near: firstName, mins: 5, why: 'test' },
  ];
  api.renderItinerary();
  const orderedHTML = els['#dayPanel'].innerHTML;
  api.DAY_EXTRAS[rd.date] = savedExtras;
  check('P2: extras fuera de orden en DAY_EXTRAS se insertan en orden de aparición en el día',
    orderedHTML.indexOf('Extra del principio') > -1 && orderedHTML.indexOf('Extra del final') > -1 &&
    orderedHTML.indexOf('Extra del principio') < orderedHTML.indexOf('Extra del final'));
}

// Realidad: mismo criterio, siempre a nivel de un día concreto.
api.setItinMode('ours');
const realHasStops = api.state.days[rutaDayIdx].stops.length > 0;
api.setMapDay(rutaDayIdx);
api.renderItinerary(); // 'ours' + mapDay>=0 fija curDay internamente (ver setItinMode/mapDayChips)
const realDayHTML = els['#dayPanel'].innerHTML;
check('P2 (Realidad): con paradas reales, los extras de ese día aparecen inlineados',
  !realHasStops || count(realDayHTML, 'class="opt-stop"') >= 1);

// Mapa: con un día concreto, cada extra dibuja además su rama punteada (una
// polilínea) hacia el pin, separado del punto real; en "Todos" no.
api.setItinMode('ruta');
api.setExtrasVisible(true);
api.setMapDay(-1);
const polyBeforeAll = Lstats.polyline;
api.renderMapDay();
check('P2 (mapa): en "Todos" el pin de extra va suelto, sin rama (comportamiento global)',
  Lstats.polyline === polyBeforeAll);
api.setMapDay(rutaDayIdx);
const polyBeforeDay = Lstats.polyline;
api.renderMapDay();
const giftMarkersDay = nExtras;
check('P2 (mapa): con un día concreto, cada extra dibuja su rama punteada hacia el pin',
  giftMarkersDay > 0 && (Lstats.polyline - polyBeforeDay) >= giftMarkersDay);
api.setMapDay(-1);
api.setExtrasVisible(false);
api.setItinMode('ours');

// ============ Prioridad 3 · agenda: hora del hueco + aviso de reserva ============
const dayWithGap = api.state.days.find(d => !d.flight && d.stops && d.stops.length >= 2);
check('P3: fixture trae al menos un día con 2+ paradas (hueco de transporte real)', !!dayWithGap);
if(dayWithGap){
  const win = api.realGapWindow(dayWithGap, 0);
  check('P3: realGapWindow deriva un hueco horario válido del propio día', !!(win && /^\d\d:\d\d$/.test(win.start) && /^\d\d:\d\d$/.test(win.end)));
  const a = api.placeById(dayWithGap.stops[0].pid), b = api.placeById(dayWithGap.stops[1].pid);
  const plainT = { sel: 0, opts: [{ id: 'x1', m: 'walk', d: 10 }] };
  const dayIdx = api.state.days.indexOf(dayWithGap);
  const plainHTML = api.transferHTML(plainT, a, b, dayIdx, 0, '');
  check('P3: el bloque de transporte muestra la hora del hueco (HH:MM → HH:MM)', /class="t-time u-tabular">\d\d:\d\d → \d\d:\d\d</.test(plainHTML));
  check('P3: sin nada que reservar, no se muestra el aviso de reserva', !plainHTML.includes('🎫 reserva'));
  const reserveT = { sel: 0, opts: [{ id: 'x2', m: 'shinkansen', d: 30, n: 'Reservad asiento con antelación' }] };
  const reserveHTML = api.transferHTML(reserveT, a, b, dayIdx, 0, '');
  check('P3: una nota que dice "reservad" activa el aviso 🎫 reserva', reserveHTML.includes('🎫 reserva'));
}

// ============ Prioridad 4 · export .ics de Realidad (misma fuente que Realidad) ============
const ics1 = api.realidadICS();
check('P4: el .ics de Realidad es un VCALENDAR válido', ics1.startsWith('BEGIN:VCALENDAR') && ics1.trim().endsWith('END:VCALENDAR'));
check('P4: incluye eventos con UID "real-" (distintos de los de la Ruta)', ics1.includes('@japon2027') && /UID:real-/.test(ics1));
const flightDay = api.state.days.find(d => d.flight);
check('P4: los días de vuelo generan su VEVENT desde FLIGHTS', !!flightDay && ics1.includes('UID:real-' + flightDay.date));
// Editar Realidad (renombrar una nota) cambia el .ics: sigue el plan REAL, no una referencia fija.
if(dayWithGap){
  const before = dayWithGap.stops[0].note;
  dayWithGap.stops[0].note = '__marca_de_test_único__';
  const ics2 = api.realidadICS();
  check('P4: una edición en Realidad se refleja en el export (misma fuente, sin duplicar datos)',
    ics2.includes('__marca_de_test_único__') && !ics1.includes('__marca_de_test_único__'));
  dayWithGap.stops[0].note = before;
}

// ============ Prioridad 5 · indicador de intensidad del día ============
// Calibrado contra RUTA_DAYS real: 17-abr (Kioto Este, 10 paradas ~9h45 a
// pie) es el día más intenso; 26-abr (Fuji, 3 paradas, muy tranquilo) el más
// relajado. Si RUTA_DAYS cambia de verdad, este test debe revisarse aposta.
const busiest = api.RUTA_DAYS.find(d => d.date === '2027-04-17');
const chillest = api.RUTA_DAYS.find(d => d.date === '2027-04-26');
const busyIntensity = api.rutaDayIntensity(busiest);
const chillIntensity = api.rutaDayIntensity(chillest);
check('P5: el día más cargado de la Ruta (17-abr) sale "Muy intenso"', busyIntensity && busyIntensity.label === 'Muy intenso');
check('P5: el día más tranquilo de la Ruta (26-abr) sale "Relajado"', chillIntensity && chillIntensity.label === 'Relajado');
check('P5: un día de vuelos no tiene intensidad (no hay nada que medir)',
  api.rutaDayIntensity(api.RUTA_DAYS.find(d => d.flight)) === null);

const dayEmpty = api.state.days.find(d => !d.flight && (!d.stops || !d.stops.length));
check('P5 (Realidad): un día sin paradas no tiene intensidad', !dayEmpty || api.realDayIntensity(dayEmpty) === null);
if(dayWithGap) check('P5 (Realidad): un día con paradas SÍ trae intensidad (emoji + etiqueta)',
  !!api.realDayIntensity(dayWithGap) && /^[🟢🟡🟠🔴]$/u.test(api.realDayIntensity(dayWithGap).emoji));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
})();
