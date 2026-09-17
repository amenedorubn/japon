#!/usr/bin/env node
/* ================================================================
   JAPÓN 2027 · Importador de migración v2 → v3 (Fase 2, V3-DESIGN.md §G)

   Uso:
     node tools/v3-migrate-import.js <live.json> [v3-actual.json]

   <live.json>      volcado de solo lectura de proyectos/viaje-japon
                     (curl .../proyectos/viaje-japon.json > live.json,
                     el mismo fichero que ya usa tests/run-all.js live.json).
   [v3-actual.json] volcado local de lo que YA hay en proyectos/viaje-japon-v3
                     (opcional: si se omite, se trata como nodo vacío = sembrar).

   Salida (SIEMPRE a ficheros locales en import/, NUNCA un fb.set en vivo —
   ver nota de alcance más abajo):
     import/v3-migrated-preview.json   el array de RouteItem fusionado
     import/v3-duplicates-report.json  candidatos a duplicado (nunca fusionados)

   NUNCA escribe en proyectos/viaje-japon (política v2-only, PROJECT.md §5):
   este script solo LEE ese volcado. Tampoco escribe en Firebase de v3
   todavía — las reglas de proyectos/viaje-japon-v3 no están desplegadas
   (deny por defecto), y el patrón de este proyecto es que el `fb.set` real
   lo hace la app en el navegador con sesión autenticada (como
   `ensureHotelFixes()` en v2), no un script de dev-time. Cuando exista el
   runtime de v3 con auth (Fase 6), su bootstrap puede leer
   import/v3-migrated-preview.json y sembrar/fusionar de verdad.

   Precedencia de `estado` por id (Decisión 2026-09-16, punto A): un mismo
   sitio nunca sale dos veces. confirmado (hoteles/vuelos) > propuesta
   (aparece en RUTA_DAYS) > idea (resto del catálogo, incluida procedencia
   'ours'). Se consume el id según se va asignando el estado más alto.
================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const { mergeV3State } = require(path.join(__dirname, '..', 'v3', 'lib', 'merge.js'));
const { zonedTimeToUtc, utcToZonedParts } = require(path.join(__dirname, '..', 'v3', 'lib', 'timezone.js'));
const { normalizeNameForTwins, groupCanonical, residualDuplicates, applyManualMerges, filterRejected } = require(path.join(__dirname, '..', 'v3', 'lib', 'twins.js'));
const { RESERVATION_RULES, attachReservationRules } = require(path.join(__dirname, '..', 'v3', 'lib', 'reservation-rules.js'));
const { buildTrayectoItems } = require(path.join(__dirname, '..', 'v3', 'lib', 'trayectos.js'));

const liveJsonPath = process.argv[2];
const v3JsonPath = process.argv[3];
if (!liveJsonPath) {
  console.error('Uso: node tools/v3-migrate-import.js <live.json> [v3-actual.json]');
  process.exit(1);
}

/* --------------------------------------------------------------
   1) Extrae del index.html real las constantes horneadas que hacen falta
   (RUTA_DAYS, FLIGHTS, canonicalPid, provenanceOf, isBookedHotel) con el
   MISMO mecanismo que usa tests/run-all.js: el bloque <script> único se
   evalúa con stubs mínimos de DOM/Leaflet y se leen las funciones/consts
   puras que necesitamos. No se reimplementan esas reglas aparte (evita el
   duplicado de helpers que prohíbe PROJECT.md §D3): la fuente sigue siendo
   index.html.
-------------------------------------------------------------- */
function loadV2Baked(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('No se encontró el bloque <script> principal en index.html');
  const appJs = m[1];

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
    ;return { RUTA_DAYS, FLIGHTS, TRANSPORT, canonicalPid, provenanceOf, isBookedHotel, hotelPlaceholderBase, TWIN_GROUPS,
      TIPS, PHRASES, PRICES, SKIPPED };`);

  return boot(documentStub, {}, localStorageStub, { hash: '', href: '' }, { pushState(){}, replaceState(){} },
    L, fetchStub, () => 0, () => true);
}

const AIRPORT_ZONE = { MAD: 'Europe/Madrid', HEL: 'Europe/Helsinki', NRT: 'Asia/Tokyo' };
const iataOf = s => (String(s).match(/\(([A-Z]{3})\)/) || [])[1] || null;

/* Un billete/reserva Finnair cubre una conexión entera (a través de la
   página oficial de check-in, confirmado 2026-09-16, ver V3-DESIGN.md §E):
   el check-in se abre 36h antes de la salida del PRIMER tramo de ESE
   billete, y cubre también el tramo de conexión — nunca una ventana propia
   por tramo. Con FLIGHTS de 4 tramos (ida 2 tramos, vuelta 2 tramos), son
   DOS billetes: ida (1+2, ancla en 1) y vuelta (3+4, ancla en 3). Decisión
   2026-09-16, punto 1: la acción de check-in aparece en LOS 4 vuelos (no
   solo en el de vuelta), pero los tramos de un mismo billete comparten el
   mismo `abreEn` (el ancla), no cada uno el suyo. */
const PNR_GROUPS = [
  { legs: [1, 2], anchorLeg: 1 },
  { legs: [3, 4], anchorLeg: 3 },
];

function buildCheckinAccionesByLeg(FLIGHTS){
  const byId = new Map(FLIGHTS.map(f => [f.id, f]));
  const out = new Map();
  for (const group of PNR_GROUPS) {
    const anchor = byId.get(group.anchorLeg);
    const zone = AIRPORT_ZONE[iataOf(anchor.from)] || 'Europe/Madrid';
    const [hh, mm] = anchor.dep.split(':').map(Number);
    const [y, mo, d] = anchor.date.split('-').map(Number);
    const anchorDepartureUtc = zonedTimeToUtc(y, mo, d, hh, mm, zone);
    const opensUtc = anchorDepartureUtc - 36 * 3600 * 1000;
    const parts = utcToZonedParts(opensUtc, zone);
    const pad2 = n => String(n).padStart(2, '0');
    const abreEn = {
      fecha: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`,
      hora: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
      zona: zone
    };
    const compartidoCon = group.legs.filter(id => id !== group.anchorLeg);
    for (const legId of group.legs) {
      out.set(legId, {
        id: 'checkin', necesaria: true, hecho: false,
        abreEn, horaConfirmada: true,
        reglaApertura: '36h antes de la salida del primer tramo de esta reserva (check-in por billete, no por tramo)',
        fuente: 'https://www.finnair.com/en/check-in-for-finnair-flights',
        verificadoEl: '2026-09-16',
        recomendacion: legId === group.anchorLeg ? null :
          `Comparte ventana con el tramo ${group.anchorLeg} (mismo billete): no se abre aparte.`,
        compartidoCon
      });
    }
  }
  return out;
}

