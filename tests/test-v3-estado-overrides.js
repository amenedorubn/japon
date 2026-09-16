// v3 · overrides locales de "reservado" (Fase 5): marcar Y deshacer un ÍTEM
// como confirmado a mano. No depende de index.html: prueba directamente
// v3/lib/estado-overrides.js.
const path = require('path');
const { markConfirmado, undoConfirmado, isConfirmadoOverride, applyEstadoOverrides } =
  require(path.join(__dirname, '..', 'v3', 'lib', 'estado-overrides.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// --- markConfirmado / undoConfirmado / isConfirmadoOverride: ciclo completo ---
{
  let overrides = {};
  check('isConfirmadoOverride: nada marcado al principio', !isConfirmadoOverride(overrides, 'usj'));

  overrides = markConfirmado(overrides, 'usj', 'entrada', null);
  check('markConfirmado: queda marcado', isConfirmadoOverride(overrides, 'usj'));
  check('markConfirmado: NO devuelve el mismo objeto (puro, no muta)', Object.keys(overrides).length === 1);

  overrides = undoConfirmado(overrides, 'usj');
  check('undoConfirmado: deshace la marca', !isConfirmadoOverride(overrides, 'usj'));
  check('undoConfirmado: no deja restos (la clave desaparece)', Object.keys(overrides).length === 0);
}

// --- No confunde ítems distintos ---
{
  let overrides = markConfirmado({}, 'usj', 'entrada', null);
  check('markConfirmado: no marca por error otro ítem', !isConfirmadoOverride(overrides, 'toshogu'));
}

// --- applyEstadoOverrides: el override manda sobre el estado del JSON importado ---
{
  const items = [
    { id: 'usj', nombre: 'USJ', estado: 'propuesta', tipo: 'lugar' }
  ];
  const overrides = markConfirmado({}, 'usj', 'entrada', 'Localizador ABC123, 45€');
  const out = applyEstadoOverrides(items, overrides);
  check('applyEstadoOverrides: estado pasa a confirmado aunque el JSON diga propuesta',
    out[0].estado === 'confirmado');
  check('applyEstadoOverrides: estadoManual queda true', out[0].estadoManual === true);
  check('applyEstadoOverrides: notaReserva se guarda tal cual', out[0].notaReserva === 'Localizador ABC123, 45€');
  check('applyEstadoOverrides: accionReservadaId queda para el Deshacer permanente', out[0].accionReservadaId === 'entrada');
  check('applyEstadoOverrides: un ítem SIN override no cambia', out.length === 1 && items[0].estado === 'propuesta');

  const outDeshecho = applyEstadoOverrides(items, undoConfirmado(overrides, 'usj'));
  check('applyEstadoOverrides: al deshacer, vuelve al estado de origen',
    outDeshecho[0].estado === 'propuesta' && outDeshecho[0].estadoManual === undefined);
}

// --- nota vacía/omitida: null, no cadena vacía escondida como "algo" ---
{
  const overrides = markConfirmado({}, 'toshogu', 'entrada');
  check('markConfirmado sin nota guarda notaReserva null', overrides.toshogu.notaReserva === null);
}

// --- round-trip JSON (simula recargar tras cerrar la app) ---
{
  const items = [{ id: 'usj', nombre: 'USJ', estado: 'idea', tipo: 'lugar' }];
  let overrides = markConfirmado({}, 'usj', 'entrada', 'nota');
  const overridesTrasRecargar = JSON.parse(JSON.stringify(overrides));
  const out = applyEstadoOverrides(items, overridesTrasRecargar);
  check('round-trip JSON: el override persiste tras "recargar"', out[0].estado === 'confirmado');
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
