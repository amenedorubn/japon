/* ================================================================
   JAPÓN 2027 · v3 · Reglas de reserva verificadas (V3-DESIGN.md §E,
   2026-09-16) que enganchan a un RouteItem YA existente.

   Alcance deliberado (mismo de la Fase 2, no resuelto aquí a propósito):
   - Las reglas de trenes/autobuses (smartEX, JR East, Tobu, Nouhi,
     Kawaguchiko) se QUEDAN FUERA: son TRANSPORT de v2, y esta fase todavía
     no modela trayectos como RouteItem propio — no hay a qué enganchar la
     acción. Candidato para la Fase 4 (Ruta), cuando exista ese tipo.
   - El templo ninja de Kanazawa (Myōryū-ji) también se queda fuera: es una
     excursión OPCIONAL de DAY_EXTRAS sin `pid` en el `BOOKINGS` de v2, sin
     RouteItem propio al que engancharse hoy.
   - Solo entran los 3 que SÍ tienen `pid` en `BOOKINGS` y SÍ son un
     RouteItem propio tras el pipeline: USJ (entrada + Express Pass),
     Tōshōgū, teamLab Biovortex Kyoto.
================================================================ */
'use strict';

const path = require('path');
const { subtractCalendar } = require(path.join(__dirname, 'timezone.js'));

const RESERVATION_RULES = [
  {
    itemId: 'usj', accionId: 'entrada',
    tripDate: { year: 2027, month: 4, day: 23 }, rule: { monthsBefore: 3 },
    reglaApertura: 'Venta de entradas con fecha: ~3 meses antes de la visita (oficial, sin hora exacta)',
    horaConfirmada: false,
    fuente: 'https://www.usj.co.jp/company/company_e/news/2025/0421/', verificadoEl: '2026-09-16'
  },
  {
    itemId: 'usj', accionId: 'expressPass',
    tripDate: { year: 2027, month: 4, day: 23 }, rule: { monthsBefore: 3 },
    reglaApertura: 'Universal Express Pass: misma regla de ~3 meses antes que la entrada general (oficial)',
    horaConfirmada: false,
    fuente: 'https://www.usj.co.jp/company/company_e/news/2025/0421/', verificadoEl: '2026-09-16'
  },
  {
    itemId: 'toshogu', accionId: 'reserva',
    reglaApertura: 'Entrada online con antelación; ninguna fuente oficial da una regla de "X días/meses antes" exacta',
    horaConfirmada: false, fuente: null, verificadoEl: '2026-09-16'
  },
  {
    itemId: 'teamlab_kyoto', accionId: 'reserva',
    reglaApertura: 'Entradas con fecha/hora; sin regla de antelación en la FAQ oficial',
    horaConfirmada: false, fuente: 'https://www.teamlab.art/faq/kyoto/', verificadoEl: '2026-09-16'
  }
];

function computeAbreEn(tripDate, rule){
  if (!tripDate || !rule) return null;
  const base = subtractCalendar(tripDate.year, tripDate.month, tripDate.day,
    { months: rule.monthsBefore || 0, days: rule.daysBefore || 0 });
  const pad2 = n => String(n).padStart(2, '0');
  return { fecha: `${base.year}-${pad2(base.month)}-${pad2(base.day)}`, hora: null, zona: null };
}

/* Añade las acciones de `rules` a los RouteItems de `items` que existan con
   ese id (nunca crea un ítem nuevo). Los ids que no aparezcan en `items` se
   listan en `noEncontrados` en vez de fallar en silencio — puede pasar si
   el nivel 1/3 del dedup cambió qué id sobrevive como canónico. */
function attachReservationRules(items, rules){
  const byId = new Map(items.map(it => [it.id, it]));
  const noEncontrados = [];
  for (const r of (rules || [])) {
    const it = byId.get(r.itemId);
    if (!it) { noEncontrados.push(r.itemId + '::' + r.accionId); continue; }
    const accion = {
      id: r.accionId, necesaria: true, hecho: false,
      dondeReservar: r.dondeReservar || null,
      abreEn: computeAbreEn(r.tripDate, r.rule),
      reglaApertura: r.reglaApertura, horaConfirmada: !!r.horaConfirmada,
      fuente: r.fuente || null, verificadoEl: r.verificadoEl || null,
      recomendacion: r.recomendacion || null
    };
    byId.set(it.id, Object.assign({}, it, { acciones: (it.acciones || []).concat([accion]) }));
  }
  return { items: items.map(it => byId.get(it.id)), noEncontrados };
}

if (typeof module !== 'undefined') {
  module.exports = { RESERVATION_RULES, computeAbreEn, attachReservationRules };
}
