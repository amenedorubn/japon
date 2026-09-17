// v3 · agrupación canónica de duplicados, dedup en 3 niveles (V3-DESIGN.md,
// Decisión 2026-09-16). No depende de index.html: prueba directamente
// v3/lib/twins.js.
const path = require('path');
const { normalizeNameForTwins, groupCanonical, residualDuplicates, isRejectedPair, filterRejected, applyManualMerges, fuenteFromItem } =
  require(path.join(__dirname, '..', 'v3', 'lib', 'twins.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const it = (id, over) => Object.assign({
  id, nombre: id, tipo: 'lugar', procedencia: 'ai', estado: 'idea', ubicacion: null, acciones: []
}, over);

// --- normalizeNameForTwins: equivalencias Tokio=Tokyo, Kioto=Kyoto ---
check('normalizeNameForTwins: "Tokio Skytree" y "Tokyo Skytree" son el mismo nombre',
  normalizeNameForTwins('Tokio Skytree') === normalizeNameForTwins('Tokyo Skytree'));
check('normalizeNameForTwins: "Kioto" y "Kyoto" son el mismo nombre',
  normalizeNameForTwins('Kioto') === normalizeNameForTwins('Kyoto'));
check('normalizeNameForTwins: nombres realmente distintos siguen distintos',
  normalizeNameForTwins('Shibuya') !== normalizeNameForTwins('Shinjuku'));

// --- Nivel 1a: TWIN_GROUPS de v2 fusiona SIEMPRE, aunque estén lejos ---
{
  const items = [
    it('fushimi', { nombre: 'Fushimi Inari Taisha', procedencia: 'ai', estado: 'propuesta', ubicacion: { lat: 34.9671, lng: 135.7727 } }),
    it('dani_fushimi_inari', { nombre: 'Fushimi Inari-Taisha (nombre distinto a propósito)', procedencia: 'dani', ubicacion: { lat: 40.0, lng: 100.0 } })
  ];
  const twinGroups = [{ anchor: 'fushimi', members: ['dani_fushimi_inari'] }];
  const { items: out, merges } = groupCanonical(items, twinGroups);
  check('TWIN_GROUPS: fusiona la pareja aunque nombre y coordenadas no coincidan', out.length === 1);
  check('TWIN_GROUPS: el id canónico es el ANCLA (fushimi), no otro', out[0].id === 'fushimi');
  check('TWIN_GROUPS: procedencias trae las dos (ai, dani)',
    out[0].procedencias.length === 2 && out[0].procedencias.includes('ai') && out[0].procedencias.includes('dani'));
  check('TWIN_GROUPS: idsOriginales conserva los dos ids de origen',
    out[0].idsOriginales.includes('fushimi') && out[0].idsOriginales.includes('dani_fushimi_inari'));
  check('merges: reporta 1 fusión', merges.length === 1 && merges[0].canonicalId === 'fushimi');
}

// --- Nivel 1b: nombre Y distancia — las DOS condiciones a la vez ---
{
  const cerca = { lat: 35.0, lng: 135.0 };
  const lejos = { lat: 36.0, lng: 140.0 }; // muy lejos, > 150 m de sobra
  const items = [
    it('a', { nombre: 'Naramachi', ubicacion: cerca }),
    it('b', { nombre: 'Naramachi', ubicacion: { lat: 35.0005, lng: 135.0005 } }), // mismo nombre, <150m
    it('c', { nombre: 'Naramachi', ubicacion: lejos }), // mismo nombre, LEJOS: no debe fusionar
    it('d', { nombre: 'Otro Sitio Cualquiera', ubicacion: cerca }) // cerca, nombre distinto: no debe fusionar
  ];
  const { items: out } = groupCanonical(items, []);
  const grupoNaramachi = out.find(x => x.idsOriginales && x.idsOriginales.includes('a'));
  check('nombre+distancia: a y b se fusionan (mismo nombre, <150m)',
    grupoNaramachi && grupoNaramachi.idsOriginales.includes('b'));
  check('nombre+distancia: c NO se fusiona con a/b (mismo nombre pero lejos)',
    !grupoNaramachi.idsOriginales.includes('c') && out.some(x => x.id === 'c'));
  check('nombre+distancia: d NO se fusiona con nadie (cerca pero nombre distinto)',
    out.some(x => x.id === 'd'));
  check('nombre+distancia: total de salida es 3 (grupo a+b, c suelto, d suelto)', out.length === 3);
}

