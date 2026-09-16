// v3 · modelo de datos + pendientesView (V3-DESIGN.md §B, §C).
// No depende de index.html: prueba directamente v3/lib/model.js. Recibe
// appJs por argv[2] igual que el resto de suites de run-all.js, sin usarlo.
// `reserva` (singular) se generalizó a `acciones[]` (Decisión C, 2026-09-16):
// un ítem puede tener más de una acción pendiente (p.ej. un vuelo con su
// propio check-in), cada una con id propio para poder marcarla como hecha.
const path = require('path');
const model = require(path.join(__dirname, '..', 'v3', 'lib', 'model.js'));
const tz = require(path.join(__dirname, '..', 'v3', 'lib', 'timezone.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const accion = (id, over) => Object.assign({
  id, necesaria: true, hecho: false, abreEn: null, reglaApertura: null,
  horaConfirmada: false, fuente: null, verificadoEl: null, recomendacion: null
}, over);

// Ítems de ejemplo, uno de cada nivel de precisión real (§E de V3-DESIGN.md),
// más un vuelo con DOS acciones para probar que pendientesView no las funde.
const items = [
  { // Nivel 1: exacto (Shibuya Sky, 14 días antes medianoche JST, verificado oficial)
    id: 'shibuya_sky', nombre: 'Shibuya Sky', tipo: 'lugar', procedencia: 'ours', estado: 'propuesta',
    acciones: [accion('reserva', {
      abreEn: { fecha: '2027-03-27', hora: '00:00', zona: 'Asia/Tokyo' },
      reglaApertura: 'Exactamente 14 días antes, medianoche JST', horaConfirmada: true,
      fuente: 'https://www.tokyo-skytree.jp/', verificadoEl: '2026-09-16'
    })]
  },
  { // Nivel 2: día exacto, hora sin confirmar (Bus Nouhi, oficial "1 mes antes", sin hora)
    id: 'bus_nouhi', nombre: 'Bus Nouhi Kanazawa-Takayama', tipo: 'trayecto', procedencia: 'ours', estado: 'propuesta',
    acciones: [accion('reserva', {
      abreEn: { fecha: '2027-03-15', hora: null, zona: null },
      reglaApertura: '1 mes antes (oficial, sin hora)', horaConfirmada: false,
      fuente: 'https://www.nouhibus.co.jp/highwaybus/', verificadoEl: '2026-09-16'
    })]
  },
  { // Nivel 3: sin fecha exacta pero se sabe que abrirá (Tōshōgū)
    id: 'toshogu', nombre: 'Santuario Tōshōgū', tipo: 'lugar', procedencia: 'ours', estado: 'propuesta',
    acciones: [accion('reserva', {
      reglaApertura: 'Entrada online, con antelación, sin regla exacta', verificadoEl: '2026-09-16'
    })]
  },
  { // Nivel 4: sin ventana de venta, disponibilidad decreciente (ryokan Takayama)
    id: 'ryokan_takayama', nombre: 'Ryokan de Takayama', tipo: 'alojamiento', procedencia: 'ours', estado: 'propuesta',
    acciones: [accion('reserva', {})]
  },
  { // Ya reservado: no debe aparecer en ningún bloque de pendientes
    id: 'usj', nombre: 'USJ + Nintendo World', tipo: 'lugar', procedencia: 'ai', estado: 'confirmado',
    acciones: [accion('reserva', { hecho: true, reglaApertura: '3 meses antes' })]
  },
  { // Sin ninguna acción (p.ej. un lugar de Ideas sin planificar): fuera de Pendientes
    id: 'idea_suelta', nombre: 'Algo del catálogo', tipo: 'lugar', procedencia: 'instagram', estado: 'idea',
    acciones: []
  },
  { // Vuelo con DOS acciones (check-in de ida y de vuelta, por ejemplo): deben
    // salir como DOS entradas independientes de Pendientes, no fusionadas,
    // y marcar una como hecha no debe afectar a la otra.
    id: 'vuelo-1', nombre: 'Madrid (MAD) → Helsinki (HEL)', tipo: 'vuelo', procedencia: 'ours', estado: 'confirmado',
    acciones: [
      accion('checkin', {
        abreEn: { fecha: '2027-04-06', hora: '10:15', zona: 'Europe/Madrid' },
        reglaApertura: 'Check-in online 36h antes de la salida (Finnair, oficial)', horaConfirmada: true,
        fuente: 'https://www.finnair.com/en/check-in-for-finnair-flights', verificadoEl: '2026-09-16'
      }),
      accion('equipaje', { hecho: true, reglaApertura: 'Facturado en el mostrador', horaConfirmada: false })
    ]
  }
];

