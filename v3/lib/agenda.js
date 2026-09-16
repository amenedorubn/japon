/* ================================================================
   JAPÓN 2027 · v3 · Helpers de la agenda de un día (Fase 4, Bloque 3,
   2026-09-16). Funciones puras y compartidas entre v3/index.html (agenda) y
   los conteos "sin inventar nada" que se reportan por día. Autosuficientes
   (sin `require`): funcionan igual en Node y como <script src>.
================================================================ */
'use strict';

function horaDe(item){
  const inicio = item && item.fechaHora && item.fechaHora.inicio;
  if (!inicio || inicio.indexOf('T') === -1) return null;
  return inicio.split('T')[1].slice(0, 5);
}

/* Minutos entre fechaHora.inicio y fechaHora.fin, SOLO si los dos traen
   hora real (no se infiere ni se inventa una duración a partir de otra
   cosa). null si falta cualquiera de las dos. */
function duracionMinutos(item){
  const f = item && item.fechaHora;
  if (!f || !f.inicio || !f.fin) return null;
  if (f.inicio.indexOf('T') === -1 || f.fin.indexOf('T') === -1) return null;
  const [h1, m1] = f.inicio.split('T')[1].split(':').map(Number);
  const [h2, m2] = f.fin.split('T')[1].split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

/* Estado visible (Decisión 2026-09-16 punto 2 de Pendientes, reutilizado
   igual en la Ruta): una reserva pendiente manda sobre el estado base. */
function tienePendiente(item){
  return (item.acciones || []).some(a => a.necesaria && !a.hecho);
}
function iconoEstado(item){
  if (tienePendiente(item)) return '🎫';
  return item.estado === 'confirmado' ? '✅' : '🟡';
}

/* Conteo HONESTO por día, para el informe pedido (Bloque 3): nunca infiere
   ni inventa — cuenta exactamente lo que falta en los datos reales.
   - sinHora / sinDuracion: solo entre paradas ('lugar'), no trayectos.
   - desplazamientosSinDefinir: trayectos de ese día sin duración
     estructurada (TRANSPORT de v2 no da hora de fin — ver
     v3/lib/trayectos.js; ninguno la tiene hoy, y este conteo lo refleja tal
     cual en vez de ocultarlo). */
function contarSinDatos(itemsDelDia){
  const esTransporte = it => it.tipo === 'trayecto' || it.tipo === 'vuelo';
  const paradas = itemsDelDia.filter(it => !esTransporte(it));
  const trayectos = itemsDelDia.filter(esTransporte);
  return {
    sinHora: paradas.filter(it => !horaDe(it)).length,
    sinDuracion: paradas.filter(it => duracionMinutos(it) == null).length,
    desplazamientosSinDefinir: trayectos.filter(it => duracionMinutos(it) == null).length
  };
}

if (typeof module !== 'undefined') {
  module.exports = { horaDe, duracionMinutos, tienePendiente, iconoEstado, contarSinDatos };
}
