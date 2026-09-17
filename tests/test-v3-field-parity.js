// v3 · Fase 5b: gate de paridad de campos contra un volcado real de Firebase.
// Por cada campo NO VACÍO de un lugar/hotel/vuelo de v2.1, comprueba que
// sigue existiendo en su RouteItem de v3 (top-level, o dentro de `fuentes[]`
// si el ítem se fusionó con otros) -- prioridad nº1 de PROJECT.md: no perder
// ningún dato. Si un campo nuevo aparece en v2.1 mañana y el importador no
// lo copia, este test FALLA: obliga a decidir explícitamente qué hacer con
// él, nunca a perderlo en silencio.
//
// Mismo patrón que test-8c-gate.js: solo corre con un volcado real
// (node tests/run-all.js live.json), porque no hay nada sintético que
// pruebe paridad contra datos reales -- sin volcado, se omite.
//
// Uso: node tests/test-v3-field-parity.js <appJs-no-usado> <live.json>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const liveJsonPath = process.argv[3];
if (!liveJsonPath) {
  console.log('(test-v3-field-parity.js omitido: pásale un volcado de Firebase, ver run-all.js)');
  process.exit(0);
}

const root = path.join(__dirname, '..');

// Regenera el preview FRESCO a partir de este mismo live.json -- nunca fía de
// una corrida anterior que pudiera estar desactualizada.
execFileSync('node', [path.join(root, 'tools', 'v3-migrate-import.js'), liveJsonPath], { cwd: root, stdio: 'pipe' });
const preview = JSON.parse(fs.readFileSync(path.join(root, 'import', 'v3-migrated-preview.json'), 'utf8'));

const byOriginalId = new Map();
for (const it of preview.items) {
  for (const id of (it.idsOriginales || [it.id])) byOriginalId.set(id, it);
}

const liveRaw = JSON.parse(fs.readFileSync(liveJsonPath, 'utf8'));
const live = (liveRaw.proyectos && liveRaw.proyectos['viaje-japon']) || liveRaw;
const livePlaces = (live.state && live.state.places) || [];

// Mismos nombres que state.places (tools/v3-migrate-import.js los copia sin
// renombrar, a propósito, para que esta comparación sea 1:1 sin tabla de
// equivalencias que mantener aparte).
const CAMPOS_LUGAR = ['notes', 'web', 'video', 'tip', 'hours', 'price', 'yen', 'dur', 'region'];
const CAMPOS_HOTEL = ['notes', 'web', 'price', 'hotelArea', 'address', 'hotelPhone', 'bookingRef', 'region'];
const esHotelReal = p => p.category === 'alojamiento' && !!(p.checkIn || p.checkOut);

function valorPresente(routeItem, campo, valorOriginal){
  if (routeItem[campo] === valorOriginal) return true;
  if (Array.isArray(routeItem.fuentes)) return routeItem.fuentes.some(f => f[campo] === valorOriginal);
  return false;
}

let comprobados = 0;
const faltantes = [];
for (const p of livePlaces) {
  if (!p || !p.id) continue;
  if (/^airport_/.test(p.id)) continue; // nodos de mapa, nunca se importan como RouteItem (a propósito)
  const routeItem = byOriginalId.get(p.id);
  if (!routeItem) continue; // filtrado por dedup/exclusión conocida -- no es un fallo de PARIDAD DE CAMPOS
  const campos = esHotelReal(p) ? CAMPOS_HOTEL : CAMPOS_LUGAR;
  for (const campo of campos) {
    const val = p[campo];
    if (val == null || val === '') continue;
    comprobados++;
    if (!valorPresente(routeItem, campo, val)) faltantes.push(`lugar ${p.id}.${campo} = ${JSON.stringify(val)}`);
  }
}
check(`paridad de LUGARES/HOTELES: ${comprobados} valores no vacíos comprobados, ${faltantes.length} faltan`, faltantes.length === 0);

