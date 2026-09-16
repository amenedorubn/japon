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

  for (const base of bases) {
    for (const fecha of Object.keys(base.dias)) base.dias[fecha] = ordenarDia(base.dias[fecha]);
  }

  return { bases, sinBase };
}

/* El/los trayecto(s) SIEMPRE arriba, luego el resto por hora
   (fechaHora.inicio trae fecha+hora, p.ej. '2027-04-12T09:00'; los
   trayectos no llevan hora y ya van primero por el partition de abajo).
   Exportado aparte de `buildBases` porque un día sin base (vuelo, o una
   incoherencia real) también necesita este mismo orden en su propia
   pantalla — Fase 4, Bloque 3. */
const ES_TRANSPORTE = tipo => tipo === 'trayecto' || tipo === 'vuelo';
/* Un ítem sin hora (p.ej. un check-in de hotel sin franja documentada) NO
   puede sonar antes que uno con hora real solo porque 'YYYY-MM-DD' sea más
   corto que 'YYYY-MM-DDTHH:MM' (bug real, 2026-09-16: el check-in salía el
   primero del día). Con hora conocida se ordena cronológicamente entre
   sí; sin hora, siempre al final, en el orden en que ya venían (no hay
   ningún otro criterio real que inventar). */
function tieneHora(item){
  return !!(item.fechaHora.inicio && item.fechaHora.inicio.indexOf('T') !== -1);
}
function ordenarDia(paradas){
  const transporte = paradas.filter(p => ES_TRANSPORTE(p.tipo));
  const resto = paradas.filter(p => !ES_TRANSPORTE(p.tipo))
    .sort((a, b) => {
      const ha = tieneHora(a), hb = tieneHora(b);
      if (ha !== hb) return ha ? -1 : 1;
      if (!ha) return 0;
      return a.fechaHora.inicio < b.fechaHora.inicio ? -1 : 1;
    });
  return transporte.concat(resto);
}

/* El hotel confirmado (si hay uno sin ambigüedad) cuyo rango [checkIn,
   checkOut) cubre `fecha` — para el menú y la cabecera de un día concreto,
   sin tener que reconstruir todas las bases para consultar un solo día. */
function hotelParaFecha(hoteles, fecha){
  return hoteles.find(h => fecha >= fechaDe(h) && fecha < h.fechaHora.fin) || null;
}

/* Todos los ítems (paradas + trayectos) cuya fecha de calendario es
   exactamente `fecha`, ya ordenados con ordenarDia. */
function itemsDeFecha(items, fecha){
  return ordenarDia(items.filter(it => fechaDe(it) === fecha));
}

/* Punto de SALIDA de un día (Fase 4, Bloque 3, corrección 2026-09-16): el
   hotel confirmado que cubre la noche ANTERIOR a `fecha`, para que la
   agenda y el mapa empiecen desde donde de verdad se ha dormido, no desde
   el hotel de ESTA noche (al que aún no se ha llegado). `diasOrdenados` es
   la lista de días del viaje ordenada por fecha (DATA.dias); el primer día
   del viaje no tiene noche anterior que consultar -> null (excepciones
   reales como "llega en avión" se resuelven en la UI, no aquí: esta
   función solo sabe de hoteles confirmados). */
function hotelDeAnoche(hoteles, diasOrdenados, fecha){
  const idx = diasOrdenados.findIndex(d => d.fecha === fecha);
  if (idx <= 0) return null;
  return hotelParaFecha(hoteles, diasOrdenados[idx - 1].fecha);
}

function addDiaISO(fechaISO){
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad2 = n => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

if (typeof module !== 'undefined') {
  module.exports = { buildBases, fechaDe, ordenarDia, hotelParaFecha, itemsDeFecha, hotelDeAnoche };
}
