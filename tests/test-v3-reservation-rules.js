// v3 · reglas de reserva verificadas que enganchan a un RouteItem existente
// (V3-DESIGN.md §E). No depende de index.html: prueba directamente
// v3/lib/reservation-rules.js.
const path = require('path');
const { RESERVATION_RULES, computeAbreEn, attachReservationRules } =
  require(path.join(__dirname, '..', 'v3', 'lib', 'reservation-rules.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// --- computeAbreEn: "3 meses antes" de una fecha de viaje real ---
check('computeAbreEn: 3 meses antes del 23-abr-2027 es el 23-ene-2027',
  JSON.stringify(computeAbreEn({ year: 2027, month: 4, day: 23 }, { monthsBefore: 3 })) ===
  JSON.stringify({ fecha: '2027-01-23', hora: null, zona: null }));

// --- attachReservationRules: añade la acción al ítem existente, no lo sustituye ---
{
  const items = [
    { id: 'usj', nombre: 'Universal Studios Japan', estado: 'propuesta', acciones: [] },
    { id: 'toshogu', nombre: 'Santuario Tōshōgū', estado: 'propuesta', acciones: [] }
  ];
  const { items: out, noEncontrados } = attachReservationRules(items, RESERVATION_RULES);
  const usj = out.find(it => it.id === 'usj');
  check('attachReservationRules: usj gana 2 acciones (entrada + expressPass)', usj.acciones.length === 2);
  check('attachReservationRules: la acción "entrada" trae abreEn 2027-01-23', usj.acciones.find(a => a.id === 'entrada').abreEn.fecha === '2027-01-23');
  check('attachReservationRules: toshogu gana 1 acción SIN abreEn (sin regla exacta -> vigilar)',
    out.find(it => it.id === 'toshogu').acciones.length === 1 && out.find(it => it.id === 'toshogu').acciones[0].abreEn === null);
  check('attachReservationRules: teamlab_kyoto no existía en items -> se reporta en noEncontrados, no revienta',
    noEncontrados.includes('teamlab_kyoto::reserva'));
}

// --- Sanity: las 4 reglas reales apuntan a ids/acciones distintos (sin typos duplicados) ---
{
  const claves = RESERVATION_RULES.map(r => r.itemId + '::' + r.accionId);
  check('RESERVATION_RULES: sin claves itemId+accionId repetidas', new Set(claves).size === claves.length);
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
