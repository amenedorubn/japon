/* ================================================================
   JAPÓN 2027 · v3 · Informe de posibles duplicados (Decisión 2026-09-16,
   punto 2 de la Fase 2). El importador NUNCA fusiona automáticamente dos
   ítems: solo señala candidatos (mismo nombre normalizado, o coordenadas a
   menos de 150 m) para que el usuario decida caso a caso. Funciones puras.
================================================================ */
'use strict';

/* Normaliza un nombre para comparar: quita acentos, pasa a minúsculas,
   colapsa cualquier signo de puntuación/espacio en un único espacio. */
function normalizeName(s){
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function haversineMeters(a, b){
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Candidatos a duplicado entre RouteItems: mismo nombre normalizado o
   coordenadas a menos de `opts.maxMeters` (150 por defecto). Comparación
   O(n²) — el catálogo real ronda ~500 ítems, sobra de margen. NUNCA fusiona:
   solo informa, con la razón y (si aplica) la distancia en metros. */
function findPotentialDuplicates(items, opts){
  const maxMeters = (opts && opts.maxMeters) || 150;
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.id === b.id) continue;
      const nameA = normalizeName(a.nombre), nameB = normalizeName(b.nombre);
      const sameName = !!nameA && !!nameB && nameA === nameB;
      const dist = haversineMeters(a.ubicacion, b.ubicacion);
      const closeCoords = dist != null && dist < maxMeters;
      if (sameName || closeCoords) {
        out.push({
          a: a.id, b: b.id, nombreA: a.nombre, nombreB: b.nombre,
          razon: sameName && closeCoords ? 'nombre+coordenadas' : (sameName ? 'nombre' : 'coordenadas'),
          distanciaM: dist != null ? Math.round(dist) : null
        });
      }
    }
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { normalizeName, haversineMeters, findPotentialDuplicates };
}