// "Ahora" fijo: 1-ene-2027 00:00 UTC, para que el test sea determinista.
const ahora = Date.UTC(2027, 0, 1);

const view = model.pendientesView(items, ahora);

check('precisionLevel: nivel 1 para acción con día+hora+zona+horaConfirmada',
  model.precisionLevel(items[0].acciones[0]) === 1);
check('precisionLevel: nivel 2 para día exacto sin hora/zona confirmada',
  model.precisionLevel(items[1].acciones[0]) === 2);
check('precisionLevel: nivel 3 para "se sabe que abrirá" sin fecha exacta',
  model.precisionLevel(items[2].acciones[0]) === 3);
check('precisionLevel: nivel 4 para "sin ventana de venta"',
  model.precisionLevel(items[3].acciones[0]) === 4);

check('pendientesView: conFecha agrupa niveles 1 y 2 + el checkin del vuelo (3 acciones)',
  view.conFecha.length === 3);
check('pendientesView: vigilar tiene solo el nivel 3 (Tōshōgū)',
  view.vigilar.length === 1 && view.vigilar[0].itemId === 'toshogu');
check('pendientesView: reservarYa tiene solo el nivel 4 (ryokan)',
  view.reservarYa.length === 1 && view.reservarYa[0].itemId === 'ryokan_takayama');
check('pendientesView: lo ya reservado (usj) no aparece en NINGÚN bloque pendiente',
  !view.conFecha.some(p => p.itemId === 'usj') && !view.vigilar.some(p => p.itemId === 'usj') &&
  !view.reservarYa.some(p => p.itemId === 'usj'));
check('pendientesView: lo ya reservado sí aparece en "hechos"',
  view.hechos.some(h => h.itemId === 'usj' && h.accionId === 'reserva'));
check('pendientesView: un ítem sin acciones (idea suelta) no aparece en ningún sitio',
  !view.conFecha.concat(view.vigilar, view.reservarYa, view.hechos).some(p => p.itemId === 'idea_suelta'));

check('pendientesView: conFecha viene ORDENADO por apertura ascendente (Nouhi 15-mar, Shibuya 27-mar, checkin 6-abr)',
  view.conFecha[0].itemId === 'bus_nouhi' && view.conFecha[1].itemId === 'shibuya_sky' && view.conFecha[2].accionId === 'checkin');

check('pendientesView: cada acción con fecha trae horas en Madrid Y Tokio simultáneas',
  view.conFecha.every(p => p.horas['Europe/Madrid'] && p.horas['Asia/Tokyo']));

check('pendientesView: el vuelo tiene 2 acciones, una pendiente (checkin) y otra hecha (equipaje), sin fundirse',
  view.conFecha.some(p => p.itemId === 'vuelo-1' && p.accionId === 'checkin') &&
  view.hechos.some(h => h.itemId === 'vuelo-1' && h.accionId === 'equipaje') &&
  !view.hechos.some(h => h.itemId === 'vuelo-1' && h.accionId === 'checkin'));

