/* ================================================================
   JAPÓN 2027 · v3 · Bases (Fase 4, Decisión 2026-09-16 punto 1): las
   "noches" de la Ruta se derivan de los hoteles CONFIRMADOS (checkIn/
   checkOut reales), NUNCA del campo `noche` de una propuesta. Estructura:
   base (ciudad + hotel + noches + checkIn/checkOut) -> días -> paradas en
   orden horario, con el trayecto de llegada arriba del día de traslado.

   Autosuficiente (sin `require`): compara fechas ISO 'YYYY-MM-DD' como
   strings (el orden lexicográfico coincide con el cronológico), así que
   funciona igual en Node y como <script src> en el navegador — no hace
   falta zona horaria para esto, son días de calendario, no instantes.
================================================================ */
'use strict';

function fechaDe(item){
  return item && item.fechaHora && item.fechaHora.inicio ? item.fechaHora.inicio.slice(0, 10) : null;
}

/* hotels: RouteItems tipo alojamiento, estado confirmado (checkIn/checkOut
   en fechaHora.inicio/fin). items: el resto (lugares + trayectos). Un
   ítem sin fecha, o cuya fecha no cae en NINGÚN hotel, va a `sinBase` — es
   una incoherencia real (noche sin reserva confirmada que la cubra), no un
   fallo silencioso. */
function buildBases(hotels, items){
  const basesOrdenadas = hotels.slice().sort((a, b) => fechaDe(a) < fechaDe(b) ? -1 : 1);
  const bases = basesOrdenadas.map(hotel => {
    const checkIn = fechaDe(hotel), checkOut = hotel.fechaHora.fin;
    const noches = [];
    let cursor = checkIn;
    while (cursor < checkOut) { noches.push(cursor); cursor = addDiaISO(cursor); }
    return { hotelId: hotel.id, hotelNombre: hotel.nombre, checkIn, checkOut, noches, dias: {} };
  });

  const sinBase = [];
  for (const it of items) {
    const fecha = fechaDe(it);
    if (!fecha) { sinBase.push(it); continue; }
    const base = bases.find(b => fecha >= b.checkIn && fecha < b.checkOut);
    if (!base) { sinBase.push(it); continue; }
    if (!base.dias[fecha]) base.dias[fecha] = [];
    base.dias[fecha].push(it);
  }

  // Cada día: el/los trayecto(s) SIEMPRE arriba, luego el resto por hora
  // (fechaHora.inicio trae fecha+hora, p.ej. '2027-04-12T09:00'; los
  // trayectos no llevan hora y ya van primero por el partition de abajo).
  for (const base of bases) {
    for (const fecha of Object.keys(base.dias)) {
      const paradas = base.dias[fecha];
      const trayectos = paradas.filter(p => p.tipo === 'trayecto');
      const resto = paradas.filter(p => p.tipo !== 'trayecto')
        .sort((a, b) => (a.fechaHora.inicio || '') < (b.fechaHora.inicio || '') ? -1 : 1);
      base.dias[fecha] = trayectos.concat(resto);
    }
  }

  return { bases, sinBase };
}

function addDiaISO(fechaISO){
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad2 = n => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

if (typeof module !== 'undefined') {
  module.exports = { buildBases, fechaDe };
}
