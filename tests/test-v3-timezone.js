// v3 · Fase 1: zonas horarias sin offset fijo (V3-DESIGN.md §D).
// No depende de index.html: prueba directamente v3/lib/timezone.js (funciones
// puras, sin DOM). Recibe appJs por argv[2] igual que el resto de suites de
// run-all.js, pero no lo usa — este runner es común a todas las suites.
const path = require('path');
const tz = require(path.join(__dirname, '..', 'v3', 'lib', 'timezone.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const madridAt = (utcMs) => tz.utcToZonedParts(utcMs, 'Europe/Madrid');
const tokyoAt = (utcMs) => tz.utcToZonedParts(utcMs, 'Asia/Tokyo');

// ===== 1) 10:00 JST del 2027-03-11 (antes del cambio de hora español) =====
{
  const utc = tz.zonedTimeToUtc(2027, 3, 11, 10, 0, 'Asia/Tokyo');
  const m = madridAt(utc);
  check('10:00 JST 11-mar-2027 == 02:00 Europe/Madrid (CET, antes del cambio)',
    m.year === 2027 && m.month === 3 && m.day === 11 && m.hour === 2 && m.minute === 0);
}

// ===== 2) 10:00 JST del 2027-04-08 (después del cambio de hora español) =====
{
  const utc = tz.zonedTimeToUtc(2027, 4, 8, 10, 0, 'Asia/Tokyo');
  const m = madridAt(utc);
  check('10:00 JST 8-abr-2027 == 03:00 Europe/Madrid (CEST, después del cambio)',
    m.year === 2027 && m.month === 4 && m.day === 8 && m.hour === 3 && m.minute === 0);
}

// ===== 3) Frontera exacta del cambio de hora español (28-mar-2027, domingo) =====
{
  // El día ANTES del cambio: 10:00 JST del 27-mar-2027 todavía cae en CET (+1).
  const utcAntes = tz.zonedTimeToUtc(2027, 3, 27, 10, 0, 'Asia/Tokyo');
  const mAntes = madridAt(utcAntes);
  check('10:00 JST 27-mar-2027 (víspera) == 02:00 Madrid, CET (+1)',
    mAntes.hour === 2 && mAntes.minute === 0);

  // El día DEL cambio: 10:00 JST del 28-mar-2027 = 01:00 UTC, instante exacto
  // en que Madrid salta de CET a CEST (01:00 UTC ya es CEST) -> 03:00, no 02:00.
  const utcCambio = tz.zonedTimeToUtc(2027, 3, 28, 10, 0, 'Asia/Tokyo');
  const mCambio = madridAt(utcCambio);
  check('10:00 JST 28-mar-2027 (día del cambio) == 03:00 Madrid, CEST (+2), no 02:00',
    mCambio.hour === 3 && mCambio.minute === 0);
}

// ===== 4) "1 mes antes a las 10:00 JST" se calcula en calendario JST, luego se convierte =====
{
  // Bus Nouhi real: viaje del 15-abr-2027, regla "1 mes antes" -> 15-mar-2027, no "30 días antes".
  const utc = tz.reservationOpensAtUtc({ year: 2027, month: 4, day: 15 },
    { monthsBefore: 1, hour: 10 }, 'Asia/Tokyo');
  const t = tokyoAt(utc);
  check('"1 mes antes" del 15-abr-2027 da 15-mar-2027 en calendario JST (no 16-mar de restar 30 días)',
    t.year === 2027 && t.month === 3 && t.day === 15 && t.hour === 10);

  // Restar 30 días en vez de "1 mes de calendario" da una fecha distinta: la prueba
  // de que el orden (calendario JST primero, zona después) importa de verdad.
  const treintaDiasAntes = new Date(Date.UTC(2027, 3, 15) - 30 * 86400000);
  const distinta = treintaDiasAntes.getUTCDate() !== t.day || (treintaDiasAntes.getUTCMonth() + 1) !== t.month;
  check('restar 30 días en vez de "1 mes" da un día de calendario DISTINTO (por eso no vale)', distinta);
}

// ===== 5) Sanity: JST no tiene DST, el offset es SIEMPRE +540 min (+9h) =====
{
  const enero = tz.offsetMinutesAt(Date.UTC(2027, 0, 15), 'Asia/Tokyo');
  const julio = tz.offsetMinutesAt(Date.UTC(2027, 6, 15), 'Asia/Tokyo');
  check('offset JST en enero == +540 min (+9h)', enero === 540);
  check('offset JST en julio == +540 min (+9h), igual que en enero (sin DST)', julio === enero);

  const madridInvierno = tz.offsetMinutesAt(Date.UTC(2027, 0, 15), 'Europe/Madrid');
  const madridVerano = tz.offsetMinutesAt(Date.UTC(2027, 6, 15), 'Europe/Madrid');
  check('offset Madrid en enero == +60 min (CET), confirma que el helper SÍ lee la zona pedida',
    madridInvierno === 60);
  check('offset Madrid en julio == +120 min (CEST), distinto del de enero', madridVerano === 120);
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
