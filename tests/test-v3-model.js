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

// Shibuya Sky abre 00:00 JST 27-mar-2027; comprobamos con el helper de zonas
// que la hora en Madrid mostrada coincide con la conversión real (CEST, +2).
{
  const shibuya = view.conFecha.find(p => p.itemId === 'shibuya_sky');
  const utcEsperado = tz.zonedTimeToUtc(2027, 3, 27, 0, 0, 'Asia/Tokyo');
  check('pendientesView: abreEnUtc de Shibuya Sky coincide con zonedTimeToUtc directo',
    shibuya.abreEnUtc === utcEsperado);
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
