/* ================================================================
   JAPÓN 2027 · v3 · Overrides locales de "hecho" (puente localStorage,
   V3-DESIGN.md, hasta que la Fase 6 conecte Firebase de verdad). Funciones
   puras: reciben y devuelven el objeto de overrides, nunca tocan
   localStorage directamente (eso vive en v3/lib/storage.js).

   Decisión 2026-09-16 (cambio en Pendientes): un "hecho" marcado a mano SÍ
   se puede deshacer — `undoDone` quita la clave del override en vez de
   dejar el ítem marcado para siempre.
================================================================ */
'use strict';

function overrideKey(itemId, accionId){ return itemId + '::' + accionId; }

function markDone(overrides, itemId, accionId){
  var next = Object.assign({}, overrides);
  next[overrideKey(itemId, accionId)] = true;
  return next;
}

function undoDone(overrides, itemId, accionId){
  var next = Object.assign({}, overrides);
  delete next[overrideKey(itemId, accionId)];
  return next;
}

function isOverridden(overrides, itemId, accionId){
  return !!overrides[overrideKey(itemId, accionId)];
}

/* Aplica los overrides sobre los RouteItems importados (que traen su propio
   `hecho` de fuente, casi siempre false): un override SIEMPRE gana sobre lo
   que diga el JSON importado, nunca al revés. */
function applyOverrides(items, overrides){
  return items.map(function(it){
    if (!it.acciones || !it.acciones.length) return it;
    var acciones = it.acciones.map(function(ac){
      return isOverridden(overrides, it.id, ac.id) ? Object.assign({}, ac, { hecho: true }) : ac;
    });
    return Object.assign({}, it, { acciones: acciones });
  });
}

if (typeof module !== 'undefined') {
  module.exports = { overrideKey, markDone, undoDone, isOverridden, applyOverrides };
}