// --- Nivel 2: exclusión de hoteles/marcadores de centro de ciudad del lado de coordenadas ---
{
  const items = [
    it('hotel_falso', { nombre: 'Ciudad X', tipo: 'alojamiento', estado: 'confirmado', ubicacion: { lat: 10, lng: 10 } }),
    it('catalog_ciudadx', { nombre: 'Ciudad X (marcador de centro)', tipo: 'lugar', ubicacion: { lat: 10, lng: 10 } })
  ];
  // Nombres DISTINTOS a propósito (para no colar por nombre): esta pareja solo
  // podría fusionarse si el nombre+distancia coincidiera Y no hubiera exclusión.
  // Repetimos con el MISMO nombre para probar que, aun así, la exclusión corta
  // el lado de coordenadas si el llamador así lo pide.
  const itemsMismoNombre = [
    it('hotel_falso2', { nombre: 'Ciudad Y', tipo: 'alojamiento', estado: 'confirmado', ubicacion: { lat: 20, lng: 20 } }),
    it('marcador_y', { nombre: 'Ciudad Y', tipo: 'lugar', ubicacion: { lat: 20, lng: 20 } })
  ];
  const isExcludedFromCoordMatch = id => id === 'hotel_falso2' || id === 'marcador_y';
  const { items: out } = groupCanonical(itemsMismoNombre, [], { isExcludedFromCoordMatch });
  check('exclusión: NO fusiona aunque nombre y coordenadas coincidan, si ambos están excluidos',
    out.length === 2);

  const { items: outSinExclusion } = groupCanonical(itemsMismoNombre, []);
  check('sin exclusión (control): la MISMA pareja SÍ se fusiona', outSinExclusion.length === 1);
}

// --- Estado ganador: el grupo hereda el estado MÁS AVANZADO de sus miembros ---
{
  const items = [
    it('idea_x', { nombre: 'Sitio Compartido', procedencia: 'ai', estado: 'idea', ubicacion: { lat: 1, lng: 1 } }),
    it('propuesta_x', { nombre: 'Sitio Compartido', procedencia: 'dani', estado: 'propuesta', noche: 'noche-2027-04-10', ubicacion: { lat: 1.0001, lng: 1.0001 } })
  ];
  const { items: out } = groupCanonical(items, []);
  check('estado ganador: el grupo queda "propuesta" (el más avanzado de los dos)',
    out.length === 1 && out[0].estado === 'propuesta');
  check('estado ganador: hereda TAMBIÉN los demás campos del miembro ganador (noche)',
    out[0].noche === 'noche-2027-04-10');
}

// --- Fase 5b: fuentes[] conserva TODOS los campos de CADA miembro fusionado,
//     no solo los del ganador (prioridad nº1 de PROJECT.md: no perder datos) ---
{
  const items = [
    it('catalog_sensoji', { nombre: 'Templo Sensō-ji', procedencia: 'ours', estado: 'propuesta',
      ubicacion: { lat: 35.7148, lng: 139.7967 }, notes: 'El templo más antiguo de Tokio', price: 'Gratis' }),
    it('id_insta_sensoji', { nombre: 'Templo Sensō-ji', procedencia: 'instagram', estado: 'idea',
      ubicacion: { lat: 35.7148, lng: 139.7967 }, video: 'https://www.instagram.com/reel/abc123/' })
  ];
  const { items: out } = groupCanonical(items, []);
  check('fuentes[]: el grupo tiene 1 ítem canónico (fusión por nombre+distancia)', out.length === 1);
  const canon = out[0];
  check('fuentes[]: trae una entrada por cada miembro fusionado', canon.fuentes && canon.fuentes.length === 2);
  const fCatalog = canon.fuentes.find(f => f.id === 'catalog_sensoji');
  const fInsta = canon.fuentes.find(f => f.id === 'id_insta_sensoji');
  check('fuentes[]: la fuente "ours" conserva su notes/price aunque no gane', fCatalog.notes === 'El templo más antiguo de Tokio' && fCatalog.price === 'Gratis');
  check('fuentes[]: la fuente "instagram" conserva su video aunque pierda el estado', fInsta.video === 'https://www.instagram.com/reel/abc123/');
  check('fuenteFromItem: nunca incluye un campo vacío/null (no ensucia la ficha)', fCatalog.video === undefined);
}

// --- Fase 5b: applyManualMerges (nivel 3) también acumula fuentes[] ---
{
  const items = [
    it('catalog_x', { nombre: 'Catalog X', estado: 'propuesta', procedencia: 'ours', hours: '9:00-17:00' }),
    it('maria_x', { nombre: 'X', estado: 'idea', procedencia: 'maria', tip: 'Ir por la mañana' })
  ];
  const { items: out } = applyManualMerges(items, [{ canonicalId: 'catalog_x', absorbe: ['maria_x'] }]);
  const canon = out.find(x => x.id === 'catalog_x');
  check('applyManualMerges: fuentes[] trae las dos procedencias', canon.fuentes.length === 2);
  check('applyManualMerges: la fuente absorbida conserva su tip', canon.fuentes.find(f => f.id === 'maria_x').tip === 'Ir por la mañana');
  check('applyManualMerges: la fuente ganadora conserva su hours', canon.fuentes.find(f => f.id === 'catalog_x').hours === '9:00-17:00');
}

// --- id canónico sin ancla: prioridad de procedencia, con desempate alfabético ---
{
  const items = [
    it('zzz_maria', { nombre: 'Sitio Sin Ancla', procedencia: 'maria', ubicacion: { lat: 5, lng: 5 } }),
    it('aaa_dani', { nombre: 'Sitio Sin Ancla', procedencia: 'dani', ubicacion: { lat: 5.0001, lng: 5.0001 } })
  ];
  const { items: out } = groupCanonical(items, []);
  check('sin ancla: gana la procedencia de mayor prioridad (dani > maria), no el orden alfabético',
    out.length === 1 && out[0].id === 'aaa_dani');
}

