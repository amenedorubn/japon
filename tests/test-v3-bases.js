// v3 · bases derivadas de hoteles CONFIRMADOS (Fase 4, Decisión 2026-09-16
// punto 1). No depende de index.html: prueba directamente v3/lib/bases.js.
const path = require('path');
const { buildBases, fechaDe, ordenarDia, hotelParaFecha, itemsDeFecha } = require(path.join(__dirname, '..', 'v3', 'lib', 'bases.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const hotel = (id, nombre, checkIn, checkOut) => ({
  id, nombre, tipo: 'alojamiento', estado: 'confirmado', procedencia: 'ours',
  fechaHora: { inicio: checkIn, fin: checkOut, zona: 'Asia/Tokyo' }
});
const parada = (id, nombre, tipo, fechaHoraInicio) => ({
  id, nombre, tipo: tipo || 'lugar', estado: 'propuesta', procedencia: 'ours',
  fechaHora: fechaHoraInicio ? { inicio: fechaHoraInicio, fin: null, zona: 'Asia/Tokyo' } : null
});

const hoteles = [
  hotel('h_kioto', 'Kyoto Guesthouse', '2027-04-16', '2027-04-19'),
  hotel('h_nikko', 'Hotel Sunshine Kinugawa', '2027-04-12', '2027-04-13')
];

// --- Noches derivadas del checkIn/checkOut, no del campo `noche` ---
{
  const { bases } = buildBases(hoteles, []);
  const kioto = bases.find(b => b.hotelId === 'h_kioto');
  check('buildBases: Kyoto Guesthouse (16-19 abr) da 3 noches (16,17,18)',
    JSON.stringify(kioto.noches) === JSON.stringify(['2027-04-16', '2027-04-17', '2027-04-18']));
  check('buildBases: las bases salen ordenadas cronológicamente (Nikko antes que Kioto)',
    bases[0].hotelId === 'h_nikko' && bases[1].hotelId === 'h_kioto');
}

// --- Paradas asignadas a la base cuyo rango de fechas las cubre ---
{
  const items = [
    parada('gion', 'Gion', 'lugar', '2027-04-17T18:00'),
    parada('toshogu', 'Tōshōgū', 'lugar', '2027-04-12T09:00')
  ];
  const { bases, sinBase } = buildBases(hoteles, items);
  const kioto = bases.find(b => b.hotelId === 'h_kioto');
  const nikko = bases.find(b => b.hotelId === 'h_nikko');
  check('buildBases: Gion (17 abr) cae en la base de Kioto', kioto.dias['2027-04-17'] && kioto.dias['2027-04-17'][0].id === 'gion');
  check('buildBases: Tōshōgū (12 abr) cae en la base de Nikko', nikko.dias['2027-04-12'] && nikko.dias['2027-04-12'][0].id === 'toshogu');
  check('buildBases: sinBase queda vacío cuando todo tiene base', sinBase.length === 0);
}

// --- Incoherencia real: una fecha que NINGÚN hotel cubre ---
{
  const items = [parada('huerfana', 'Parada sin hotel', 'lugar', '2027-04-30T10:00')];
  const { sinBase } = buildBases(hoteles, items);
  check('buildBases: una parada en una fecha sin hotel confirmado va a sinBase (incoherencia real)',
    sinBase.length === 1 && sinBase[0].id === 'huerfana');
}

// --- El trayecto del día de traslado va SIEMPRE arriba del día, sea cual sea su orden de entrada ---
{
  const items = [
    parada('parada_tarde', 'Algo por la tarde', 'lugar', '2027-04-16T15:00'),
    parada('trayecto-x', 'Takayama → Nagoya → Kioto', 'trayecto', '2027-04-16'),
    parada('parada_manana', 'Algo por la mañana', 'lugar', '2027-04-16T09:00')
  ];
  const { bases } = buildBases(hoteles, items);
  const kioto = bases.find(b => b.hotelId === 'h_kioto');
  const dia16 = kioto.dias['2027-04-16'];
  check('buildBases: el trayecto va PRIMERO aunque no lleve hora y las paradas sí',
    dia16[0].id === 'trayecto-x');
  check('buildBases: tras el trayecto, el resto del día sale ordenado por hora',
    dia16[1].id === 'parada_manana' && dia16[2].id === 'parada_tarde');
}

// --- Ítem sin fecha (idea sin planificar) nunca revienta, va a sinBase ---
{
  const items = [parada('idea_suelta', 'Sin fecha', 'lugar', null)];
  const { sinBase } = buildBases(hoteles, items);
  check('buildBases: un ítem sin fechaHora no revienta y queda fuera (sinBase)', sinBase.length === 1);
}

// --- hotelParaFecha / itemsDeFecha (Fase 4, Bloque 3): un día SUELTO,
// fuera de buildBases, necesita el mismo orden y la misma búsqueda de base.
{
  check('hotelParaFecha: encuentra el hotel activo esa fecha', hotelParaFecha(hoteles, '2027-04-17').id === 'h_kioto');
  check('hotelParaFecha: null si ningún hotel cubre esa fecha (día de vuelo, por ejemplo)', hotelParaFecha(hoteles, '2027-04-30') === null);

  const items = [
    parada('trayecto-x', 'Takayama → Nagoya → Kioto', 'trayecto', '2027-04-16'),
    parada('parada_tarde', 'Algo por la tarde', 'lugar', '2027-04-16T15:00'),
    parada('parada_manana', 'Algo por la mañana', 'lugar', '2027-04-16T09:00'),
    parada('otro_dia', 'No es de este día', 'lugar', '2027-04-17T09:00')
  ];
  const dia16 = itemsDeFecha(items, '2027-04-16');
  check('itemsDeFecha: solo trae los ítems de esa fecha exacta (3, no el del 17)', dia16.length === 3);
  check('itemsDeFecha: mismo orden que ordenarDia (trayecto primero, luego por hora)',
    dia16[0].id === 'trayecto-x' && dia16[1].id === 'parada_manana' && dia16[2].id === 'parada_tarde');
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
