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
const { normalizeNameForTwins, groupCanonical, residualDuplicates } = require(path.join(__dirname, '..', 'v3', 'lib', 'twins.js'));

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
    ;return { RUTA_DAYS, FLIGHTS, canonicalPid, provenanceOf, isBookedHotel, hotelPlaceholderBase, TWIN_GROUPS };`);

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

function transform(livePlaces, v2Baked){
  const { RUTA_DAYS, FLIGHTS, canonicalPid, provenanceOf, isBookedHotel } = v2Baked;
  const byId = new Map(livePlaces.filter(p => p && p.id).map(p => [p.id, p]));
  const consumed = new Set(); // ids ya asignados a un estado (precedencia)
  const avisos = []; // decisiones de alcance / cosas raras, para el resumen — no errores
  const items = [];

  // 1) CONFIRMADO — hoteles reservados (más alto en la precedencia).
  for (const p of livePlaces.filter(isBookedHotel)) {
    items.push({
      id: p.id, nombre: p.name || p.id, tipo: 'alojamiento',
      procedencia: provenanceOf(p), estado: 'confirmado',
      noche: null, // una reserva de hotel cubre varias noches; el UI de Fase 4 lo deriva por rango
      fechaHora: { inicio: p.checkIn || null, fin: p.checkOut || null, zona: 'Asia/Tokyo' },
      ubicacion: (p.lat != null && p.lng != null) ? { lat: p.lat, lng: p.lng } : null,
      acciones: []
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
      acciones: [checkinByLeg.get(f.id)]
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
      items.push({
        id: pid, nombre: place.name || pid, tipo: 'lugar',
        procedencia: provenanceOf(place), estado: 'propuesta',
        noche: 'noche-' + day.date,
        fechaHora: { inicio: `${day.date}T${stop.time}`, fin: null, zona: 'Asia/Tokyo' },
        ubicacion: (place.lat != null && place.lng != null) ? { lat: place.lat, lng: place.lng } : null,
        acciones: []
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
      acciones: []
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

const { items: imported, avisos } = transform(livePlaces, v2Baked);

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
const { items: canonical, merges } = groupCanonical(imported, v2Baked.TWIN_GROUPS, { isExcludedFromCoordMatch });

// Nivel 3: lo que sigue suelto tras el nivel 1. Se anula `ubicacion` de los
// ids excluidos SOLO para este cálculo (misma exclusión que el nivel 1,
// aplicada también aquí para no proponer en revisión manual lo mismo que el
// nivel 2 ya descarta como ruido de coordenadas).
const byCanonicalId = new Map(canonical.map(it => [it.id, it]));
const forResidual = canonical.map(it => isExcludedFromCoordMatch(it.id) ? Object.assign({}, it, { ubicacion: null }) : it);
const rawResidual = residualDuplicates(forResidual);
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

const existing = v3JsonPath ? JSON.parse(fs.readFileSync(v3JsonPath, 'utf8')) : [];
const { items: merged, stats } = mergeV3State(existing, canonical);

const outDir = path.join(__dirname, '..', 'import');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'v3-migrated-preview.json'), JSON.stringify(merged, null, 2));
fs.writeFileSync(path.join(outDir, 'v3-duplicates-report.json'), JSON.stringify(residual, null, 2));

const porEstado = (list, e) => list.filter(it => it.estado === e).length;
console.log('=== Importador v2 → v3 (Fase 2+dedup) — vista previa, SIN escribir en Firebase ===');
console.log(`Ítems importados (antes del nivel 1): ${imported.length} ` +
  `(confirmado: ${porEstado(imported, 'confirmado')}, propuesta: ${porEstado(imported, 'propuesta')}, idea: ${porEstado(imported, 'idea')})`);
console.log(`Nivel 1 — fusiones automáticas: ${merges.length} grupos (${merges.reduce((n, m) => n + m.idsOriginales.length, 0)} ids originales colapsados)`);
console.log(`Ítems tras el nivel 1: ${canonical.length} ` +
  `(confirmado: ${porEstado(canonical, 'confirmado')}, propuesta: ${porEstado(canonical, 'propuesta')}, idea: ${porEstado(canonical, 'idea')})`);
console.log(`Nivel 3 — candidatos sueltos con al menos un lado propuesta/confirmado: ${paraRevisionManual.length} (NUNCA fusionados; revisión manual)`);
console.log(`Candidatos dudosos que quedan SOLO entre ideas (no se muestran, no bloquean nada): ${soloEntreIdeas}`);
console.log(`Fusión con v3 ${v3JsonPath ? 'existente (' + v3JsonPath + ')' : '(nodo vacío, siembra)'}: ` +
  `${stats.nuevos} nuevos, ${stats.actualizados} actualizados, ${stats.soloEnV3Conservados} conservados solo-en-v3`);
if (avisos.length) { console.log('\nAvisos (alcance de esta fase, no errores):'); avisos.forEach(a => console.log('- ' + a)); }
console.log(`\nEscrito: import/v3-migrated-preview.json (${merged.length} ítems totales) y import/v3-duplicates-report.json (${residual.length} candidatos residuales completos)`);
if (paraRevisionManual.length) {
  console.log('\n=== Nivel 3: revisión manual (nombre / procedencia / estado / distancia) ===');
  paraRevisionManual.forEach(d => {
    console.log(`- ${d.nombreA} [${d.procedenciaA}/${d.estadoA}] (${d.a})  <->  ${d.nombreB} [${d.procedenciaB}/${d.estadoB}] (${d.b})  ` +
      `razon:${d.razon} dist:${d.distanciaM == null ? '-' : d.distanciaM + 'm'}`);
  });
}
