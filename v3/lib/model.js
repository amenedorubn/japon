/* ================================================================
   JAPÓN 2027 · v3 · Modelo de datos y vista derivada "Pendientes"
   Ver V3-DESIGN.md §B (esquema) y §C (pendientesView, 4 niveles de
   precisión). Funciones puras, sin DOM ni Firebase: se hornean tal cual en
   el futuro <script> único de v3/index.html.
================================================================ */
'use strict';

const path = require('path');
const { formatInZones } = require(path.join(__dirname, 'timezone.js'));

const TIPOS = ['lugar', 'trayecto', 'alojamiento', 'vuelo'];
const ESTADOS = ['confirmado', 'propuesta', 'idea']; // Decisión 2: sustituye al binario de v2
const PROCEDENCIAS = ['ours', 'dani', 'maria', 'instagram', 'ai']; // campo secundario, histórico

const ZONAS_PENDIENTES = ['Europe/Madrid', 'Asia/Tokyo']; // §C.2: siempre las dos juntas

/* Nivel de precisión de una reserva, de más a menos exacto (§C.2). Puro:
   no mira el reloj, solo la FORMA de los datos disponibles. */
function precisionLevel(reserva){
  if (!reserva || !reserva.necesaria) return null;
  const abre = reserva.abreEn;
  if (abre && abre.fecha && abre.hora && abre.zona && reserva.horaConfirmada) return 1; // exacto
  if (abre && abre.fecha) return 2; // día exacto, hora/zona sin confirmar
  if (reserva.reglaApertura) return 3; // "vigilar apertura": se sabe que abrirá, sin fecha exacta
  return 4; // "reservar ya": sin ventana de venta que esperar
}

/* Instante UTC (ms) en que abre una reserva de nivel 1 o 2. Nivel 2 puede
   tener hora/zona ausentes: se rellenan con un valor neutro (00:00 JST) SOLO
   para poder ordenar por día — nunca se muestra esa hora inventada en UI
   (a nivel 2 la UI solo enseña el día, ver §C.2). */
function reservaAbreEnUtc(reserva){
  const abre = reserva.abreEn;
  if (!abre || !abre.fecha) return null;
  const [y, m, d] = abre.fecha.split('-').map(Number);
  const zone = abre.zona || 'Asia/Tokyo';
  const [hh, mm] = (abre.hora || '00:00').split(':').map(Number);
  const { zonedTimeToUtc } = require(path.join(__dirname, 'timezone.js'));
  return zonedTimeToUtc(y, m, d, hh, mm, zone);
}

/* pendientesView: vista derivada de Pendientes (§C). NO edita nada; el único
   campo mutable de fuera es reserva.hecho, que aquí solo se LEE para filtrar.
   `ahoraUtcMs` se pasa siempre desde fuera (nunca Date.now() interno) para
   que la función sea pura y testeable sin reloj real. */
function pendientesView(items, ahoraUtcMs){
  const pendientes = (items || [])
    .filter(it => it.reserva && it.reserva.necesaria && !it.reserva.hecho)
    .map(it => {
      const nivel = precisionLevel(it.reserva);
      const abreEnUtc = (nivel === 1 || nivel === 2) ? reservaAbreEnUtc(it.reserva) : null;
      const entry = {
        id: it.id, nombre: it.nombre, nivel,
        reserva: it.reserva,
        abreEnUtc,
        minutosHastaApertura: abreEnUtc != null ? Math.round((abreEnUtc - ahoraUtcMs) / 60000) : null
      };
      if (abreEnUtc != null) entry.horas = formatInZones(abreEnUtc, ZONAS_PENDIENTES);
      return entry;
    });

  const nivel12 = pendientes.filter(p => p.nivel === 1 || p.nivel === 2)
    .sort((a, b) => a.abreEnUtc - b.abreEnUtc);
  const vigilar = pendientes.filter(p => p.nivel === 3);
  const reservarYa = pendientes.filter(p => p.nivel === 4);

  const hechos = (items || []).filter(it => it.reserva && it.reserva.necesaria && it.reserva.hecho)
    .map(it => ({ id: it.id, nombre: it.nombre }));

  return { conFecha: nivel12, vigilar, reservarYa, hechos };
}

if (typeof module !== 'undefined') {
  module.exports = { TIPOS, ESTADOS, PROCEDENCIAS, ZONAS_PENDIENTES, precisionLevel, reservaAbreEnUtc, pendientesView };
}
