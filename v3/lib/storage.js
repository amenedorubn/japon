/* ================================================================
   JAPÓN 2027 · v3 · Único punto de contacto con localStorage.
   Decisión 2026-09-16: v2.1 y v3 comparten origen (amenedorubn.github.io) y
   por tanto el mismo localStorage. TODA clave de v3 lleva el prefijo
   'jp27v3:' para no pisar nunca las claves de v2.1 (`japon27_theme`,
   `japon27_notifications`, `viaje-japon-boundary-v3:*`, `viaje-japon-rail-v1:*`
   — invariante §12.8 de PROJECT.md). Nada en v3 debe llamar a
   `localStorage.getItem/setItem/removeItem` directamente: siempre a través
   de este wrapper (comprobado por tests/test-v3-storage-guard.js).

   Recibe el `localStorage` real como parámetro (nunca lo toca por su cuenta)
   para poder probarse con un stub, igual que el resto de v3/lib/*.js. */
'use strict';

const PREFIX = 'jp27v3:';

function makeStorage(rawStorage){
  return {
    get(key){ return rawStorage.getItem(PREFIX + key); },
    set(key, value){ rawStorage.setItem(PREFIX + key, value); },
    remove(key){ rawStorage.removeItem(PREFIX + key); },
    getJSON(key, fallback){
      const raw = rawStorage.getItem(PREFIX + key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    setJSON(key, value){ rawStorage.setItem(PREFIX + key, JSON.stringify(value)); }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { PREFIX, makeStorage };
}
