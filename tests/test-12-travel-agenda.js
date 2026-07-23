// Verificación de las prioridades de la fase de viaje (post-planificación):
// 1) "Líneas Dani" solo visible en el itinerario de Dani · 2) extras "si sobra
// tiempo" inlineados dentro del recorrido de un día concreto (panel + mapa) ·
// 3) agenda de Realidad (hora del hueco + aviso de reserva + origen/destino +
// "(estimado)") y Booking Timeline en Guía ("qué toca reservar a continuación") ·
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
  ;return { startApp,
    state, RUTA_DAYS, DAY_EXTRAS,
    setItinMode, getItinMode: () => itinMode, renderItinerary,
    setMapDay: v => { mapDay = v; }, getMapDay: () => mapDay, renderMapDay, getMapLayers: () => mapLayers,
    setExtrasVisible: v => { extrasVisible = v; },
    getMap: () => map, initMapView, showTab,
    transferHTML, realGapWindow, stopWindow, placeById, canonicalPid,
    realDayTimelineEntries, realidadICS, intensityScore, intensityFromScore,
    rutaDayIntensity, realDayIntensity,
    BOOKINGS, NIGHTS, bookingWindow, bookingRows, bookingTimelineHTML, bookingTeaserHTML,
    renderGuia, renderInicio, nowStatus, timeToMin,
    _reseedDays: () => { // fixture: días con paradas (el plan real nace vacío, 12.49)
      const fresh = buildSeedState();
      state.days.forEach((d, i) => { const f = fresh.days[i]; d.stops = f.stops; d.trans = f.trans; d.pre = f.pre; d.post = f.post; }); },
  };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
api.startApp(); // Prioridad 4: arranque real gateado tras auth; los tests lo disparan a mano.

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

  // Agenda 2.0: origen → destino visible como texto, y aviso "(estimado)"
  // cuando el hueco es el colchón de pre/post o el medio es un paseo
  // auto-inferido sin confirmar (opt.auto), no cuando el usuario ya lo fijó.
  check('P2.0: el bloque nombra origen → destino como texto (no solo en el enlace)',
    plainHTML.includes(`class="t-route">${a.name} <span aria-hidden="true">→</span> ${b.name}`));
  const preWin = api.realGapWindow(dayWithGap, 'pre');
  check('P2.0: el colchón antes de la primera parada se marca "estimado"', !!preWin && preWin.estimated === true);
  check('P2.0: el hueco entre dos paradas reales NO se marca "estimado" (las horas son del usuario)',
    !!win && win.estimated === false);
  const autoT = { sel: 0, opts: [{ id: 'x3', m: 'walk', d: 12, auto: true }] };
  const autoHTML = api.transferHTML(autoT, a, b, dayIdx, 0, '');
  check('P2.0: una opción auto-inferida (opt.auto) sin confirmar se marca "(estimado)"',
    autoHTML.includes('(estimado)'));
  check('P2.0: una opción confirmada por el usuario NO se marca "(estimado)"', !plainHTML.includes('(estimado)'));
}

// ============ Prioridad 4 · export .ics de Realidad (misma fuente que Realidad) ============
const ics1 = api.realidadICS();
check('P4: el .ics de Realidad es un VCALENDAR válido', ics1.startsWith('BEGIN:VCALENDAR') && ics1.trim().endsWith('END:VCALENDAR'));
check('P4: incluye eventos con UID "real-" (distintos de los de la Ruta)', ics1.includes('@japon2027') && /UID:real-/.test(ics1));
const flightDay = api.state.days.find(d => d.flight);
check('P4: los días de vuelo generan su VEVENT desde FLIGHTS', !!flightDay && ics1.includes('UID:real-' + flightDay.date));
if(dayWithGap){
  const entries = api.realDayTimelineEntries(dayWithGap);
  const transit = entries.find(e => e.kind === 'transit' && e.from && e.to);
  check('P2.0: las entradas de transporte del .ics llevan origen/destino y el flag "estimated"',
    !!transit && typeof transit.estimated === 'boolean');
}
// Editar Realidad (renombrar una nota) cambia el .ics: sigue el plan REAL, no una referencia fija.
if(dayWithGap){
  const before = dayWithGap.stops[0].note;
  dayWithGap.stops[0].note = '__marca_de_test_único__';
  const ics2 = api.realidadICS();
  check('P4: una edición en Realidad se refleja en el export (misma fuente, sin duplicar datos)',
    ics2.includes('__marca_de_test_único__') && !ics1.includes('__marca_de_test_único__'));
  dayWithGap.stops[0].note = before;
}

// ============ Prioridad 3 (Guía) · Booking Timeline ============
// "¿Qué toca reservar A CONTINUACIÓN?" — bookingWindow es puro (recibe `today`
// como parámetro), así que se puede probar con cualquier fecha sin depender
// del reloj real.
const longBefore = new Date('2020-01-01T00:00:00'); // muy anterior a cualquier venta
const withWindow = api.BOOKINGS.find(b => b.opensDaysBefore != null);
check('P3 (booking): con "hoy" muy anterior, una venta con ventana conocida aún NO ha abierto',
  !!withWindow && api.bookingWindow(withWindow, longBefore).status === 'future');
