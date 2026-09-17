// v3 · Fase 6: fusión única de migración y cola de escrituras offline. No
// depende de Firebase real: prueba directamente v3/lib/sync.js.
const path = require('path');
const { fusionInicialHecho, fusionInicialEstado, encolarEscritura, quitarDeCola, rutaHecho, rutaEstado } =
  require(path.join(__dirname, '..', 'v3', 'lib', 'sync.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// --- fusionInicialHecho: "hecho gana", nunca se pierde un true de ningún lado ---
{
  const local = { 'usj::entrada': true, 'toshogu::reserva': true };
  const remoto = { 'usj::entrada': false, 'teamlab_kyoto::reserva': true };
  const out = fusionInicialHecho(local, remoto);
  check('fusionInicialHecho: local=true gana sobre remoto=false', out['usj::entrada'] === true);
  check('fusionInicialHecho: conserva lo que solo está en local', out['toshogu::reserva'] === true);
  check('fusionInicialHecho: conserva lo que solo está en remoto', out['teamlab_kyoto::reserva'] === true);
}
check('fusionInicialHecho: local vacío da el remoto tal cual', JSON.stringify(fusionInicialHecho({}, { a: true })) === JSON.stringify({ a: true }));
check('fusionInicialHecho: remoto vacío da el local tal cual (solo los true)',
  JSON.stringify(fusionInicialHecho({ a: true }, {})) === JSON.stringify({ a: true }));
check('fusionInicialHecho: no muta ninguno de los dos objetos de entrada', (() => {
  const local = { a: true }, remoto = { b: true };
  fusionInicialHecho(local, remoto);
  return JSON.stringify(local) === JSON.stringify({ a: true }) && JSON.stringify(remoto) === JSON.stringify({ b: true });
})());

// --- fusionInicialEstado: solo-local y solo-remoto sobreviven, el choque lo gana remoto ---
{
  const local = { usj: { estado: 'confirmado', notaReserva: 'nota local vieja' }, toshogu: { estado: 'confirmado', notaReserva: null } };
  const remoto = { usj: { estado: 'confirmado', notaReserva: 'nota remota' } };
  const out = fusionInicialEstado(local, remoto);
  check('fusionInicialEstado: choque (mismo ítem en los dos) lo gana el remoto', out.usj.notaReserva === 'nota remota');
  check('fusionInicialEstado: lo que solo está en local sobrevive', out.toshogu && out.toshogu.estado === 'confirmado');
}
check('fusionInicialEstado: local vacío da el remoto tal cual', JSON.stringify(fusionInicialEstado({}, { a: { estado: 'confirmado' } })) === JSON.stringify({ a: { estado: 'confirmado' } }));

// --- Cola de escrituras: una entrada por RUTA, la última gana ---
{
  let cola = [];
  cola = encolarEscritura(cola, rutaHecho('usj', 'entrada'), true);
  check('encolarEscritura: primera escritura queda en la cola', cola.length === 1 && cola[0].ruta === 'hechoOverrides/usj::entrada');
  cola = encolarEscritura(cola, rutaEstado('usj'), { estado: 'confirmado' });
  check('encolarEscritura: dos rutas distintas conviven', cola.length === 2);
  cola = encolarEscritura(cola, rutaHecho('usj', 'entrada'), null);
  check('encolarEscritura: la MISMA ruta se sustituye, no se acumula (marcar y deshacer offline = solo el resultado final)',
    cola.length === 2 && cola.find(e => e.ruta === 'hechoOverrides/usj::entrada').valor === null);
  cola = quitarDeCola(cola, rutaEstado('usj'));
  check('quitarDeCola: quita solo la ruta confirmada, deja el resto', cola.length === 1 && cola[0].ruta === 'hechoOverrides/usj::entrada');
}

// --- rutaHecho/rutaEstado: separador estable, sin ambigüedad con ids que ya traigan ':' ---
check('rutaHecho: usa el mismo separador que hecho-overrides.js (::)', rutaHecho('usj', 'entrada') === 'hechoOverrides/usj::entrada');
check('rutaEstado: una ruta por ítem, sin accionId', rutaEstado('id_kyoto_guesthouse') === 'estadoOverrides/id_kyoto_guesthouse');

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