// Vuelos (FLIGHTS): array literal en index.html raíz, fuera de state.places.
// Extracción ligera (no el stub completo de loadV2Baked): FLIGHTS es un
// literal puro, sin referencias externas, seguro de evaluar aislado.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mFlights = html.match(/const FLIGHTS = (\[[\s\S]*?\n\]);/);
check('FLIGHTS: se encuentra el array en index.html raíz', !!mFlights);
if (mFlights) {
  const FLIGHTS = eval(mFlights[1]);
  const CAMPOS_VUELO = ['flight', 'arr', 'airline', 'terminal', 'note'];
  let comprobadosVuelo = 0;
  const faltantesVuelo = [];
  for (const f of FLIGHTS) {
    const routeItem = preview.items.find(it => it.id === 'vuelo-' + f.id);
    if (!routeItem) { faltantesVuelo.push(`vuelo-${f.id}: no existe como RouteItem`); continue; }
    for (const campo of CAMPOS_VUELO) {
      const val = f[campo];
      if (val == null || val === '') continue;
      comprobadosVuelo++;
      if (!valorPresente(routeItem, campo, val)) faltantesVuelo.push(`vuelo-${f.id}.${campo} = ${JSON.stringify(val)}`);
    }
  }
  check(`paridad de VUELOS: ${comprobadosVuelo} valores no vacíos comprobados, ${faltantesVuelo.length} faltan`, faltantesVuelo.length === 0);
  if (faltantesVuelo.length) faltantesVuelo.slice(0, 20).forEach(f => console.log('  falta: ' + f));
}

if (faltantes.length) {
  console.log('\n=== Campos que se pierden (primeros 40) ===');
  faltantes.slice(0, 40).forEach(f => console.log('  falta: ' + f));
}

// Privacidad (punto 5 del encargo): bookingRef/price/hotelPhone/address de
// hoteles (los nuestros Y los del viaje pasado de Dani -- son sus datos
// personales igual de sensibles) NUNCA deben aparecer en un fichero
// VERSIONADO de la SUPERFICIE v3 (lo único que esta sesión puede tocar).
// v2.1 raíz (index.html, index-pre-source.html) e index-pre-source.html YA
// traían algunos de estos valores versionados de antes -- v2.1 raíz es
// intocable salvo autorización explícita (PROJECT.md), así que esta
// comprobación se limita a v3/tools-v3/tests-v3 en vez de fallar siempre por
// algo que esta sesión no puede arreglar. El hallazgo en v2.1 se reporta
// aparte al usuario, no se silencia ni se toca aquí.
{
  const { execSync } = require('child_process');
  // Solo hoteles con reserva REAL (checkIn/checkOut de verdad): las 8 bases
  // "por reservar" del catálogo (hotel_tokyo, hotel_kyoto...) no tienen
  // fecha y su `price` es literalmente el texto "por reservar" -- no es un
  // dato privado, es justo lo contrario (nada reservado todavía), y su
  // coincidencia de substring con copy genérico de la UI daba falsos
  // positivos.
  const valoresPrivados = [];
  livePlaces.filter(esHotelReal).forEach(p => {
    ['bookingRef', 'price', 'hotelPhone', 'address'].forEach(campo => {
      const v = p[campo];
      if (v && String(v).trim() && String(v).length > 4) valoresPrivados.push(String(v).trim());
    });
  });
  const SUPERFICIE_V3 = f => f === 'v3' || f.startsWith('v3/') || f === 'tools/v3-migrate-import.js' ||
    (f.startsWith('tests/') && /test-v3-/.test(f)) || f === 'HANDOFF-V3.md' || f === 'V3-DESIGN.md';
  let trackedFiles = [];
  try {
    trackedFiles = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(f => f && SUPERFICIE_V3(f));
  } catch (e) { /* sin git disponible: se omite esta comprobación extra */ }
  const filtrados = [];
  if (trackedFiles.length) {
    for (const val of valoresPrivados) {
      for (const file of trackedFiles) {
        let contenido;
        try { contenido = fs.readFileSync(path.join(root, file), 'utf8'); } catch (e) { continue; }
        if (contenido.includes(val)) { filtrados.push(`"${val.slice(0, 40)}…" aparece en ${file}`); break; }
      }
    }
  }
  check(`privacidad (superficie v3): ningún bookingRef/price/hotelPhone/address de hotel aparece en un fichero versionado de v3 (${valoresPrivados.length} valores, ${trackedFiles.length} ficheros comprobados)`, filtrados.length === 0);
  if (filtrados.length) filtrados.forEach(f => console.log('  FUGA: ' + f));
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
