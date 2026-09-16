/* ================================================================
   JAPÓN 2027 · v3 · Fusión segura del importador con el nodo v3 existente
   (Decisión 2026-09-16, punto B). Nada de `fb.set` a ciegas: el importador
   siempre lee primero lo que ya hay en `proyectos/viaje-japon-v3` y fusiona
   por id, para no pisar lo que un usuario haya editado a mano en v3.

   Reparto de quién manda en cada campo:
   - El importador (`imported`, recién transformado de v2) manda en todo lo
     DERIVADO de v2: nombre, ubicación, fechaHora, procedencia, y la forma de
     cada acción (regla de apertura, fuente, verificadoEl...).
   - El nodo v3 existente (`existing`) manda en lo que un usuario edita a
     mano: `notas`, `hecho` de cada acción (emparejada por `acciones[].id`,
     no por posición), y `estado` cuando el ítem tiene `estadoManual: true`
     (el usuario lo cambió a mano; el importador entonces deja de proponer
     un estado distinto).
   - Un ítem que solo existe en v3 (creado por un usuario, sin id en el
     resultado importado) NUNCA se borra: se conserva tal cual (punto 3).

   Puro y determinista: la misma pareja (existing, imported) da siempre el
   mismo resultado — igual que `foldCurated` en v2.
================================================================ */
'use strict';

function mergeV3State(existing, imported){
  const existingList = existing || [];
  const importedList = imported || [];
  const existingById = new Map(existingList.map(it => [it.id, it]));
  const importedIds = new Set(importedList.map(it => it.id));

  const merged = importedList.map(freshItem => {
    const prev = existingById.get(freshItem.id);
    if (!prev) {
      return Object.assign({ notas: null, estadoManual: false }, freshItem);
    }
    const acciones = (freshItem.acciones || []).map(freshAccion => {
      const prevAccion = (prev.acciones || []).find(a => a.id === freshAccion.id);
      return prevAccion ? Object.assign({}, freshAccion, { hecho: !!prevAccion.hecho }) : freshAccion;
    });
    return Object.assign({}, freshItem, {
      acciones,
      notas: prev.notas != null ? prev.notas : null,
      estado: prev.estadoManual ? prev.estado : freshItem.estado,
      estadoManual: !!prev.estadoManual
    });
  });

  const soloEnV3 = existingList.filter(it => !importedIds.has(it.id));

  return {
    items: merged.concat(soloEnV3),
    stats: {
      nuevos: merged.filter(it => !existingById.has(it.id)).length,
      actualizados: merged.filter(it => existingById.has(it.id)).length,
      soloEnV3Conservados: soloEnV3.length
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { mergeV3State };
}