// Regresión (2026-09-16): el orden de Pendientes es SIEMPRE por fecha real
// ascendente, nunca "primero por precisión y luego por fecha". Un ítem de
// nivel 2 (USJ, enero, sin hora confirmada) con fecha ANTES que uno de
// nivel 1 (check-in Finnair, abril, hora exacta) debe salir PRIMERO — el
// nivel solo cambia el badge ⚠️, nunca la posición.
{
  const itemsOrden = [
    { // nivel 1: check-in de vuelo, abril, hora exacta
      id: 'vuelo-1', nombre: 'Madrid (MAD) → Helsinki (HEL)', tipo: 'vuelo', procedencia: 'ours', estado: 'confirmado',
      acciones: [accion('checkin', {
        abreEn: { fecha: '2027-04-06', hora: '22:15', zona: 'Europe/Madrid' },
        reglaApertura: '36h antes de la salida', horaConfirmada: true
      })]
    },
    { // nivel 2: USJ, ENERO (mucho antes), hora sin confirmar
      id: 'usj_entrada', nombre: 'USJ + Nintendo World', tipo: 'lugar', procedencia: 'ai', estado: 'propuesta',
      acciones: [accion('entrada', {
        abreEn: { fecha: '2027-01-23', hora: null, zona: null },
        reglaApertura: '~3 meses antes de la visita (oficial, sin hora exacta)', horaConfirmada: false
      })]
    }
  ];
  const viewOrden = model.pendientesView(itemsOrden, Date.UTC(2026, 8, 16));
  check('REGRESIÓN orden: USJ (enero, nivel 2) sale ANTES que el check-in (abril, nivel 1)',
    viewOrden.conFecha[0].itemId === 'usj_entrada' && viewOrden.conFecha[1].itemId === 'vuelo-1');
  check('REGRESIÓN orden: USJ conserva su nivel 2 (badge ⚠️), no se "asciende" a nivel 1 por ir primero',
    viewOrden.conFecha[0].nivel === 2);
}

// Shibuya Sky abre 00:00 JST 27-mar-2027; comprobamos con el helper de zonas
// que la hora en Madrid mostrada coincide con la conversión real (CEST, +2).
{
  const shibuya = view.conFecha.find(p => p.itemId === 'shibuya_sky');
  const utcEsperado = tz.zonedTimeToUtc(2027, 3, 27, 0, 0, 'Asia/Tokyo');
  check('pendientesView: abreEnUtc de Shibuya Sky coincide con zonedTimeToUtc directo',
    shibuya.abreEnUtc === utcEsperado);
}

// --- agruparPorApertura (Decisión 2026-09-16, punto 4): check-ins del MISMO
// billete (mismo abreEnUtc) se funden en una tarjeta con `tramos`; otras
// acciones NUNCA se funden aunque coincidan por pura casualidad de fecha.
{
  const mismaHora = 1234567890;
  const entradas = [
    { itemId: 'vuelo-1', accionId: 'checkin', nombre: 'Madrid → Helsinki', abreEnUtc: mismaHora },
    { itemId: 'vuelo-2', accionId: 'checkin', nombre: 'Helsinki → Narita', abreEnUtc: mismaHora },
    { itemId: 'vuelo-3', accionId: 'checkin', nombre: 'Narita → Helsinki', abreEnUtc: mismaHora + 999999 }, // billete distinto
    { itemId: 'coincidencia_a', accionId: 'reserva', nombre: 'Sitio A', abreEnUtc: mismaHora }, // misma fecha, NO es checkin
    { itemId: 'coincidencia_b', accionId: 'reserva', nombre: 'Sitio B', abreEnUtc: mismaHora }  // misma fecha, NO es checkin
  ];
  const agrupado = model.agruparPorApertura(entradas);

  check('agruparPorApertura: da 4 entradas de salida (2 checkin+2 checkin fundidos en 1, +1 checkin suelto, +2 "reserva" sueltas)',
    agrupado.length === 4);

  const grupoCheckin = agrupado.find(e => e.accionId === 'checkin' && e.abreEnUtc === mismaHora);
  check('agruparPorApertura: el grupo de check-in del mismo billete trae "tramos" con los 2',
    grupoCheckin && grupoCheckin.tramos && grupoCheckin.tramos.length === 2);

  const checkinSuelto = agrupado.find(e => e.itemId === 'vuelo-3');
  check('agruparPorApertura: el check-in de OTRO billete (distinto abreEnUtc) queda suelto, sin "tramos"',
    checkinSuelto && !checkinSuelto.tramos);

  const sitioA = agrupado.find(e => e.itemId === 'coincidencia_a');
  const sitioB = agrupado.find(e => e.itemId === 'coincidencia_b');
  check('agruparPorApertura: dos acciones "reserva" con la MISMA fecha por casualidad NUNCA se funden',
    sitioA && !sitioA.tramos && sitioB && !sitioB.tramos);
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