const noWindow = api.BOOKINGS.find(b => b.opensDaysBefore == null);
check('P3 (booking): una reserva sin ventana conocida es SIEMPRE "reservable ya" (no hay venta que esperar)',
  !!noWindow && api.bookingWindow(noWindow, longBefore).status === 'now');
const longAfter = new Date('2027-05-01T00:00:00'); // después de todo el viaje
check('P3 (booking): con "hoy" muy posterior, esa misma venta ya "reservable ya" (la ventana pasó)',
  !!withWindow && api.bookingWindow(withWindow, longAfter).status === 'now');

const rows = api.bookingRows(longBefore);
const pendingNights = api.NIGHTS.filter(n => n[2] === 'res' || n[2] === 'amp').length;
check('P3 (booking): bookingRows combina BOOKINGS + noches por reservar de NIGHTS (sin duplicar la lista)',
  rows.length === api.BOOKINGS.length + pendingNights);
check('P3 (booking): las noches por reservar son siempre "reservable ya" (disponibilidad, no venta de entradas)',
  rows.filter(r => r.isNight).length === pendingNights && rows.filter(r => r.isNight).every(r => r.win.status === 'now'));

const timelineHTML = api.bookingTimelineHTML(longBefore);
check('P3 (booking): la línea de tiempo lista lo accionable ya y lo que aún no ha abierto',
  timelineHTML.includes('Puedes reservar YA') && timelineHTML.includes('Aún no ha abierto la venta'));
const shibuya = api.BOOKINGS.find(b => b.name === 'Shibuya Sky');
const shibuyaUrl = (api.placeById(shibuya.pid) || {}).web;
check('P3 (booking): una reserva con ficha de catálogo (pid) enlaza a SU web real (sin duplicar la URL)',
  !!shibuyaUrl && timelineHTML.includes(shibuyaUrl));

const teaser = api.bookingTeaserHTML(longBefore);
check('P3 (booking): el teaser del Inicio no está vacío (siempre hay algo accionable: hoteles por reservar)',
  teaser.length > 0);

// Integración: renderGuia/renderInicio rellenan de verdad sus contenedores.
api.renderGuia();
check('P3 (booking): renderGuia rellena #bookingTimeline', els['#bookingTimeline'].innerHTML.includes('Puedes reservar YA'));
api.renderInicio();
check('P3 (booking): renderInicio rellena el teaser #bookingTeaser', els['#bookingTeaser'].innerHTML.length > 0);

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

// ============ Prioridad 6 · arquitectura para el futuro modo en vivo (SIN UI) ============
// nowStatus() es pura: mismas entradas que ya alimentan el render editable y
// el .ics (realDayTimelineEntries), más la hora en minutos — nada nuevo que
// mantener en el modelo persistido.
if(dayWithGap){
  const entries = api.realDayTimelineEntries(dayWithGap);
  const firstAct = entries.find(e => e.kind === 'activity');
  check('P6: las entradas de actividad llevan pid (para abrir su ficha desde el modo en vivo)',
    !!firstAct && !!firstAct.pid);
  const midOfFirst = api.timeToMin(firstAct.start) + 1; // 1 min dentro de la primera actividad
  const st = api.nowStatus(entries, midOfFirst);
  check('P6: nowStatus reconoce la entrada EN CURSO cuando "ahora" cae dentro de su ventana',
    !!st.current && st.current.pid === firstAct.pid && st.current.remainingMin > 0);
  const beforeDay = api.timeToMin(entries[0].start) - 60;
  const stBefore = api.nowStatus(entries, beforeDay);
  check('P6: nowStatus no inventa una entrada EN CURSO antes de que empiece el día',
    stBefore.current === null && !!stBefore.next && stBefore.next.startsInMin > 0);
  const afterDay = api.timeToMin(entries[entries.length - 1].end) + 60;
  const stAfter = api.nowStatus(entries, afterDay);
  check('P6: nowStatus no inventa una entrada EN CURSO ni "próxima" tras acabar el día',
    stAfter.current === null && stAfter.next === null);
  // Entradas sintéticas (mismo shape que realDayTimelineEntries) para probar
  // "próxima reserva" sin depender de que el día real de la fixture tenga una.
  const synthetic = [
    {kind: 'activity', start: '09:00', end: '10:00', pid: 'x', name: 'Parada A'},
    {kind: 'transit', start: '10:00', end: '10:20', reservation: false},
    {kind: 'activity', start: '10:20', end: '11:00', pid: 'y', name: 'Parada B'},
    {kind: 'transit', start: '11:00', end: '12:00', reservation: true},
    {kind: 'activity', start: '12:00', end: '13:00', pid: 'z', name: 'Parada C'},
  ];
  const stReserve = api.nowStatus(synthetic, api.timeToMin('09:30'));
  check('P6: nowStatus encuentra la PRÓXIMA reserva pendiente por delante (ignora el tramo sin reserva)',
    !!stReserve.upcomingReservation && stReserve.upcomingReservation.reservation === true &&
    stReserve.upcomingReservation.startsInMin === api.timeToMin('11:00') - api.timeToMin('09:30'));
  const stPastReserve = api.nowStatus(synthetic, api.timeToMin('11:30'));
  check('P6: pasada la reserva, ya no aparece como "próxima" (no queda ninguna reserva por delante)',
    stPastReserve.upcomingReservation === null);
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
})();