// --- residualDuplicates: lo que sigue suelto tras el nivel 1 se puede re-detectar ---
{
  const canonicalItems = [
    it('solo1', { nombre: 'Cosa Rara', ubicacion: { lat: 1, lng: 1 } }),
    it('solo2', { nombre: 'Cosa Rara', ubicacion: { lat: 50, lng: 50 } }) // mismo nombre, lejísimos: nivel 1 no los fusiona
  ];
  const residuales = residualDuplicates(canonicalItems);
  check('residualDuplicates: encuentra el par que compartía nombre pero quedó suelto',
    residuales.some(d => (d.a === 'solo1' && d.b === 'solo2') || (d.a === 'solo2' && d.b === 'solo1')));
}

// --- applyManualMerges: nivel 3 aprobado, import/v3-manual-merges.json ---
{
  const items = [
    it('catalog_x', { nombre: 'Catalog X', estado: 'propuesta', procedencia: 'ours' }),
    it('maria_x', { nombre: 'X', estado: 'idea', procedencia: 'maria' }),
    it('dani_y', { nombre: 'Y suelto', estado: 'idea', procedencia: 'dani' }) // no tocado
  ];
  const aprobadas = [{ canonicalId: 'catalog_x', absorbe: ['maria_x'] }];
  const { items: out } = applyManualMerges(items, aprobadas);
  check('applyManualMerges: el id absorbido desaparece de la lista', !out.some(x => x.id === 'maria_x'));
  check('applyManualMerges: el canónico sigue con su id (la parada manda)', out.some(x => x.id === 'catalog_x'));
  check('applyManualMerges: un ítem no mencionado no se toca', out.some(x => x.id === 'dani_y'));
}
{
  const items = [
    it('catalog_x', { nombre: 'Catalog X', estado: 'propuesta', procedencia: 'ours' }),
    it('maria_x', { nombre: 'X', estado: 'idea', procedencia: 'maria' })
  ];
  const { items: out } = applyManualMerges(items, [{ canonicalId: 'catalog_x', absorbe: ['maria_x'] }]);
  const canon = out.find(x => x.id === 'catalog_x');
  check('applyManualMerges: procedencias trae ours Y maria',
    canon.procedencias.includes('ours') && canon.procedencias.includes('maria'));
  check('applyManualMerges: idsOriginales trae los dos ids', canon.idsOriginales.includes('catalog_x') && canon.idsOriginales.includes('maria_x'));
  check('applyManualMerges: total queda en 1 (se consumió maria_x)', out.length === 1);
}

// --- applyManualMerges: nunca aplica propuesta↔propuesta ni id inexistente, lo reporta ---
{
  const items = [
    it('a_prop', { estado: 'propuesta' }),
    it('b_prop', { estado: 'propuesta' })
  ];
  const { items: out, omitidas } = applyManualMerges(items, [{ canonicalId: 'a_prop', absorbe: ['b_prop', 'no_existe'] }]);
  check('applyManualMerges: NO fusiona propuesta↔propuesta, aunque se lo pidan', out.length === 2);
  check('applyManualMerges: reporta por qué se omitió (estado)', omitidas.some(o => o.id === 'b_prop'));
  check('applyManualMerges: reporta id inexistente sin reventar', omitidas.some(o => o.id === 'no_existe'));
}

// --- applyManualMerges: idea↔idea SÍ se permite (duplicado interno del catálogo, ninguno es una parada) ---
{
  const items = [
    it('kuromonmaru', { nombre: 'Kuromonmaru (melón)', procedencia: 'ai', estado: 'idea' }),
    it('id_insta_kuromonmaru', { nombre: 'Kuromonmaru', procedencia: 'instagram', estado: 'idea' })
  ];
  const { items: out, omitidas } = applyManualMerges(items, [{ canonicalId: 'kuromonmaru', absorbe: ['id_insta_kuromonmaru'] }]);
  check('applyManualMerges: idea↔idea SÍ se fusiona (no exige que el canónico sea propuesta/confirmado)',
    out.length === 1 && out[0].id === 'kuromonmaru' && omitidas.length === 0);
  check('applyManualMerges: idea↔idea también acumula procedencias', out[0].procedencias.includes('instagram'));
}

// --- filterRejected / isRejectedPair: idempotencia del nivel 3 ---
{
  const rechazadas = [{ a: 'x', b: 'y', motivo: 'prueba' }];
  check('isRejectedPair: detecta el par en cualquier orden', isRejectedPair(rechazadas, 'y', 'x'));
  check('isRejectedPair: un par no rechazado da false', !isRejectedPair(rechazadas, 'x', 'z'));
  const candidatos = [{ a: 'x', b: 'y' }, { a: 'x', b: 'z' }];
  const filtrados = filterRejected(candidatos, rechazadas);
  check('filterRejected: quita el par rechazado y deja el resto', filtrados.length === 1 && filtrados[0].b === 'z');
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
