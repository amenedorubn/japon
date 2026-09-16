// v3 · trayectos de tren/bus como RouteItem (Fase 4, V3-DESIGN.md).
// No depende de index.html: prueba directamente v3/lib/trayectos.js contra
// EL TRANSPORT real de index.html (extraído con el mismo mecanismo que
// tools/v3-migrate-import.js), para detectar de inmediato si TRANSPORT
// cambia de forma sin actualizar TRANSPORT_RULES.
const fs = require('fs');
const path = require('path');
const { TRANSPORT_RULES, computeAbreEn, buildTrayectoItems } =
  require(path.join(__dirname, '..', 'v3', 'lib', 'trayectos.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

function loadRealTransport(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>\s*<\/body>/);
  const appJs = m[1];
  const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
    '"use strict";' + appJs + ';return { TRANSPORT };');
  const noop = () => {};
  const stubEl = { style: {}, classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, appendChild: noop,
    setAttribute: noop, getAttribute: () => null, addEventListener: noop, querySelector: () => stubEl, querySelectorAll: () => [] };
  return boot(
    { documentElement: { setAttribute: noop, getAttribute: () => null }, querySelector: () => stubEl, querySelectorAll: () => [], createElement: () => stubEl, body: stubEl },
    {}, { getItem: () => null, setItem: noop, removeItem: noop }, { hash: '', href: '' }, { pushState: noop, replaceState: noop },
    {}, () => Promise.resolve({ ok: true, json: async () => [] }), () => 0, () => true
  ).TRANSPORT;
}

const TRANSPORT = loadRealTransport();

check('TRANSPORT_RULES tiene la MISMA longitud que el TRANSPORT real de index.html',
  TRANSPORT_RULES.length === TRANSPORT.length);

// --- computeAbreEn: 1 mes antes de un día del mes, con y sin hora ---
check('computeAbreEn: 1 mes antes del día 16 (abril) es el 16 de marzo, con hora',
  JSON.stringify(computeAbreEn(2027, 16, { monthsBefore: 1, hora: '10:00', zona: 'Asia/Tokyo' })) ===
  JSON.stringify({ fecha: '2027-03-16', hora: '10:00', zona: 'Asia/Tokyo' }));
check('computeAbreEn: sin monthsBefore devuelve null (nivel 4, sin fecha que inventar)',
  computeAbreEn(2027, 26, { monthsBefore: null }) === null);

// --- buildTrayectoItems contra el TRANSPORT real ---
{
  const { items, avisos } = buildTrayectoItems(TRANSPORT, 2027);
  check('buildTrayectoItems: un RouteItem por fila de TRANSPORT', items.length === TRANSPORT.length);
  check('buildTrayectoItems: todos son tipo trayecto, estado propuesta',
    items.every(it => it.tipo === 'trayecto' && it.estado === 'propuesta'));
  check('buildTrayectoItems: sin avisos de desajuste día-mes (TRANSPORT no cambió sin avisar)', avisos.length === 0);

  const smartEX = items.find(it => it.fechaHora.inicio === '2027-04-16' && it.nombre.includes('Kioto'));
  check('buildTrayectoItems: el tramo smartEX de Nagoya→Kioto (16 abr) trae nivel 1 real (hora+zona+horaConfirmada)',
    smartEX && smartEX.acciones.length === 1 &&
    smartEX.acciones[0].abreEn.fecha === '2027-03-16' && smartEX.acciones[0].abreEn.hora === '10:00' &&
    smartEX.acciones[0].horaConfirmada === true);

  const hida = items.find(it => it.fechaHora.inicio === '2027-04-16' && it.nombre.includes('Nagoya') && !it.nombre.includes('Kioto'));
  check('buildTrayectoItems: Hida (día 16, sin investigar) NO trae ninguna acción inventada', hida && hida.acciones.length === 0);

  const kawaguchiko = items.find(it => it.fechaHora.inicio === '2027-04-26');
  check('buildTrayectoItems: bus Kawaguchiko SÍ investigado pero SIN regla -> accion con abreEn null (nivel 4)',
    kawaguchiko && kawaguchiko.acciones.length === 1 && kawaguchiko.acciones[0].abreEn === null);
}

// --- Fila desajustada: TRANSPORT_RULES mal alineado se detecta, no se calla ---
{
  const fake = [['obl', 'Día 99', 'X → Y', '']];
  const RULES_BACKUP = TRANSPORT_RULES[0].diaMes;
  // Probamos contra la regla real de índice 0 (día 12): un TRANSPORT falso con "Día 99" debe avisar.
  const { avisos } = buildTrayectoItems(fake.concat(TRANSPORT.slice(1)), 2027);
  check('buildTrayectoItems: detecta un "Día N" que no coincide con TRANSPORT_RULES y lo avisa',
    avisos.some(a => a.includes('día 99') || a.includes('99')));
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
