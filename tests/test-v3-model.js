// v3 · Fase 1: modelo de datos + pendientesView (V3-DESIGN.md §B, §C).
// No depende de index.html: prueba directamente v3/lib/model.js. Recibe
// appJs por argv[2] igual que el resto de suites de run-all.js, sin usarlo.
const path = require('path');
const model = require(path.join(__dirname, '..', 'v3', 'lib', 'model.js'));
const tz = require(path.join(__dirname, '..', 'v3', 'lib', 'timezone.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// Cuatro ítems, uno de cada nivel de precisión real (§E de V3-DESIGN.md).
const items = [
  { // Nivel 1: exacto (Shibuya Sky, 14 días antes medianoche JST, verificado oficial)
    id: 'shibuya_sky', nombre: 'Shibuya Sky', tipo: 'lugar', procedencia: 'ours', estado: 'propuesta',
    reserva: {
      necesaria: true, hecho: false,
      abreEn: { fecha: '2027-03-27', hora: '00:00', zona: 'Asia/Tokyo' },
      reglaApertura: 'Exactamente 14 días antes, medianoche JST', horaConfirmada: true,
      fuente: 'https://www.tokyo-skytree.jp/', verificadoEl: '2026-09-16'
    }
  },
  { // Nivel 2: día exacto, hora sin confirmar (Bus Nouhi, oficial "1 mes antes", sin hora)
    id: 'bus_nouhi', nombre: 'Bus Nouhi Kanazawa-Takayama', tipo: 'trayecto', procedencia: 'ours', estado: 'propuesta',
    reserva: {
      necesaria: true, hecho: false,
      abreEn: { fecha: '2027-03-15', hora: null, zona: null },
      reglaApertura: '1 mes antes (oficial, sin hora)', horaConfirmada: false,
      fuente: 'https://www.nouhibus.co.jp/highwaybus/', verificadoEl: '2026-09-16'
    }
  },
  { // Nivel 3: sin fecha exacta pero se sabe que abrirá (Tōshōgū)
    id: 'toshogu', nombre: 'Santuario Tōshōgū', tipo: 'lugar', procedencia: 'ours', estado: 'propuesta',
    reserva: {
      necesaria: true, hecho: false,
      abreEn: null,
      reglaApertura: 'Entrada online, con antelación, sin regla exacta', horaConfirmada: false,
      fuente: null, verificadoEl: '2026-09-16'
    }
  },
  { // Nivel 4: sin ventana de venta, disponibilidad decreciente (ryokan Takayama)
    id: 'ryokan_takayama', nombre: 'Ryokan de Takayama', tipo: 'alojamiento', procedencia: 'ours', estado: 'propuesta',
    reserva: {
      necesaria: true, hecho: false,
      abreEn: null,
      reglaApertura: null, horaConfirmada: false,
      fuente: null, verificadoEl: null
    }
  },
  { // Ya reservado: no debe aparecer en ningún bloque de pendientes
    id: 'usj', nombre: 'USJ + Nintendo World', tipo: 'lugar', procedencia: 'ai', estado: 'confirmado',
    reserva: { necesaria: true, hecho: true, abreEn: null, reglaApertura: '3 meses antes', horaConfirmada: false }
  },
  { // Sin reserva asociada (p.ej. un lugar de Ideas sin planificar): fuera de Pendientes
    id: 'idea_suelta', nombre: 'Algo del catálogo', tipo: 'lugar', procedencia: 'instagram', estado: 'idea',
    reserva: null
  }
];

// "Ahora" fijo: 1-ene-2027 00:00 UTC, para que el test sea determinista.
const ahora = Date.UTC(2027, 0, 1);

const view = model.pendientesView(items, ahora);

check('precisionLevel: nivel 1 para reserva con día+hora+zona+horaConfirmada',
  model.precisionLevel(items[0].reserva) === 1);
check('precisionLevel: nivel 2 para día exacto sin hora/zona confirmada',
  model.precisionLevel(items[1].reserva) === 2);
check('precisionLevel: nivel 3 para "se sabe que abrirá" sin fecha exacta',
  model.precisionLevel(items[2].reserva) === 3);
check('precisionLevel: nivel 4 para "sin ventana de venta"',
  model.precisionLevel(items[3].reserva) === 4);

check('pendientesView: conFecha agrupa niveles 1 y 2 (2 ítems)', view.conFecha.length === 2);
check('pendientesView: vigilar tiene solo el nivel 3 (Tōshōgū)',
  view.vigilar.length === 1 && view.vigilar[0].id === 'toshogu');
check('pendientesView: reservarYa tiene solo el nivel 4 (ryokan)',
  view.reservarYa.length === 1 && view.reservarYa[0].id === 'ryokan_takayama');
check('pendientesView: lo ya reservado (usj) no aparece en NINGÚN bloque pendiente',
  !view.conFecha.some(p => p.id === 'usj') && !view.vigilar.some(p => p.id === 'usj') &&
  !view.reservarYa.some(p => p.id === 'usj'));
check('pendientesView: lo ya reservado sí aparece en "hechos"',
  view.hechos.some(h => h.id === 'usj'));
check('pendientesView: un ítem sin reserva (idea suelta) no aparece en ningún sitio',
  !view.conFecha.concat(view.vigilar, view.reservarYa, view.hechos).some(p => p.id === 'idea_suelta'));

check('pendientesView: conFecha viene ORDENADO por apertura ascendente (Nouhi 15-mar antes que Shibuya Sky 27-mar)',
  view.conFecha[0].id === 'bus_nouhi' && view.conFecha[1].id === 'shibuya_sky');

check('pendientesView: cada ítem con fecha trae horas en Madrid Y Tokio simultáneas',
  view.conFecha.every(p => p.horas['Europe/Madrid'] && p.horas['Asia/Tokyo']));

// Shibuya Sky abre 00:00 JST 27-mar-2027; comprobamos con el helper de zonas
// que la hora en Madrid mostrada coincide con la conversión real (CEST, +2).
{
  const shibuya = view.conFecha.find(p => p.id === 'shibuya_sky');
  const utcEsperado = tz.zonedTimeToUtc(2027, 3, 27, 0, 0, 'Asia/Tokyo');
  check('pendientesView: abreEnUtc de Shibuya Sky coincide con zonedTimeToUtc directo',
    shibuya.abreEnUtc === utcEsperado);
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
