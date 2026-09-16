/* ================================================================
   JAPÓN 2027 · v3 · Overrides locales de "reservado" (Fase 5, puente
   localStorage hasta que la Fase 6 conecte Firebase de verdad). Mismo
   patrón que hecho-overrides.js pero a nivel de ÍTEM, no de acción: marcar
   un 🎫 "Por reservar" como reservado sube su `estado` a 'confirmado' con
   `estadoManual: true` (para distinguirlo de un hotel/vuelo confirmado por
   la reserva real, no por el usuario) y una nota corta opcional
   (localizador, precio) en `notaReserva` -- NUNCA en `nota`, que ya puede
   traer texto de la fuente importada.

   Funciones puras: reciben y devuelven el objeto de overrides, nunca tocan
   localStorage directamente (eso vive en v3/lib/storage.js).
================================================================ */
'use strict';

/* `accionId` se guarda junto al override (no solo el estado) para que el
   botón "Deshacer" permanente de la lista Confirmado sepa qué acción
   desmarcar también como hecho, sin tener que adivinarla entre las
   `acciones` del ítem (Fase 5, Reservas). */
function markConfirmado(overrides, itemId, accionId, nota){
  var next = Object.assign({}, overrides);
  next[itemId] = { estado: 'confirmado', estadoManual: true, accionId: accionId || null, notaReserva: nota || null };
  return next;
}

function undoConfirmado(overrides, itemId){
  var next = Object.assign({}, overrides);
  delete next[itemId];
  return next;
}

function isConfirmadoOverride(overrides, itemId){
  return !!overrides[itemId];
}

/* Aplica los overrides sobre los RouteItems importados: un override SIEMPRE
   gana sobre el `estado` que traiga el JSON, nunca al revés (mismo
   principio que applyOverrides en hecho-overrides.js). */
function applyEstadoOverrides(items, overrides){
  return items.map(function(it){
    var ov = overrides[it.id];
    if (!ov) return it;
    return Object.assign({}, it, { estado: ov.estado, estadoManual: ov.estadoManual, notaReserva: ov.notaReserva, accionReservadaId: ov.accionId });
  });
}

if (typeof module !== 'undefined') {
  module.exports = { markConfirmado, undoConfirmado, isConfirmadoOverride, applyEstadoOverrides };
}
