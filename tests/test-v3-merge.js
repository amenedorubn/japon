// v3 · fusión segura importador ↔ nodo v3 (V3-DESIGN.md, Decisión 2026-09-16
// punto B: nada de fb.set a ciegas; y punto 3: lo creado solo en v3 no se
// borra nunca). No depende de index.html: prueba directamente v3/lib/merge.js.
const path = require('path');
const { mergeV3State } = require(path.join(__dirname, '..', 'v3', 'lib', 'merge.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const freshImport = () => ([
  {
    id: 'usj', nombre: 'USJ + Nintendo World', tipo: 'lugar', procedencia: 'ai', estado: 'idea',
    acciones: [{ id: 'reserva', necesaria: true, hecho: false, abreEn: null,
      reglaApertura: '3 meses antes', horaConfirmada: false, fuente: 'https://www.usj.co.jp/', verificadoEl: '2026-09-16' }]
  },
  {
    id: 'id_sunshine_kinugawa', nombre: 'Hotel Sunshine Kinugawa', tipo: 'alojamiento', procedencia: 'ours', estado: 'confirmado',
    acciones: []
  }
]);

// 1) SEMBRAR: nodo v3 vacío → el resultado es exactamente lo importado (con
//    notas/estadoManual inicializados).
{
  const { items, stats } = mergeV3State([], freshImport());
  check('sembrar: nodo vacío → 2 ítems, iguales a lo importado', items.length === 2);
  check('sembrar: cada ítem nuevo trae notas:null y estadoManual:false',
    items.every(it => it.notas === null && it.estadoManual === false));
  check('sembrar: stats cuenta 2 nuevos, 0 actualizados, 0 conservados solo-en-v3',
    stats.nuevos === 2 && stats.actualizados === 0 && stats.soloEnV3Conservados === 0);
}

// 2) SIMULAR EDICIÓN de un usuario sobre el nodo ya sembrado: marca el USJ
//    como reservado (hecho:true) y le añade una nota, y cambia el estado del
//    hotel a mano.
const sembrado = mergeV3State([], freshImport()).items;
const editado = sembrado.map(it => {
  if (it.id === 'usj') {
    return Object.assign({}, it, {
      notas: 'Reservado el 3 de febrero, confirmación #12345',
      acciones: it.acciones.map(a => a.id === 'reserva' ? Object.assign({}, a, { hecho: true }) : a)
    });
  }
  if (it.id === 'id_sunshine_kinugawa') {
    return Object.assign({}, it, { estado: 'propuesta', estadoManual: true }); // el usuario lo bajó a mano
  }
  return it;
});

// 3) REIMPORTAR: la fuente v2 no ha cambiado (mismo freshImport()), pero el
//    nodo v3 YA tiene la edición del usuario. La fusión debe conservarla.
{
  const { items, stats } = mergeV3State(editado, freshImport());
  const usj = items.find(it => it.id === 'usj');
  const hotel = items.find(it => it.id === 'id_sunshine_kinugawa');

  check('reimportar: la nota escrita a mano SIGUE (no la pisa el importador)',
    usj.notas === 'Reservado el 3 de febrero, confirmación #12345');
  check('reimportar: hecho:true de la acción "reserva" SIGUE',
    usj.acciones.find(a => a.id === 'reserva').hecho === true);
  check('reimportar: el importador SÍ refresca lo derivado de v2 (p.ej. reglaApertura) aunque haya edición',
    usj.acciones.find(a => a.id === 'reserva').reglaApertura === '3 meses antes');
  check('reimportar: estado con estadoManual:true NO lo pisa el importador (sigue "propuesta")',
    hotel.estado === 'propuesta' && hotel.estadoManual === true);
  check('reimportar: stats cuenta 0 nuevos, 2 actualizados', stats.nuevos === 0 && stats.actualizados === 2);
}

// 4) ÍTEM CREADO SOLO EN V3 (por un usuario, sin id en la fuente v2, p.ej. un
//    apunte manual): reimportar NUNCA debe borrarlo, aunque no venga del
//    importador en absoluto.
{
  const conApunteManual = editado.concat([
    { id: 'apunte_manual_usuario', nombre: 'Restaurante que vimos en Instagram', tipo: 'lugar',
      procedencia: 'instagram', estado: 'idea', notas: 'Añadido a mano desde el móvil', estadoManual: false, acciones: [] }
  ]);
  const { items, stats } = mergeV3State(conApunteManual, freshImport());
  check('reimportar: el ítem creado solo en v3 SIGUE existiendo',
    items.some(it => it.id === 'apunte_manual_usuario'));
  check('reimportar: el ítem creado solo en v3 llega INTACTO (mismas notas)',
    items.find(it => it.id === 'apunte_manual_usuario').notas === 'Añadido a mano desde el móvil');
  check('reimportar: stats cuenta 1 conservado solo-en-v3', stats.soloEnV3Conservados === 1);
  check('reimportar: el total sigue siendo 3 (2 de v2 + 1 solo-en-v3), nada se pierde ni se duplica',
    items.length === 3);
}

// 5) Determinismo: la misma pareja de entradas da SIEMPRE el mismo resultado.
{
  const r1 = mergeV3State(editado, freshImport());
  const r2 = mergeV3State(editado, freshImport());
  check('mergeV3State es determinista (misma entrada, mismo JSON de salida)',
    JSON.stringify(r1.items) === JSON.stringify(r2.items));
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
