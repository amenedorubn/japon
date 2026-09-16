/* ================================================================
   JAPÓN 2027 · v3 · Helpers de zona horaria
   Prohibido offset fijo (Decisión D de V3-DESIGN.md): Japón no tiene horario
   de verano, España sí (cambia el 28-mar-2027). Todo el cálculo pasa por
   Intl + timeZone IANA, nunca por una tabla de offsets a mano.
   Sin dependencias de runtime (Decisión 3, 2026-09-16): esto se hornea tal
   cual dentro del futuro <script> único de v3/index.html, igual que el resto
   del proyecto. Funciones puras, testeables sin DOM.
================================================================ */
'use strict';

/* Offset (en minutos) de `timeZone` respecto a UTC en el instante `utcMs`.
   Trampa estándar: formatea ese instante como si sus cifras de pared fueran
   UTC y compara. positivo = por delante de UTC (Asia/Tokyo siempre +540). */
function offsetMinutesAt(utcMs, timeZone){
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = t => Number(parts.find(p => p.type === t).value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asUTC - utcMs) / 60000;
}

/* Instante UTC (ms) de una hora de pared en `timeZone`. Se resuelve en dos
   pasos porque el offset del propio instante buscado es el que hace falta
   (relevante solo en zonas con DST, como Europe/Madrid): primero se calcula
   con el offset de la aproximación ingenua, y si ese offset cambia al
   aplicar la corrección (cerca de un cambio de hora) se repite una vez más. */
function zonedTimeToUtc(year, month, day, hour, minute, timeZone){
  const naive = Date.UTC(year, month - 1, day, hour, minute || 0);
  const offset1 = offsetMinutesAt(naive, timeZone);
  const utc1 = naive - offset1 * 60000;
  const offset2 = offsetMinutesAt(utc1, timeZone);
  return offset2 === offset1 ? utc1 : naive - offset2 * 60000;
}

/* Cifras de pared (año/mes/día/hora/minuto) de un instante UTC en `timeZone`. */
function utcToZonedParts(utcMs, timeZone){
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = t => Number(parts.find(p => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/* Resta meses/días a una fecha de CALENDARIO (sin zona: es aritmética de
   fecha, no de instante). "1 mes antes" de un 11 de abril es el 11 de marzo,
   NO "30 días antes" (que daría el 12 de marzo) — la distinción importa para
   las reglas "N meses antes" del inventario de reservas (§E). */
function subtractCalendar(year, month, day, { months = 0, days = 0 } = {}){
  const d = new Date(Date.UTC(year, month - 1, day));
  if (months) d.setUTCMonth(d.getUTCMonth() - months);
  if (days) d.setUTCDate(d.getUTCDate() - days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/* Instante UTC en que abre una reserva, dado el día del viaje EN JAPÓN
   (calendario JST) y una regla "N meses/días antes a las HH:MM en `zone`".
   Calcula primero la fecha de calendario (subtractCalendar, sin zona) y
   SOLO DESPUÉS la convierte a instante real en `zone` — nunca al revés. */
function reservationOpensAtUtc(tripDate, rule, zone){
  const base = subtractCalendar(tripDate.year, tripDate.month, tripDate.day,
    { months: rule.monthsBefore || 0, days: rule.daysBefore || 0 });
  return zonedTimeToUtc(base.year, base.month, base.day, rule.hour, rule.minute || 0, zone);
}

/* Formatea un instante UTC en las dos zonas que Pendientes muestra siempre
   juntas (§C). Devuelve strings 'YYYY-MM-DD HH:MM' listos para pintar. */
function formatInZones(utcMs, zones){
  const pad2 = n => String(n).padStart(2, '0');
  const out = {};
  for (const zone of zones) {
    const p = utcToZonedParts(utcMs, zone);
    out[zone] = `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    offsetMinutesAt, zonedTimeToUtc, utcToZonedParts,
    subtractCalendar, reservationOpensAtUtc, formatInZones
  };
}
