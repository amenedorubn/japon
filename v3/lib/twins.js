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

/* Fase 5b (auditoría de paridad, 2026-09-16): al fusionar 2+ ítems en uno
   canónico, el ganador (más `estado`) se quedaba con SUS campos y el resto
   solo sobrevivía como un id suelto en `idsOriginales` -- se perdían su nota,
   su enlace de Instagram, su precio... Ahora cada miembro deja un registro
   en `fuentes[]` con TODOS los campos ricos que aporte (no solo los
   distintos del ganador: eso es una decisión de presentación de la ficha,
   v3/index.html, nunca de los datos -- prioridad nº1 de PROJECT.md es no
   perder nada). Misma lista de campos que copia tools/v3-migrate-import.js,
   para los tres tipos de RouteItem que pueden llegar a fusionarse. */
const FUENTE_FIELDS = [
  'notes', 'web', 'video', 'tip', 'hours', 'price', 'yen', 'dur', 'region', 'categoria',
  'hotelArea', 'address', 'hotelPhone', 'bookingRef', 'flight', 'arr', 'airline', 'terminal', 'note'
];
function fuenteFromItem(it){
  const f = { id: it.id, procedencia: it.procedencia, nombre: it.nombre };
  FUENTE_FIELDS.forEach(function(k){ if (it[k] != null && it[k] !== '') f[k] = it[k]; });
  return f;
}

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
    const fuentes = memberItems.map(fuenteFromItem);

    result.push(Object.assign({}, winningItem, { id: canonicalId, procedencias, idsOriginales, fuentes }));
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

/* Un par (a,b) está en `rechazadas` (sin importar el orden). */
function isRejectedPair(rechazadas, a, b){
  return (rechazadas || []).some(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

/* Quita de una lista de candidatos (formato de residualDuplicates/con d.a,d.b)
   las parejas ya registradas como rechazadas, para no volver a proponerlas en
   futuras corridas del importador. */
function filterRejected(candidates, rechazadas){
  return (candidates || []).filter(d => !isRejectedPair(rechazadas, d.a, d.b));
}

/* Aplica las decisiones de revisión manual del nivel 3 (import/v3-manual-
   merges.json, §Decisión 2026-09-16): SIEMPRE el canonicalId es una parada
   propuesta/confirmado que absorbe ids sueltos, nunca al revés. Antes de
   fusionar, verifica que el id absorbido exista y que su estado sea 'idea'
   (nunca dos ítems "decididos" — propuesta o confirmado — entre sí; idea↔idea
   sí está permitido, p.ej. dos duplicados internos del catálogo que nunca
   llegaron a la Ruta): si la pareja viola eso, se salta y se reporta en
   `omitidas` en vez de aplicarse a ciegas — igual que el resto del pipeline,
   esto nunca inventa una fusión que los datos reales no sostienen. */
const ESTADOS_DECIDIDOS = new Set(['propuesta', 'confirmado']);
function applyManualMerges(items, aprobadas){
  const byId = new Map(items.map(it => [it.id, it]));
  const consumed = new Set();
  const omitidas = [];
  const aplicadas = [];

  for (const regla of (aprobadas || [])) {
    const canonical = byId.get(regla.canonicalId);
    if (!canonical) { omitidas.push({ regla, motivo: `canonicalId '${regla.canonicalId}' no existe en los ítems actuales` }); continue; }
    const absorbedItems = [];
    const absorbedOk = [];
    for (const id of regla.absorbe) {
      const it = byId.get(id);
      if (!it) { omitidas.push({ regla, id, motivo: `id '${id}' no existe en los ítems actuales` }); continue; }
      if (ESTADOS_DECIDIDOS.has(canonical.estado) && ESTADOS_DECIDIDOS.has(it.estado)) {
        omitidas.push({ regla, id, motivo: `'${regla.canonicalId}' (${canonical.estado}) y '${id}' (${it.estado}) son dos ítems decididos: nunca se fusionan entre sí` });
        continue;
      }
      absorbedItems.push(it);
      absorbedOk.push(id);
    }
    if (!absorbedOk.length) continue;

    const procedencias = new Set(canonical.procedencias || [canonical.procedencia]);
    const idsOriginales = new Set(canonical.idsOriginales || [canonical.id]);
    // Igual que en groupCanonical: cada miembro absorbido aporta su propia
    // `fuentes[]` (o, si es un ítem suelto sin fusión previa, se construye la
    // suya con fuenteFromItem) -- por id, para no duplicar si dos reglas
    // manuales tocan el mismo id en corridas sucesivas (idempotente).
    const fuentesMap = new Map((canonical.fuentes || [fuenteFromItem(canonical)]).map(f => [f.id, f]));
    for (const it of absorbedItems) {
      (it.procedencias || [it.procedencia]).forEach(p => procedencias.add(p));
      (it.idsOriginales || [it.id]).forEach(i => idsOriginales.add(i));
      (it.fuentes || [fuenteFromItem(it)]).forEach(f => fuentesMap.set(f.id, f));
      consumed.add(it.id);
    }
    byId.set(canonical.id, Object.assign({}, canonical, {
      procedencias: [...procedencias].sort(),
      idsOriginales: [...idsOriginales].sort(),
      fuentes: [...fuentesMap.values()]
    }));
    aplicadas.push({ canonicalId: canonical.id, absorbidos: absorbedOk });
  }

  const result = items
    .filter(it => !consumed.has(it.id))
    .map(it => byId.get(it.id));

  return { items: result, aplicadas, omitidas };
}

if (typeof module !== 'undefined') {
  module.exports = {
    normalizeNameForTwins, groupCanonical, residualDuplicates,
    isRejectedPair, filterRejected, applyManualMerges,
    ESTADO_PRIORITY, DEFAULT_PROCEDENCIA_PRIORITY, FUENTE_FIELDS, fuenteFromItem
  };
}
