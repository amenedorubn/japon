/* ================================================================
   JAPÓN 2027 · v3 · Agrupación canónica de duplicados (Decisión 2026-09-16,
   dedup en 3 niveles). Un mismo sitio real, contado varias veces por
   distintas fuentes (nuestro/Dani/María/Instagram/IA), se colapsa en UN
   ítem canónico con `procedencias[]` e `idsOriginales[]` — NUNCA se borra
   información, solo se deja de repetir la tarjeta.

   Nivel 1 (automático): reutiliza TWIN_GROUPS de v2 (ya vive en index.html,
   verificado a mano por el usuario) en vez de duplicar esa lista — una
   pareja ancla/miembro declarada ahí se fusiona SIEMPRE, sin mirar nombre ni
   distancia. Para lo que TWIN_GROUPS no cubre todavía (María, Instagram, y
   pares nuevos): mismo nombre normalizado (con equivalencias Tokio=Tokyo,
   Kioto=Kyoto) Y coordenadas a menos de 150 m — las DOS condiciones a la
   vez, para no fusionar dos sitios homónimos pero distintos de verdad.

   Nivel 2 (exclusión): quién puede disparar el lado de "coordenadas" de esa
   regla lo decide el llamador vía `isExcludedFromCoordMatch` — el
   importador excluye ahí hoteles confirmados y marcadores de centro de
   ciudad, para que "INOVA Kanazawa" no se fusione con el pin "Kanazawa" de
   la ciudad entera solo por caer en el mismo punto.

   Nivel 3 (revisión manual) vive en el importador, no aquí: junta lo que
   sigue suelto tras el nivel 1 con `residualDuplicates` y lo filtra.
================================================================ */
'use strict';

const path = require('path');
const { normalizeName, haversineMeters, findPotentialDuplicates } = require(path.join(__dirname, 'dedupe.js'));

const CITY_EQUIVALENCES = { tokio: 'tokyo', kioto: 'kyoto' };

/* normalizeName (dedupe.js) + equivalencias de ciudad palabra a palabra, para
   que "Tokio Skytree" y "Tokyo Skytree" (o "Kioto"/"Kyoto" sueltos) empareje
   sin necesitar coincidencia de coordenadas. */
function normalizeNameForTwins(s){
  return normalizeName(s).split(' ').map(w => CITY_EQUIVALENCES[w] || w).join(' ');
}

const ESTADO_PRIORITY = { confirmado: 3, propuesta: 2, idea: 1 };
const DEFAULT_PROCEDENCIA_PRIORITY = ['ours', 'ai', 'dani', 'maria', 'instagram'];

/* Union-find clásico por id, sin dependencias externas. */
function makeUnionFind(ids){
  const parent = new Map(ids.map(id => [id, id]));
  function find(x){ while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; }
  function union(a, b){ const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); }
  return { find, union };
}

/* twinGroups: TWIN_GROUPS de v2 tal cual ([{anchor, members: [...]}]), o [].
   opts.isExcludedFromCoordMatch(id): true si ese id nunca debe emparejarse
   por coordenadas (punto 2 de la Decisión). opts.maxMeters: 150 por defecto.
   opts.procedenciaPriority: orden de desempate al elegir id canónico cuando
   no hay ancla de TWIN_GROUPS en el grupo. */
function groupCanonical(items, twinGroups, opts){
  opts = opts || {};
  const maxMeters = opts.maxMeters || 150;
  const isExcluded = opts.isExcludedFromCoordMatch || (() => false);
  const procedenciaPriority = opts.procedenciaPriority || DEFAULT_PROCEDENCIA_PRIORITY;

  const byId = new Map(items.map(it => [it.id, it]));
  const ids = items.map(it => it.id);
  const uf = makeUnionFind(ids);
  const anchorIds = new Set();

  // 1) TWIN_GROUPS de v2: fusión SIEMPRE, sin mirar nombre ni distancia.
  for (const g of (twinGroups || [])) {
    if (!byId.has(g.anchor)) continue;
    anchorIds.add(g.anchor);
    for (const m of g.members) if (byId.has(m)) uf.union(g.anchor, m);
  }

  // 2) Nombre normalizado (con equivalencias) Y coordenadas <maxMeters,
  //    saltando cualquier pareja donde alguno de los dos esté excluido del
  //    lado de coordenadas.
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = byId.get(ids[i]), b = byId.get(ids[j]);
      const nameEq = a.nombre && b.nombre && normalizeNameForTwins(a.nombre) === normalizeNameForTwins(b.nombre);
      if (!nameEq) continue;
      if (isExcluded(a.id) || isExcluded(b.id)) continue;
      const dist = haversineMeters(a.ubicacion, b.ubicacion);
      if (dist != null && dist < maxMeters) uf.union(a.id, b.id);
    }
  }

  // 3) Colapsa cada componente conexo de tamaño > 1 en un ítem canónico.
  const groups = new Map(); // raíz -> [ids]
  for (const id of ids) {
    const root = uf.find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }

  const result = [];
  const merges = [];
  for (const members of groups.values()) {
    if (members.length === 1) { result.push(byId.get(members[0])); continue; }

    const memberItems = members.map(id => byId.get(id)).sort((a, b) => (a.id < b.id ? -1 : 1));
    const anchor = members.find(id => anchorIds.has(id));
    const winningItem = memberItems.reduce((best, it) =>
      ESTADO_PRIORITY[it.estado] > ESTADO_PRIORITY[best.estado] ? it : best);
    const canonicalId = anchor || memberItems.slice().sort((x, y) => {
      const px = procedenciaPriority.indexOf(x.procedencia), py = procedenciaPriority.indexOf(y.procedencia);
      const rx = px === -1 ? 999 : px, ry = py === -1 ? 999 : py;
      return rx !== ry ? rx - ry : (x.id < y.id ? -1 : 1);
    })[0].id;

    const procedencias = [...new Set(memberItems.map(it => it.procedencia))].sort();
    const idsOriginales = memberItems.map(it => it.id);

    result.push(Object.assign({}, winningItem, { id: canonicalId, procedencias, idsOriginales }));
    merges.push({ canonicalId, idsOriginales, procedencias, estado: winningItem.estado });
  }

  return { items: result, merges };
}

/* Nivel 3: candidatos que siguen sueltos tras el nivel 1. Reutiliza el
   informe general (más laxo: nombre O coordenadas) sobre el resultado YA
   canonicalizado — nunca vuelve a proponer lo que el nivel 1 ya resolvió. */
function residualDuplicates(canonicalItems, opts){
  return findPotentialDuplicates(canonicalItems, opts);
}

if (typeof module !== 'undefined') {
  module.exports = {
    normalizeNameForTwins, groupCanonical, residualDuplicates,
    ESTADO_PRIORITY, DEFAULT_PROCEDENCIA_PRIORITY
  };
}
