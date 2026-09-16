// v3 · helpers de la agenda de un día (Fase 4, Bloque 3). No depende de
// index.html: prueba directamente v3/lib/agenda.js.
const path = require('path');
const { horaDe, duracionMinutos, tienePendiente, iconoEstado, contarSinDatos } =
  require(path.join(__dirname, '..', 'v3', 'lib', 'agenda.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const parada = (over) => Object.assign({ id: 'x', nombre: 'X', tipo: 'lugar', estado: 'propuesta', acciones: [], fechaHora: null }, over);

// --- horaDe / duracionMinutos: nunca inventan, solo leen lo que hay ---
check('horaDe: extrae HH:MM de un inicio con hora', horaDe(parada({ fechaHora: { inicio: '2027-04-12T10:30', fin: null } })) === '10:30');
check('horaDe: null si el inicio no trae hora (solo fecha)', horaDe(parada({ fechaHora: { inicio: '2027-04-12', fin: null } })) === null);
check('duracionMinutos: calcula bien entre inicio y fin reales',
  duracionMinutos(parada({ fechaHora: { inicio: '2027-04-12T10:30', fin: '2027-04-12T12:15' } })) === 105);
check('duracionMinutos: null si falta el fin (nunca inventa una duración)',
  duracionMinutos(parada({ fechaHora: { inicio: '2027-04-12T10:30', fin: null } })) === null);
check('duracionMinutos: null si no hay fechaHora en absoluto', duracionMinutos(parada({ fechaHora: null })) === null);

// --- tienePendiente / iconoEstado ---
check('tienePendiente: true si hay una acción necesaria y no hecha',
  tienePendiente(parada({ acciones: [{ necesaria: true, hecho: false }] })));
check('tienePendiente: false si la única acción ya está hecha',
  !tienePendiente(parada({ acciones: [{ necesaria: true, hecho: true }] })));
check('iconoEstado: 🎫 manda sobre el estado si hay reserva pendiente',
  iconoEstado(parada({ estado: 'confirmado', acciones: [{ necesaria: true, hecho: false }] })) === '🎫');
check('iconoEstado: ✅ para confirmado sin pendientes', iconoEstado(parada({ estado: 'confirmado' })) === '✅');
check('iconoEstado: 🟡 para propuesta sin pendientes', iconoEstado(parada({ estado: 'propuesta' })) === '🟡');

// --- contarSinDatos: el informe honesto por día ---
{
  const dia = [
    parada({ id: 'a', fechaHora: { inicio: '2027-04-12T09:00', fin: '2027-04-12T09:20' } }), // hora+duración OK
    parada({ id: 'b', fechaHora: { inicio: '2027-04-12', fin: null } }), // sin hora (y por tanto sin duración)
    parada({ id: 'c', fechaHora: { inicio: '2027-04-12T10:00', fin: null } }), // con hora, sin duración
    parada({ id: 'trayecto-1', tipo: 'trayecto', fechaHora: { inicio: '2027-04-12', fin: null } }) // trayecto sin duración
  ];
  const conteo = contarSinDatos(dia);
  check('contarSinDatos: sinHora cuenta solo paradas sin hora (1, no el trayecto)', conteo.sinHora === 1);
  check('contarSinDatos: sinDuracion cuenta paradas sin fin (b y c = 2)', conteo.sinDuracion === 2);
  check('contarSinDatos: desplazamientosSinDefinir cuenta trayectos sin duración (1)', conteo.desplazamientosSinDefinir === 1);
}
check('contarSinDatos: un día vacío da todo a 0, no revienta',
  JSON.stringify(contarSinDatos([])) === JSON.stringify({ sinHora: 0, sinDuracion: 0, desplazamientosSinDefinir: 0 }));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