/* 'HH:MM' + minutos -> 'HH:MM' (mismo día de calendario; ninguna parada de
   RUTA_DAYS cruza medianoche). Aritmética de reloj, sin zona horaria: es
   la MISMA fecha, solo se suman minutos a la hora de pared. */
function addMinutosHHMM(horaHHMM, minutos){
  const [h, m] = horaHHMM.split(':').map(Number);
  const total = h * 60 + m + minutos;
  const pad2 = n => String(n).padStart(2, '0');
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

/* Franja de check-in REAL de las 9 reservas confirmadas + llegada estimada al
   hotel el día de check-in, 2026-09-16 -- sustituye a las horas "estándar del
   hotel" buscadas por web en el commit 48c8319 (ver HANDOFF-V3.md §3). Dos
   cosas distintas por hotel, que la UI nunca debe mezclar:
   - franjaDesde/franjaHasta/franjaConfirmada: la ventana de ESTA reserva.
     `franjaConfirmada:false` en las 3 que el usuario aún no ha verificado al
     100% con el hotel (Louis House, Kyoto Guesthouse, Twilight Osaka).
   - llegadaHora/llegadaTexto: ESTIMACIÓN del asistente de cuándo se llega de
     verdad al hotel ese día, dado el resto del itinerario del día -- nunca un
     dato de la reserva. Se muestra SIEMPRE con "≈" en la UI (regla 2026-09-16:
     ninguna hora calculada por el asistente se pinta como dato cierto).
   `huecoAntesCheckin` solo existe cuando se llega a la CIUDAD antes de que
   abra la franja (hoy, solo Kioto 16-abr: se llega sobre las 14:20 pero el
   check-in no abre hasta las 16:00) -- se pinta como bloque aparte, sin
   inventar si el hotel guarda maletas o no (eso lo confirma el usuario, ver
   la acción 'preguntarMaletas' más abajo).
   avisoLlegada (ver debeAvisarLlegada): franja sin confirmar, o llegada antes
   de apertura, o margen hasta el cierre < 1h. Nikkō (12-abr) NO lo lleva a
   propósito -- franja confirmada y margen amplio (~2h15). */
const HOTEL_CHECKIN = {
  id_louis_otsuka_nishi: { franjaDesde: '15:00', franjaHasta: '00:00', franjaConfirmada: false,
    llegadaHora: '16:00', llegadaTexto: '≈ 16:00 (Narita → Ōtsuka, ~90 min)' },
  id_sunshine_kinugawa: { franjaDesde: '15:00', franjaHasta: '18:00', franjaConfirmada: true,
    llegadaHora: '15:45', llegadaTexto: '≈ 15:45–16:00' },
  id_inova_kanazawa: { franjaDesde: '15:00', franjaHasta: '21:00', franjaConfirmada: true,
    llegadaHora: '15:25', llegadaTexto: '≈ 15:25' },
  id_kuwataniya: { franjaDesde: '14:00', franjaHasta: '22:00', franjaConfirmada: true,
    llegadaHora: '14:50', llegadaTexto: '≈ 14:50–15:00 (llegada del tren)' },
  id_kyoto_guesthouse: { franjaDesde: '16:00', franjaHasta: '19:00', franjaConfirmada: false,
    llegadaHora: '16:00', llegadaTexto: '≈ 16:00',
    huecoAntesCheckin: { desde: '14:20', hasta: '16:00' } },
  id_vessel_hiroshima: { franjaDesde: '14:00', franjaHasta: '23:00', franjaConfirmada: true,
    llegadaHora: '18:30', llegadaTexto: '≈ 18:30' },
  id_nakasu_inn: { franjaDesde: '15:00', franjaHasta: '00:00', franjaConfirmada: true,
    llegadaHora: '19:00', llegadaTexto: '≈ 19:00' },
  id_twilight_osaka: { franjaDesde: '15:00', franjaHasta: '00:00', franjaConfirmada: false,
    llegadaHora: '18:20', llegadaTexto: '≈ 18:20' },
  apa_asakusabashi: { franjaDesde: '15:00', franjaHasta: '00:00', franjaConfirmada: true,
    llegadaHora: '21:00', llegadaTexto: '≈ 21:00' }
};

function minutosDesdeMedianoche(hhmm){
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
/* '00:00' como cierre de franja significa "sin límite práctico esa noche"
   (medianoche o más tarde), nunca "cierra a las 0h ya pasadas" -- se trata
   como 24:00 para que el margen salga grande, no negativo. */
function margenCierreMinutos(entry){
  const cierre = entry.franjaHasta === '00:00' ? 24 * 60 : minutosDesdeMedianoche(entry.franjaHasta);
  return cierre - minutosDesdeMedianoche(entry.llegadaHora);
}
function debeAvisarLlegada(entry){
  return !entry.franjaConfirmada || !!entry.huecoAntesCheckin || margenCierreMinutos(entry) < 60;
}

function transform(livePlaces, v2Baked){
  const { RUTA_DAYS, FLIGHTS, canonicalPid, provenanceOf, isBookedHotel } = v2Baked;
  const byId = new Map(livePlaces.filter(p => p && p.id).map(p => [p.id, p]));
  const consumed = new Set(); // ids ya asignados a un estado (precedencia)
  const avisos = []; // decisiones de alcance / cosas raras, para el resumen — no errores
  const items = [];

  // 1) CONFIRMADO — hoteles reservados (más alto en la precedencia).
  for (const p of livePlaces.filter(isBookedHotel)) {
    const checkin = HOTEL_CHECKIN[p.id];
    // OJO: `fin` sigue siendo el checkOut de la ESTANCIA (fecha pelada, sin
    // hora) -- bases.js lo usa para el rango [checkIn, checkOut) de noches.
    // `inicio` gana la hora de LLEGADA ESTIMADA (no la de apertura de franja):
    // es lo que ordenarDia (v3/lib/bases.js) usa para intercalar el bloque de
    // check-in en su sitio cronológico real del día -- bug real corregido
    // 2026-09-16 (19-abr salía a las 14:00, antes de Himeji, que está de
    // camino desde Kioto). fechaDe() de bases.js recorta con slice(0,10), así
    // que seguir derivando las noches a partir de aquí no se rompe.
    items.push({
      id: p.id, nombre: p.name || p.id, tipo: 'alojamiento',
      procedencia: provenanceOf(p), estado: 'confirmado',
      noche: null, // una reserva de hotel cubre varias noches; el UI de Fase 4 lo deriva por rango
      fechaHora: {
        inicio: p.checkIn ? (checkin ? `${p.checkIn}T${checkin.llegadaHora}` : p.checkIn) : null,
        fin: p.checkOut || null,
        zona: 'Asia/Tokyo'
      },
      ubicacion: (p.lat != null && p.lng != null) ? { lat: p.lat, lng: p.lng } : null,
      // Única reserva 2026-09-16 que necesita una acción propia: el hueco de
      // Kioto antes de que abra el check-in (ver HOTEL_CHECKIN arriba). Nivel
      // 4 de Pendientes a propósito (sin abreEn/reglaApertura de venta): no es
      // una reserva con ventana, es una pregunta al hotel "cuando puedas".
      // `recomendacion`, NO `reglaApertura`: esta última hace que
      // precisionLevel() (v3/lib/model.js) lea la acción como nivel 3
      // "vigilar apertura" (hay CUALQUIER reglaApertura => nivel 3). Es
      // nivel 4 a propósito -- sin abreEn ni reglaApertura, "reservar ya, sin
      // fecha" es en realidad "preguntar cuando puedas", no hay nada que
      // vigilar ni ninguna apertura que esperar.
      acciones: (checkin && checkin.huecoAntesCheckin) ? [{
        id: 'preguntarMaletas', necesaria: true, hecho: false, dondeReservar: null, abreEn: null,
        reglaApertura: null,
        recomendacion: `Llegáis a la ciudad sobre las ${checkin.huecoAntesCheckin.desde} y el check-in no abre hasta las ${checkin.huecoAntesCheckin.hasta}: preguntar al hotel si guardan las maletas antes de esa hora.`,
        horaConfirmada: false, fuente: null, verificadoEl: '2026-09-16'
      }] : [],
      // Franja real de la reserva (para la UI), separada de la llegada
      // estimada de arriba -- nunca se pisan entre sí.
      franjaCheckIn: checkin ? { desde: checkin.franjaDesde, hasta: checkin.franjaHasta, confirmada: checkin.franjaConfirmada } : null,
      llegadaEstimadaTexto: checkin ? checkin.llegadaTexto : null,
      avisoLlegada: checkin ? debeAvisarLlegada(checkin) : false,
      huecoAntesCheckin: (checkin && checkin.huecoAntesCheckin) || null,
      // Fase 5b (auditoría de paridad, 2026-09-16): campos reales de la
      // reserva que v3 venía descartando -- MISMOS nombres que en
      // state.places (p.notes, p.price...), nunca renombrados, para que el
      // test de paridad (tests/test-v3-field-parity.js) los compare 1:1 sin
      // ambigüedad. `price`/`bookingRef`/`address`/`hotelPhone` son datos
      // privados de ESTA reserva: viven aquí (import/v3-migrated-preview.json,
      // gitignored) y en Firebase en la Fase 6, NUNCA en un fichero
      // versionado -- verificado con git grep antes de cada commit.
      notes: p.notes || null, web: p.web || null, price: p.price || null,
      hotelArea: p.hotelArea || null, address: p.address || null,
      hotelPhone: p.hotelPhone || null, bookingRef: p.bookingRef || null,
      region: p.region || null
    });
    consumed.add(p.id);
  }

  // 2) CONFIRMADO — vuelos Finnair, con su check-in como acción (punto C).
  const checkinByLeg = buildCheckinAccionesByLeg(FLIGHTS);
  for (const f of FLIGHTS) {
    const zone = AIRPORT_ZONE[iataOf(f.from)] || 'Europe/Madrid';
    items.push({
      id: 'vuelo-' + f.id, nombre: `${f.from} → ${f.to}`, tipo: 'vuelo',
      procedencia: 'ours', estado: 'confirmado',
      noche: null,
      fechaHora: { inicio: `${f.date}T${f.dep}`, fin: null, zona: zone },
      ubicacion: null,
      acciones: [checkinByLeg.get(f.id)],
      // Fase 5b: resto de FLIGHTS (index.html raíz) que v3 no copiaba --
      // mismos nombres que el array fuente.
      flight: f.flight || null, arr: f.arr || null, airline: f.airline || null,
      terminal: f.terminal || null, note: f.note || null
    });
  }

  // 3) PROPUESTA — paradas de RUTA_DAYS (solo si el id no está ya confirmado).
  //    Alcance de esta fase (avisado, no resuelto en silencio): si un mismo
  //    pid aparece en más de un día de RUTA_DAYS, se queda con la fecha/hora
  //    de su PRIMERA aparición; las repeticiones se listan en `avisos` para
  //    que el usuario decida si hace falta modelar visitas múltiples cuando
  //    se construya la UI de Ruta (Fase 4).
  for (const day of RUTA_DAYS) {
    for (const stop of (day.stops || [])) {
      const pid = canonicalPid(stop.pid);
      if (consumed.has(pid)) {
        if (items.some(it => it.id === pid)) avisos.push(`pid repetido en RUTA_DAYS (se queda la 1ª aparición): ${pid} (también el ${day.date})`);
        continue;
      }
      const place = byId.get(pid);
      if (!place) { avisos.push(`pid de RUTA_DAYS sin ficha en el catálogo vivo: ${pid} (día ${day.date})`); continue; }
      // Fase 4 (Bloque 3): la duración real de RUTA_DAYS (`S(pid,time,dur,
      // note)`) se descartaba; la Ruta por días la necesita para la agenda.
      // `fin` solo se calcula cuando hay `time` Y `dur` reales — nunca se
      // inventa un final para una parada que no trajera duración.
      // Fase 5b, punto 4: si RUTA_DAYS no trae `dur` para esta parada pero el
      // catálogo SÍ tiene una duración típica de visita (`place.dur`), se usa
      // como respaldo -- marcada con `duracionOrientativa:true` para que la
      // UI/el conteo la distingan de una duración real de la Ruta (nunca se
      // presenta como dato cierto).
      const finReal = (stop.time && stop.dur != null) ? `${day.date}T${addMinutosHHMM(stop.time, stop.dur)}` : null;
      const duracionOrientativa = !finReal && !!stop.time && place.dur != null;
      const fin = finReal || (duracionOrientativa ? `${day.date}T${addMinutosHHMM(stop.time, place.dur)}` : null);
      items.push({
        id: pid, nombre: place.name || pid, tipo: 'lugar',
        procedencia: provenanceOf(place), estado: 'propuesta',
        noche: 'noche-' + day.date,
        fechaHora: { inicio: stop.time ? `${day.date}T${stop.time}` : day.date, fin, zona: 'Asia/Tokyo' },
        ubicacion: (place.lat != null && place.lng != null) ? { lat: place.lat, lng: place.lng } : null,
        acciones: [],
        nota: stop.note || null,
        duracionOrientativa: duracionOrientativa,
        // Fase 5b (auditoría de paridad): resto de campos ricos del catálogo
        // que v3 no copiaba -- mismos nombres que en state.places.
        categoria: place.category || null,
        notes: place.notes || null, web: place.web || null, video: place.video || null,
        tip: place.tip || null, hours: place.hours || null, price: place.price || null,
        yen: place.yen != null ? place.yen : null, dur: place.dur != null ? place.dur : null,
        region: place.region || null
      });
      consumed.add(pid);
    }
  }

  // 4) IDEA — resto del catálogo (incluida procedencia 'ours' que no llegó a
  //    la Ruta: Itinerario.docx es una lista de deseos, no todo entra).
  for (const p of livePlaces) {
    if (!p || !p.id || consumed.has(p.id)) continue;
    if (/^airport_/.test(p.id)) continue; // no son "sitios", son nodos de aeropuerto del mapa
    items.push({
      id: p.id, nombre: p.name || p.id, tipo: 'lugar',
      procedencia: provenanceOf(p), estado: 'idea',
      noche: null, fechaHora: null,
      ubicacion: (p.lat != null && p.lng != null) ? { lat: p.lat, lng: p.lng } : null,
      acciones: [],
      // Fase 5 (Más): filtro por categoría del catálogo -- campo real de
      // state.places (verificado contra live.json: TODOS los 476 lugares
      // reales usan `category`, ninguno `cat`, aunque el catálogo fuente en
      // index.html use `cat` como parámetro posicional de P(); se normaliza
      // en algún punto de la app antes de llegar a Firebase). `ciudad` se
      // añade más abajo, tras derivar la ciudad de los 9 hoteles.
      categoria: p.category || null,
      ciudad: null,
      // Fase 5b (auditoría de paridad, 2026-09-16): resto de campos ricos que
      // el catálogo ya trae en state.places (foldCurated de v2.1 los deja ahí
      // antes de exportar) y v3 venía descartando -- mismos nombres, nunca
      // renombrados, para que tests/test-v3-field-parity.js los compare 1:1.
      // hotelArea/address/hotelPhone/bookingRef también aquí (no solo en el
      // bloque de hoteles CONFIRMADOS de arriba): los hoteles del viaje de
      // Dani (categoría alojamiento, pero estado 'idea' -- nunca confirmados
      // en NUESTRA app, ver tools/dani-data.json) también los traen.
      notes: p.notes || null, web: p.web || null, video: p.video || null,
      tip: p.tip || null, hours: p.hours || null, price: p.price || null,
      yen: p.yen != null ? p.yen : null, dur: p.dur != null ? p.dur : null,
      region: p.region || null,
      hotelArea: p.hotelArea || null, address: p.address || null,
      hotelPhone: p.hotelPhone || null, bookingRef: p.bookingRef || null
    });
    consumed.add(p.id);
  }

  return { items, avisos };
}

/* --------------------------------------------------------------
   Orquestación
-------------------------------------------------------------- */
const liveRaw = JSON.parse(fs.readFileSync(liveJsonPath, 'utf8'));
// Dos formas válidas de volcado, según cómo se haya obtenido: el recorte del
// curl histórico (raíz = el propio nodo viaje-japon, con `state` directo) o
// una exportación completa desde la consola de Firebase (raíz = todo el
// árbol, con `proyectos.viaje-japon` anidado dentro). Se acepta cualquiera
// de las dos sin pedir un formato concreto.
const live = (liveRaw.proyectos && liveRaw.proyectos['viaje-japon']) || liveRaw;
const livePlaces = (live.state && live.state.places) || [];
const v2Baked = loadV2Baked();
const livePlacesById = new Map(livePlaces.filter(p => p && p.id).map(p => [p.id, p]));

const { items: importedPlaces, avisos: avisosPlaces } = transform(livePlaces, v2Baked);
// Fase 4: TRANSPORT de v2 entra como RouteItem tipo 'trayecto', estado
// 'propuesta' (Decisión 2026-09-16: ninguno tiene billete comprado todavía).
const { items: trayectoItems, avisos: avisosTrayectos } = buildTrayectoItems(v2Baked.TRANSPORT, 2027);
const imported = importedPlaces.concat(trayectoItems);
const avisos = avisosPlaces.concat(avisosTrayectos);

/* Nivel 2 (Decisión 2026-09-16, punto 2): quién queda fuera del lado de
   "coordenadas" del emparejamiento automático — hoteles confirmados y
   marcadores de centro de ciudad (categoría real 'zona' cuyo nombre ES
   literalmente el nombre de una ciudad del viaje, tomado de RUTA_DAYS para
   no mantener una lista aparte a mano). Los hoteles/vuelos (ids 'vuelo-*')
   no tienen ficha en livePlaces: nunca están excluidos porque nunca podrían
   emparejar por coordenadas contra nada (no comparten `ubicacion` real). */
const cityNames = new Set(
  (v2Baked.RUTA_DAYS || []).map(d => normalizeNameForTwins(d.city || '')).filter(Boolean)
);
function isExcludedFromCoordMatch(id){
  const raw = livePlacesById.get(id);
  if (!raw) return false;
  if (v2Baked.isBookedHotel(raw)) return true;
  if (v2Baked.hotelPlaceholderBase(raw)) return true;
  if (raw.category === 'zona' && cityNames.has(normalizeNameForTwins(raw.name || ''))) return true;
  return false;
}

// Nivel 1: agrupación automática (TWIN_GROUPS de v2 + nombre Y coordenadas).
const { items: nivel1, merges } = groupCanonical(imported, v2Baked.TWIN_GROUPS, { isExcludedFromCoordMatch });

// Nivel 3 (revisión manual, ya decidida): import/v3-manual-merges.json es
// versionado — la única fuente de fusiones que no salen de TWIN_GROUPS ni de
// la regla automática. Si no existe todavía (primera vez), se trata como
// "nada aprobado ni rechazado" y el importador solo informa.
const manualMergesPath = path.join(__dirname, '..', 'import', 'v3-manual-merges.json');
const manualMerges = fs.existsSync(manualMergesPath) ? JSON.parse(fs.readFileSync(manualMergesPath, 'utf8')) : { aprobadas: [], rechazadas: [] };
const { items: nivel3, aplicadas, omitidas } = applyManualMerges(nivel1, manualMerges.aprobadas);

// Reglas de reserva verificadas (V3-DESIGN.md §E) que enganchan una `accion`
// a un RouteItem YA existente (usj, toshogu, teamlab_kyoto) — sin esto se
// quedan con `acciones: []` y nunca aparecen en Pendientes, aunque tengan
// una fecha de apertura real y verificada (bug encontrado 2026-09-16: solo
// los vuelos tenían acciones, por eso Pendientes solo enseñaba check-ins).
const { items: canonical, noEncontrados: reglasNoEncontradas } = attachReservationRules(nivel3, RESERVATION_RULES);

/* Auditoría de reservas de comida (2026-09-17): de los 22 RouteItem de
   categoría 'comida' en la Ruta real, solo dos tienen fuente oficial que
   recomiende reservar (K36 The Bar & Rooftop, Kitan Hibiki -- ver la tabla
   que se le pasó al usuario en el chat, ninguna con regla de antelación
   publicada, así que quedan como acción de Pendientes nivel 4 "cuando
   puedas", enganchadas directamente a sus RouteItem ya existentes más abajo
   por id). La cena de cumpleaños del 19-abr en Hiroshima NUNCA tuvo un
   restaurante elegido en los datos reales (solo aparecía condicional en el
   CHECKLIST/BOOKINGS de v2.1, "si es teppanyaki de wagyū", sin pid) y
   Okonomimura (el plan que SÍ está en RUTA_DAYS ese día) se queda tal cual,
   sin tocar -- así que esto no es un RouteItem de un sitio real, es un
   recordatorio de decisión sin inventar dónde: ítem sintético, curado a
   mano, con acciones necesaria y NADA más (nunca se le pone ubicación ni se
   hace pasar por una parada real). */
canonical.push({
  id: 'decision-cena-cumple-19abr', nombre: 'Cena de cumpleaños (19-abr)',
  tipo: 'lugar', procedencia: 'ours', estado: 'propuesta',
  noche: 'noche-2027-04-19', fechaHora: { inicio: '2027-04-19', fin: null, zona: 'Asia/Tokyo' },
  ubicacion: null, categoria: 'comida', ciudad: 'Hiroshima',
  acciones: [{
    id: 'decidir', necesaria: true, hecho: false, dondeReservar: null, abreEn: null, reglaApertura: null,
    recomendacion: 'Sin restaurante elegido todavía (presupuesto bajo). El plan ya en la Ruta ese día es Okonomimura, que no necesita reserva -- esto es solo para decidir si os cambiáis a otra cosa.',
    horaConfirmada: false, fuente: null, verificadoEl: '2026-09-17'
  }]
});
// K36 (Kioto, 17-abr) y Kitan Hibiki (Osaka, 24-abr): recomendación de
// reserva verificada en sus webs oficiales, sin regla de antelación
// publicada por ninguna de las dos -- se engancha como acción nivel 4
// directamente al RouteItem ya existente (por id), NO como un nuevo ítem.
[
  { id: 'maria_k36_the_bar_rooftop_kioto_y_nara', recomendacion: 'Reserva telefónica recomendada (075-541-3636, franja 15:00-20:00). Web oficial no publica una ventana de antelación.', fuente: 'https://www.princehotels.co.jp/seiryu-kiyomizu/restaurant/k36/' },
  { id: 'kitan', recomendacion: 'Las hamburguesas de wagyū son de tirada limitada y se agotan antes de la cena: reservar por email (info@kitangroup.jp) o Tabelog. Web oficial no publica una ventana de antelación.', fuente: 'https://kitangroup.jp/' }
].forEach(({ id, recomendacion, fuente }) => {
  const it = canonical.find(x => x.id === id);
  if (!it) return; // si el dedup cambiara el id canónico, avisar en vez de fallar en silencio
  it.acciones = (it.acciones || []).concat([{
    id: 'reserva', necesaria: true, hecho: false, dondeReservar: null, abreEn: null, reglaApertura: null,
    recomendacion, horaConfirmada: false, fuente, verificadoEl: '2026-09-17'
  }]);
});

/* Fase 5b, punto 3: clasificación para el filtro de Reservas. Determinista a
   partir de datos que el ítem YA tiene -- nada a mano por id, nada
   inventado. `trenes`/`buses` reutiliza el MISMO criterio que ya usaba
   modoIcono() en v3/index.html (nota contiene "bus", si no tren) en vez de
   duplicar una lista aparte. `comidas` vs `experiencias`: por `categoria`
   del catálogo (`comida` -> comidas, cualquier otra -> experiencias) --
   solo se etiqueta un 'lugar' si de verdad tiene alguna acción necesaria
   (si no, nunca aparecerá en Reservas y la etiqueta no tendría a qué
   aplicarse). Ningún ítem quedó sin encajar en una categoría al probarlo
   contra los datos reales (ver HANDOFF-V3.md) -- si algún día apareciera
   uno que no encajase, esta función seguiría devolviendo 'experiencias' por
   defecto para un 'lugar' con acción, nunca null en silencio. */
function grupoReservaDe(it){
  if (it.tipo === 'vuelo') return 'vuelos';
  if (it.tipo === 'alojamiento') return 'hoteles';
  if (it.tipo === 'trayecto') return /bus/i.test(it.nota || '') ? 'buses' : 'trenes';
  if (it.tipo === 'lugar' && (it.acciones || []).some(a => a.necesaria)) {
    return it.categoria === 'comida' ? 'comidas' : 'experiencias';
  }
  return null;
}
canonical.forEach(it => { it.grupoReserva = grupoReservaDe(it); });

/* Fase 4, Decisión 2026-09-16 punto 1: las bases (noche/hotel) de la Ruta
   se derivan de los 9 hoteles CONFIRMADOS, nunca del campo `noche` de una
   propuesta. Aquí solo se DETECTA la incoherencia (RUTA_DAYS dice una
   ciudad que no coincide con la única base activa esa noche) — nunca se
   mueve la parada para "arreglarla" a ciegas.

   Dos correcciones tras la primera corrida real (2026-09-16), ambas para no
   avisar de un falso positivo:
   1. La "ciudad" de un hotel se deriva de RUTA_DAYS, pero `day.city` a veces
      es el DESTINO DE UNA EXCURSIÓN del día (p.ej. "Kamakura"/"Monte Fuji"
      durmiendo en Tokio esas noches), no la ciudad base. Si los días
      cubiertos por un hotel traen ciudades DISTINTAS entre sí, la señal es
      ambigua a propósito: se desactiva el chequeo de ciudad para ESE hotel
      (se queda `null`) en vez de adivinar cuál de las dos es la "de verdad".
   2. El último día antes de un vuelo de vuelta (duerme en el avión, no en
      tierra) puede tener paradas de día completo sin que ninguna base cubra
      esa noche — eso es esperado, no una incoherencia; se detecta mirando
      si el día SIGUIENTE es un día de vuelo (`city === 'Vuelo'`). */
// Destinos de excursión de un día conocidos en ESTA ruta (se duerme en la
// base, no ahí): al derivar la ciudad de un hotel se ignoran, para no leer
// "Kamakura"/"Monte Fuji" como si fueran la ciudad base de Tokio.
const EXCURSION_CITIES = new Set(['Kamakura', 'Monte Fuji']);

function citiesInRange(desde, hasta, rutaDays, inclusive){
  return new Set(rutaDays
    .filter(d => d.date >= desde && (inclusive ? d.date <= hasta : d.date < hasta))
    .map(d => d.city).filter(c => c && !EXCURSION_CITIES.has(c)));
}

// fechaHora.inicio de un hotel puede llevar hora real (llegada estimada, ver
// HOTEL_CHECKIN) pero estas comparaciones son de NOCHES (fechas de
// calendario, no instantes) -- mismo criterio que fechaDe() en v3/lib/bases.js:
// siempre recortar a 'YYYY-MM-DD' antes de comparar contra day.date.
const soloFecha = f => f.slice(0, 10);

function deriveCityOfHotels(hoteles, rutaDays){
  const cityOfHotel = new Map();
  for (const h of hoteles) {
    let ciudades = citiesInRange(soloFecha(h.fechaHora.inicio), h.fechaHora.fin, rutaDays, false);
    // Fallback: si TODOS los días de estancia son excursión (p.ej. APA
    // Asakusabashi: Kamakura + Monte Fuji), prueba incluyendo la mañana de
    // check-out — a veces es el único día sin excursión de por medio.
    if (ciudades.size !== 1) ciudades = citiesInRange(soloFecha(h.fechaHora.inicio), h.fechaHora.fin, rutaDays, true);
    cityOfHotel.set(h.id, ciudades.size === 1 ? [...ciudades][0] : null);
  }
  return cityOfHotel;
}

function checkIncoherenciasCiudad(canonicalItems, rutaDays){
  const hoteles = canonicalItems.filter(it => it.tipo === 'alojamiento' && it.estado === 'confirmado');
  const cityOfHotel = deriveCityOfHotels(hoteles, rutaDays);
  const incoherencias = [];
  for (let i = 0; i < rutaDays.length; i++) {
    const day = rutaDays[i];
    if (!day.stops || !day.stops.length) continue; // días de vuelo, sin paradas: no aplica
    const siguiente = rutaDays[i + 1];
    const hotel = hoteles.find(h => day.date >= soloFecha(h.fechaHora.inicio) && day.date < h.fechaHora.fin);
    if (!hotel) {
      if (siguiente && siguiente.city === 'Vuelo') continue; // último día, duerme en el avión: esperado
      incoherencias.push(`${day.date} (${day.city}): sin ninguna base confirmada que cubra esta noche`);
      continue;
    }
    if (EXCURSION_CITIES.has(day.city)) continue; // día de excursión conocido: se duerme en la base, no ahí
    const hotelCity = cityOfHotel.get(hotel.id);
    if (hotelCity && hotelCity !== day.city) {
      incoherencias.push(`${day.date}: RUTA_DAYS dice "${day.city}" pero la base activa esos días es "${hotel.nombre}" en "${hotelCity}"`);
    }
  }
  return incoherencias;
}
const incoherenciasCiudad = checkIncoherenciasCiudad(canonical, v2Baked.RUTA_DAYS);

/* La Ruta (Fase 4) necesita mostrar "ciudad + hotel" en la cabecera de cada
   base sin repetir esta derivación en el cliente: se hornea `ciudadBase` en
   cada hotel confirmado aquí mismo, UNA sola vez. `null` si es ambigua
   (ver deriveCityOfHotels) — la UI entonces enseña solo el nombre del hotel. */
const hotelesCanonical = canonical.filter(it => it.tipo === 'alojamiento' && it.estado === 'confirmado');
{
  const cityOfHotelFinal = deriveCityOfHotels(hotelesCanonical, v2Baked.RUTA_DAYS);
  for (const h of hotelesCanonical) h.ciudadBase = cityOfHotelFinal.get(h.id) || null;
}

/* Fase 5 (Más): `ciudad` de una idea = la del hotel confirmado más cercano
   por coordenadas (haversine sobre los 9 hoteles reales, no una tabla de
   coordenadas de ciudad inventada a mano). Es un filtro de exploración, no
   un dato de reserva -- una idea lejos de cualquier base (p.ej. Nagano,
   descartado de la Ruta) se etiqueta igual con la más cercana aunque no sea
   muy cercana; no hay umbral de distancia que la deje sin ciudad, a
   propósito (mejor una etiqueta aproximada que ninguna en un filtro). */
function haversineM(a, b){
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
{
  const hotelesConCiudad = hotelesCanonical.filter(h => h.ubicacion && h.ciudadBase);
  for (const it of canonical) {
    if (it.estado !== 'idea' || it.tipo !== 'lugar' || !it.ubicacion || !hotelesConCiudad.length) continue;
    let mejor = null, mejorDist = Infinity;
    for (const h of hotelesConCiudad) {
      const d = haversineM(it.ubicacion, h.ubicacion);
      if (d < mejorDist) { mejorDist = d; mejor = h; }
    }
    it.ciudad = mejor ? mejor.ciudadBase : null;
  }
}

/* Resumen de los 21 días de RUTA_DAYS (Fase 4, Bloque 3): el menú lateral
   de la Ruta necesita la lista COMPLETA de días —incluidos los de vuelo o
   sin base confirmada, que nunca aparecen como clave en `bases.dias` de
   v3/lib/bases.js porque no tienen ningún ítem asignado ahí— para poder
   construirse sin volver a tocar index.html raíz desde el navegador. */
const diasResumen = v2Baked.RUTA_DAYS.map(d => ({ fecha: d.date, ciudad: d.city, stay: d.stay || null }));

// Lo que sigue suelto tras nivel 1 + nivel 3 aprobado. Se anula `ubicacion`
// de los ids excluidos SOLO para este cálculo (misma exclusión que el nivel
// 1) y se filtran las parejas ya `rechazadas` (idempotencia: no se vuelven a
// proponer en corridas futuras).
const byCanonicalId = new Map(canonical.map(it => [it.id, it]));
const forResidual = canonical.map(it => isExcludedFromCoordMatch(it.id) ? Object.assign({}, it, { ubicacion: null }) : it);
const rawResidual = filterRejected(residualDuplicates(forResidual), manualMerges.rechazadas);
const residual = rawResidual.map(d => {
  const a = byCanonicalId.get(d.a), b = byCanonicalId.get(d.b);
  return Object.assign({}, d, {
    procedenciaA: a ? (a.procedencias ? a.procedencias.join('+') : a.procedencia) : null,
    procedenciaB: b ? (b.procedencias ? b.procedencias.join('+') : b.procedencia) : null,
    estadoA: a ? a.estado : null, estadoB: b ? b.estado : null
  });
});
const paraRevisionManual = residual.filter(d => d.estadoA !== 'idea' || d.estadoB !== 'idea');
const soloEntreIdeas = residual.length - paraRevisionManual.length;

// Fase 6 (2026-09-18): acepta las DOS formas de volcado del nodo v3 --
// un array plano de RouteItem (formato viejo, Fase 2), o el export
// completo de `proyectos/viaje-japon-v3/state` tal cual lo da la consola
// de Firebase (⋮ → Export JSON), que trae items/dias/guia/hechoOverrides/
// estadoOverrides juntos. Con la forma completa, además de fusionar los
// items (mergeV3State, Decisión B: conserva notas/hecho/estadoManual de
// cada ítem y nunca borra uno solo-en-v3) se detectan los overrides que
// quedarían HUÉRFANOS -- una marca de "hecho" o "reservado" en Firebase
// cuyo itemId ya no existiría tras esta actualización (p.ej. porque el
// dedup agrupó ese sitio de otra forma). No se borra nada aquí: solo se
// avisa, para decidir a mano antes de subir el resultado.
const existingRaw = v3JsonPath ? JSON.parse(fs.readFileSync(v3JsonPath, 'utf8')) : [];
const existingEsVolcadoCompleto = !Array.isArray(existingRaw);
const existing = existingEsVolcadoCompleto ? (existingRaw.items || []) : existingRaw;
const existingHechoOverrides = existingEsVolcadoCompleto ? (existingRaw.hechoOverrides || {}) : {};
const existingEstadoOverrides = existingEsVolcadoCompleto ? (existingRaw.estadoOverrides || {}) : {};
const { items: merged, stats } = mergeV3State(existing, canonical);

const mergedIds = new Set(merged.map(it => it.id));
const overridesHuerfanos = {
  hecho: Object.keys(existingHechoOverrides).filter(clave => !mergedIds.has(clave.split('::')[0])),
  estado: Object.keys(existingEstadoOverrides).filter(clave => !mergedIds.has(clave))
};

const outDir = path.join(__dirname, '..', 'import');
fs.mkdirSync(outDir, { recursive: true });
// Fase 4, Bloque 3: {items, dias} en vez de un array plano — la Ruta por
// días necesita el resumen de los 21 días de RUTA_DAYS (ver diasResumen
// arriba) tanto como los propios RouteItem.
// Fase 5 (Más → Guía): TIPS/PHRASES/PRICES/SKIPPED se extraen de index.html
// (v2Baked) igual que RUTA_DAYS/TRANSPORT -- nunca se retranscriben a mano,
// una sola fuente de verdad. `bookingTimeline`/CHECKLIST/TRANSPORT NO
// entran aquí: el primero lo sustituye Pendientes, TRANSPORT ya vive en
// Ruta como trayectos, y CHECKLIST queda fuera de esta fase (decisión
// 2026-09-16).
const guia = { tips: v2Baked.TIPS, phrases: v2Baked.PHRASES, prices: v2Baked.PRICES, skipped: v2Baked.SKIPPED };
fs.writeFileSync(path.join(outDir, 'v3-migrated-preview.json'), JSON.stringify({ items: merged, dias: diasResumen, guia }, null, 2));
fs.writeFileSync(path.join(outDir, 'v3-duplicates-report.json'), JSON.stringify(residual, null, 2));

const porEstado = (list, e) => list.filter(it => it.estado === e).length;
console.log('=== Importador v2 → v3 (Fase 2+dedup) — vista previa, SIN escribir en Firebase ===');
console.log(`Ítems importados (antes del nivel 1): ${imported.length} ` +
  `(confirmado: ${porEstado(imported, 'confirmado')}, propuesta: ${porEstado(imported, 'propuesta')}, idea: ${porEstado(imported, 'idea')})`);
console.log(`Nivel 1 — fusiones automáticas: ${merges.length} grupos (${merges.reduce((n, m) => n + m.idsOriginales.length, 0)} ids originales colapsados)`);
console.log(`Nivel 3 — fusiones manuales aprobadas: ${aplicadas.length} (import/v3-manual-merges.json)` +
  (omitidas.length ? ` — ${omitidas.length} OMITIDAS por contradicción (ver detalle abajo)` : ''));
console.log(`Reglas de reserva verificadas (§E) enganchadas: ${RESERVATION_RULES.length - reglasNoEncontradas.length}/${RESERVATION_RULES.length}` +
  (reglasNoEncontradas.length ? ` — sin RouteItem: ${reglasNoEncontradas.join(', ')}` : ''));
console.log(`Ítems tras nivel 1 + nivel 3 aprobado: ${canonical.length} ` +
  `(confirmado: ${porEstado(canonical, 'confirmado')}, propuesta: ${porEstado(canonical, 'propuesta')}, idea: ${porEstado(canonical, 'idea')})`);
console.log(`Nivel 3 — candidatos sueltos con al menos un lado propuesta/confirmado: ${paraRevisionManual.length} (NUNCA fusionados; revisión manual)`);
console.log(`Candidatos dudosos que quedan SOLO entre ideas (no se muestran, no bloquean nada): ${soloEntreIdeas}`);
console.log(`Fusión con v3 ${v3JsonPath ? 'existente (' + v3JsonPath + ')' : '(nodo vacío, siembra)'}: ` +
  `${stats.nuevos} nuevos, ${stats.actualizados} actualizados, ${stats.soloEnV3Conservados} conservados solo-en-v3`);
if (existingEsVolcadoCompleto) {
  const totalHuerfanos = overridesHuerfanos.hecho.length + overridesHuerfanos.estado.length;
  console.log(`Overrides que quedarían HUÉRFANOS si subes este resultado (hechoOverrides/estadoOverrides sin ítem que los reciba): ${totalHuerfanos}`);
  if (totalHuerfanos) {
    console.log('  ⚠️  NO se suben tal cual estos datos en modo vista previa -- revisa antes de actualizar Firebase:');
    overridesHuerfanos.hecho.forEach(clave => console.log('  - hechoOverrides/' + clave + ' (item "' + clave.split('::')[0] + '" ya no existe con ese id)'));
    overridesHuerfanos.estado.forEach(clave => console.log('  - estadoOverrides/' + clave + ' (item "' + clave + '" ya no existe con ese id)'));
  }
}
console.log(`Trayectos (Fase 4, TRANSPORT como RouteItem): ${trayectoItems.length} filas, ` +
  `${trayectoItems.filter(t => t.acciones.length).length} con acción de reserva investigada`);
console.log(`Incoherencias ciudad/base (Fase 4, punto 1): ${incoherenciasCiudad.length}` +
  (incoherenciasCiudad.length ? ' — ver detalle abajo' : ''));
if (avisos.length) { console.log('\nAvisos (alcance de esta fase, no errores):'); avisos.forEach(a => console.log('- ' + a)); }
if (incoherenciasCiudad.length) {
  console.log('\n=== Incoherencias ciudad/base (ninguna parada se movió) ===');
  incoherenciasCiudad.forEach(i => console.log('- ' + i));
}
if (omitidas.length) {
  console.log('\n=== Nivel 3: fusiones aprobadas que NO se aplicaron (contradicción con los datos reales) ===');
  omitidas.forEach(o => console.log(`- ${JSON.stringify(o.regla)}: ${o.motivo}`));
}
if (manualMerges.pendientes && manualMerges.pendientes.length) {
  console.log('\n=== Nivel 3: pendientes de decisión (la petición no encajó con los datos) ===');
  manualMerges.pendientes.forEach(p => console.log(`- ${p.canonicalId} <- ${p.candidato}: ${p.motivo}`));
}
console.log(`\nEscrito: import/v3-migrated-preview.json (${merged.length} ítems totales) y import/v3-duplicates-report.json (${residual.length} candidatos residuales completos)`);
if (paraRevisionManual.length) {
  console.log('\n=== Nivel 3: revisión manual (nombre / procedencia / estado / distancia) ===');
  paraRevisionManual.forEach(d => {
    console.log(`- ${d.nombreA} [${d.procedenciaA}/${d.estadoA}] (${d.a})  <->  ${d.nombreB} [${d.procedenciaB}/${d.estadoB}] (${d.b})  ` +
      `razon:${d.razon} dist:${d.distanciaM == null ? '-' : d.distanciaM + 'm'}`);
  });
}
