/* ================================================================
   JAPÓN 2027 · v3 · Modelo de datos y vista derivada "Pendientes"
   Ver V3-DESIGN.md §B (esquema) y §C (pendientesView, 4 niveles de
   precisión). Funciones puras, sin DOM ni Firebase: se hornean tal cual en
   el futuro <script> único de v3/index.html.

   Decisión C (2026-09-16): `reserva` (singular) se generaliza a `acciones[]`
   — un mismo ítem puede tener más de una acción pendiente (p.ej. un vuelo
   con su propio check-in, sin ser un ítem aparte). Cada acción lleva su
   propio `id` estable (p.ej. 'reserva', 'checkin') para poder marcarla como
   hecha sin ambigüedad y para que el merge de la Fase 2 (v3/lib/merge.js)
   pueda emparejarlas entre una versión importada y la que ya vive en v3.
================================================================ */
'use strict';

const path = require('path');
const { formatInZones, zonedTimeToUtc } = require(path.join(__dirname, 'timezone.js'));

const TIPOS = ['lugar', 'trayecto', 'alojamiento', 'vuelo'];
const ESTADOS = ['confirmado', 'propuesta', 'idea']; // Decisión 2: sustituye al binario de v2
const PROCEDENCIAS = ['ours', 'dani', 'maria', 'instagram', 'ai']; // campo secundario, histórico

const ZONAS_PENDIENTES = ['Europe/Madrid', 'Asia/Tokyo']; // §C: siempre las dos juntas

/* Nivel de precisión de UNA acción (reserva, check-in...), de más a menos
   exacto (§C.2). Puro: no mira el reloj, solo la FORMA de los datos
   disponibles. */
function precisionLevel(accion){
  if (!accion || !accion.necesaria) return null;
  const abre = accion.abreEn;
  if (abre && abre.fecha && abre.hora && abre.zona && accion.horaConfirmada) return 1; // exacto
  if (abre && abre.fecha) return 2; // día exacto, hora/zona sin confirmar
  if (accion.reglaApertura) return 3; // "vigilar apertura": se sabe que abrirá, sin fecha exacta
  return 4; // "reservar ya": sin ventana de venta que esperar
}

/* Instante UTC (ms) en que abre una acción de nivel 1 o 2. Nivel 2 puede
   tener hora/zona ausentes: se rellenan con un valor neutro (00:00 JST) SOLO
   para poder ordenar por día — nunca se muestra esa hora inventada en UI
   (a nivel 2 la UI solo enseña el día, ver §C.2). */
function accionAbreEnUtc(accion){
  const abre = accion.abreEn;
  if (!abre || !abre.fecha) return null;
  const [y, m, d] = abre.fecha.split('-').map(Number);
  const zone = abre.zona || 'Asia/Tokyo';
  const [hh, mm] = (abre.hora || '00:00').split(':').map(Number);
  return zonedTimeToUtc(y, m, d, hh, mm, zone);
}

/* pendientesView (§C): lee `item.acciones` (array, no un `reserva` singular)
   de TODOS los ítems y hace flatMap — un ítem con dos acciones pendientes
   (p.ej. un vuelo con check-in Y una reserva de asiento) aparece una vez por
   acción, nunca fusionadas. Cada entrada de salida referencia
   `{itemId, accionId}` para poder marcar esa acción concreta como hecha sin
   ambigüedad. `ahoraUtcMs` se pasa siempre desde fuera (nunca Date.now()
   interno) para que la función sea pura y testeable sin reloj real. */
function pendientesView(items, ahoraUtcMs){
  const pendientes = [];
  const hechos = [];

  for (const it of (items || [])) {
    for (const accion of (it.acciones || [])) {
      if (!accion.necesaria) continue;
      if (accion.hecho) { hechos.push({ itemId: it.id, accionId: accion.id, nombre: it.nombre }); continue; }

      const nivel = precisionLevel(accion);
      const abreEnUtc = (nivel === 1 || nivel === 2) ? accionAbreEnUtc(accion) : null;
      const entry = {
        itemId: it.id, accionId: accion.id, nombre: it.nombre, nivel, accion,
        abreEnUtc,
        minutosHastaApertura: abreEnUtc != null ? Math.round((abreEnUtc - ahoraUtcMs) / 60000) : null
      };
      if (abreEnUtc != null) entry.horas = formatInZones(abreEnUtc, ZONAS_PENDIENTES);
      pendientes.push(entry);
    }
  }

  const conFecha = pendientes.filter(p => p.nivel === 1 || p.nivel === 2)
    .sort((a, b) => a.abreEnUtc - b.abreEnUtc);
  const vigilar = pendientes.filter(p => p.nivel === 3);
  const reservarYa = pendientes.filter(p => p.nivel === 4);

  return { conFecha, vigilar, reservarYa, hechos };
}

if (typeof module !== 'undefined') {
  module.exports = { TIPOS, ESTADOS, PROCEDENCIAS, ZONAS_PENDIENTES, precisionLevel, accionAbreEnUtc, pendientesView };
}
