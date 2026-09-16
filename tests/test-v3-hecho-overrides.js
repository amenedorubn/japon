// v3 · overrides locales de "hecho": marcar Y deshacer (Decisión 2026-09-16).
// No depende de index.html: prueba directamente v3/lib/hecho-overrides.js.
const path = require('path');
const { markDone, undoDone, isOverridden, applyOverrides } =
  require(path.join(__dirname, '..', 'v3', 'lib', 'hecho-overrides.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// --- markDone / undoDone / isOverridden: ciclo completo ---
{
  let overrides = {};
  check('isOverridden: nada marcado al principio', !isOverridden(overrides, 'usj', 'entrada'));

  overrides = markDone(overrides, 'usj', 'entrada');
  check('markDone: queda marcado', isOverridden(overrides, 'usj', 'entrada'));
  check('markDone: NO devuelve el mismo objeto (puro, no muta)', Object.keys(overrides).length === 1);

  overrides = undoDone(overrides, 'usj', 'entrada');
  check('undoDone: deshace la marca', !isOverridden(overrides, 'usj', 'entrada'));
  check('undoDone: no deja restos (la clave desaparece, no queda en false)', Object.keys(overrides).length === 0);
}

// --- No confunde acciones de ítems distintos con el mismo accionId ---
{
  let overrides = markDone({}, 'usj', 'entrada');
  check('markDone: no marca por error otra acción con el mismo accionId de OTRO ítem',
    !isOverridden(overrides, 'toshogu', 'entrada'));
}

// --- applyOverrides: el override manda sobre lo que diga el JSON importado ---
{
  const items = [
    { id: 'usj', nombre: 'USJ', acciones: [{ id: 'entrada', necesaria: true, hecho: false }] }
  ];
  const overrides = markDone({}, 'usj', 'entrada');
  const out = applyOverrides(items, overrides);
  check('applyOverrides: hecho pasa a true aunque el JSON de origen diga false',
    out[0].acciones[0].hecho === true);

  const outDeshecho = applyOverrides(items, undoDone(overrides, 'usj', 'entrada'));
  check('applyOverrides: al deshacer, vuelve a reflejar el false de origen',
    outDeshecho[0].acciones[0].hecho === false);
}

// --- Ciclo completo tipo "test que lo demuestre": marcar -> deshacer -> sigue en pendientes ---
{
  const model = require(path.join(__dirname, '..', 'v3', 'lib', 'model.js'));
  const items = [
    { id: 'usj', nombre: 'USJ', tipo: 'lugar', procedencia: 'ai', estado: 'propuesta',
      acciones: [{ id: 'entrada', necesaria: true, hecho: false,
        abreEn: { fecha: '2027-01-23', hora: null, zona: null }, reglaApertura: '3 meses antes', horaConfirmada: false }] }
  ];
  const ahora = Date.UTC(2026, 8, 16);

  let overrides = {};
  let view = model.pendientesView(applyOverrides(items, overrides), ahora);
  check('ciclo: al principio está en conFecha (nivel 2), no en hechos', view.conFecha.length === 1 && view.hechos.length === 0);

  overrides = markDone(overrides, 'usj', 'entrada');
  view = model.pendientesView(applyOverrides(items, overrides), ahora);
  check('ciclo: tras marcar, pasa a hechos', view.conFecha.length === 0 && view.hechos.length === 1);

  overrides = undoDone(overrides, 'usj', 'entrada');
  view = model.pendientesView(applyOverrides(items, overrides), ahora);
  check('ciclo: tras deshacer, VUELVE a pendientes (conFecha), ya no está en hechos',
    view.conFecha.length === 1 && view.conFecha[0].itemId === 'usj' && view.hechos.length === 0);

  // "persiste tras recargar" se simula recreando `overrides` desde cero JSON
  // (igual que storage.getJSON lo haría al releer localStorage tras un F5).
  const overridesTrasRecargar = JSON.parse(JSON.stringify(overrides));
  const viewTrasRecargar = model.pendientesView(applyOverrides(items, overridesTrasRecargar), ahora);
  check('ciclo: el deshacer persiste tras "recargar" (round-trip JSON)',
    viewTrasRecargar.conFecha.length === 1 && viewTrasRecargar.hechos.length === 0);
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
