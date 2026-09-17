/* ================================================================
   JAPÓN 2027 · v3 · Fase 6 — lógica pura de sincronización con Firebase
   (fusión única al migrar y cola de escrituras offline). Sin Firebase real
   aquí dentro: funciones puras, testeables sin red, que v3/index.html llama
   pasándoles lo que lea/escriba de verdad.

   Decisión 2026-09-17 (3 correcciones del usuario a la Fase 6):
   1. La fusión "hecho gana" con lo que hubiera en local (de antes de tener
      sync) es de UN SOLO USO por móvil — el llamador la invoca solo si
      `jp27v3:migrado` no está puesto, y lo marca justo después. Pasado ese
      punto, Firebase manda solo: Deshacer borra la clave remota de verdad
      (`remove`, nunca un `set` a false/null que un futuro merge pudiera
      "resucitar" con datos locales viejos).
   2. Los campos privados (price/bookingRef/address/hotelPhone/notaReserva)
      entran en Firebase YA en la siembra de esta fase — no esperan a que la
      Fase 8 limpie v2.1 (eso solo QUITA los duplicados de los ficheros
      públicos, nunca cambia lo que ya vive en Firebase).
   3. Escrituras sin conexión: se encolan en localStorage (persisten aunque
      se cierre la app) y se reintentan solas al reconectar — nunca se
      pierden por cerrar la pestaña en modo avión.
================================================================ */
'use strict';

/* Fusión única de hechoOverrides (booleanos itemId::accionId -> true): un
   "hecho" marcado en CUALQUIER lado (local viejo o remoto) sobrevive,
   nunca se pierde uno con el otro. */
function fusionInicialHecho(local, remoto){
  var resultado = Object.assign({}, remoto);
  Object.keys(local || {}).forEach(function(clave){
    if (local[clave] === true) resultado[clave] = true;
  });
  return resultado;
}

/* Fusión única de estadoOverrides (objetos itemId -> {estado, notaReserva...}):
   si SOLO un lado tiene el ítem, sobrevive tal cual. Si los DOS lo tienen
   (dos móviles con historia local distinta para el MISMO ítem, caso raro),
   gana el remoto -- ya es la copia compartida, y evita fundir a ciegas dos
   notas de reserva distintas en una sola. */
function fusionInicialEstado(local, remoto){
  var resultado = Object.assign({}, remoto);
  Object.keys(local || {}).forEach(function(clave){
    if (!(clave in resultado)) resultado[clave] = local[clave];
  });
  return resultado;
}

/* Cola de escrituras offline: una entrada por RUTA (no por evento) -- si el
   usuario marca y deshace varias veces sin red, solo el resultado final
   necesita llegar a Firebase, no cada paso intermedio. `valor === null`
   representa un borrado real (remove), nunca "false" (eso sí podría
   confundirse con un dato válido). */
function encolarEscritura(cola, ruta, valor){
  var siguiente = (cola || []).filter(function(e){ return e.ruta !== ruta; });
  siguiente.push({ ruta: ruta, valor: valor });
  return siguiente;
}
function quitarDeCola(cola, ruta){
  return (cola || []).filter(function(e){ return e.ruta !== ruta; });
}

/* Rutas de escritura bajo proyectos/viaje-japon-v3/state -- un solo sitio
   que las construya, para no repetir el separador '::' en varios ficheros. */
function rutaHecho(itemId, accionId){ return 'hechoOverrides/' + itemId + '::' + accionId; }
function rutaEstado(itemId){ return 'estadoOverrides/' + itemId; }

if (typeof module !== 'undefined') {
  module.exports = { fusionInicialHecho, fusionInicialEstado, encolarEscritura, quitarDeCola, rutaHecho, rutaEstado };
}
