/* ================================================================
   JAPÓN 2027 · v3 · Trayectos de tren/bus como RouteItem (Fase 4,
   2026-09-16). TRANSPORT (v2, index.html) no tiene id propio por fila: se
   referencia por ÍNDICE, así que TRANSPORT_RULES.length debe coincidir
   siempre con TRANSPORT.length — test-v3-trayectos.js lo comprueba junto al
   texto de cada fila, para detectar de inmediato si TRANSPORT cambia.

   `researched: false` = no investigado en esta fase (Hida día 16, NEX día
   27): sin `accion`, no se propone nada. NUNCA se inventa una regla para
   rellenar un hueco.
================================================================ */
'use strict';

const path = require('path');
const { subtractCalendar } = require(path.join(__dirname, 'timezone.js'));

const TRANSPORT_RULES = [
  { diaMes: 12, researched: true, monthsBefore: 1, hora: '09:00', horaConfirmada: false, zona: 'Asia/Tokyo',
    reglaApertura: 'Tobu: venta desde las 9:00 del mismo día del mes anterior (oficial; la web no dice "JST" explícito)',
    fuente: 'https://www.tobu.co.jp/en/express_info/purchase/' },
  { diaMes: 13, researched: true, monthsBefore: 1, hora: null, horaConfirmada: false,
    reglaApertura: 'JR East, regla estándar: 1 mes antes (sin hora exacta oficial). Kagayaki NO tiene el servicio de reserva a 3 meses',
    fuente: 'https://www.jreast.co.jp/en/multi/faq/' },
  { diaMes: 15, researched: true, monthsBefore: 1, hora: null, horaConfirmada: false,
    reglaApertura: 'Bus Nouhi: reservable desde 1 mes antes (oficial, "1ヶ月前より予約可能"), sin hora del día',
    fuente: 'https://www.nouhibus.co.jp/highwaybus/' },
  { diaMes: 26, researched: true, monthsBefore: null, hora: null, horaConfirmada: false, reglaApertura: null, fuente: null },
  { diaMes: 13, researched: true, monthsBefore: 1, hora: null, horaConfirmada: false,
    reglaApertura: 'JR East, regla estándar: 1 mes antes (sin hora exacta). Yamabiko también admite reserva anticipada desde 3 meses antes (servicio nuevo desde oct-2025); la hora de ESE servicio no está confirmada',
    fuente: 'https://www.jreast.co.jp/en/multi/faq/' },
  { diaMes: 16, researched: false },
  { diaMes: 16, researched: true, monthsBefore: 1, hora: '10:00', horaConfirmada: true, zona: 'Asia/Tokyo',
    reglaApertura: 'smartEX (Tōkaidō/Sanyō): exactamente 1 mes antes (mismo día del mes) a las 10:00 JST, hasta 4 min antes de salida',
    fuente: 'https://smart-ex.jp/en/faq/category/detail/?id=459' },
  { diaMes: 19, researched: true, monthsBefore: 1, hora: '10:00', horaConfirmada: true, zona: 'Asia/Tokyo',
    reglaApertura: 'smartEX: exactamente 1 mes antes a las 10:00 JST',
    fuente: 'https://smart-ex.jp/en/faq/category/detail/?id=459' },
  { diaMes: 20, researched: true, monthsBefore: 1, hora: '10:00', horaConfirmada: true, zona: 'Asia/Tokyo',
    reglaApertura: 'smartEX: exactamente 1 mes antes a las 10:00 JST',
    fuente: 'https://smart-ex.jp/en/faq/category/detail/?id=459' },
  { diaMes: 21, researched: true, monthsBefore: 1, hora: '10:00', horaConfirmada: true, zona: 'Asia/Tokyo',
    reglaApertura: 'smartEX: exactamente 1 mes antes a las 10:00 JST',
    fuente: 'https://smart-ex.jp/en/faq/category/detail/?id=459' },
  { diaMes: 25, researched: true, monthsBefore: 1, hora: '10:00', horaConfirmada: true, zona: 'Asia/Tokyo',
    reglaApertura: 'smartEX: exactamente 1 mes antes a las 10:00 JST (el horario exacto del tren aún lo tiene que confirmar JR)',
    fuente: 'https://smart-ex.jp/en/faq/category/detail/?id=459' },
  { diaMes: 27, researched: false }
];

function computeAbreEn(tripYear, diaMes, rule){
  if (rule.monthsBefore == null) return null;
  const base = subtractCalendar(tripYear, 4, diaMes, { months: rule.monthsBefore });
  const pad2 = n => String(n).padStart(2, '0');
  return { fecha: `${base.year}-${pad2(base.month)}-${pad2(base.day)}`, hora: rule.hora || null, zona: rule.zona || null };
}

/* transport: el TRANSPORT de v2 tal cual ([flag, 'Día N', nombre, nota]).
   tripYear: 2027. Devuelve un RouteItem `tipo:'trayecto'`, `estado:
   'propuesta'` por fila (Decisión 2026-09-16: ninguno tiene billete
   comprado todavía). `avisos` recoge cualquier fila cuyo "Día N" no
   coincida con el `diaMes` esperado en TRANSPORT_RULES (TRANSPORT cambió
   sin actualizar este fichero) — no revienta, pero hay que mirarlo. */
function buildTrayectoItems(transport, tripYear){
  if (transport.length !== TRANSPORT_RULES.length) {
    throw new Error(`TRANSPORT tiene ${transport.length} filas, TRANSPORT_RULES espera ${TRANSPORT_RULES.length}: revisa v3/lib/trayectos.js`);
  }
  const avisos = [];
  const items = transport.map((row, i) => {
    const [flag, diaTexto, nombre, nota] = row;
    const diaMesReal = parseInt(String(diaTexto).replace(/\D/g, ''), 10);
    const rule = TRANSPORT_RULES[i];
    if (diaMesReal !== rule.diaMes) {
      avisos.push(`TRANSPORT[${i}] dice "${diaTexto}" (día ${diaMesReal}) pero TRANSPORT_RULES esperaba día ${rule.diaMes}`);
    }
    const pad2 = n => String(n).padStart(2, '0');
    const fecha = `${tripYear}-04-${pad2(diaMesReal)}`;

    const acciones = [];
    if (rule.researched) {
      acciones.push({
        id: 'reserva', necesaria: true, hecho: false, dondeReservar: null,
        abreEn: computeAbreEn(tripYear, diaMesReal, rule),
        reglaApertura: rule.reglaApertura || null, horaConfirmada: !!rule.horaConfirmada,
        fuente: rule.fuente || null, verificadoEl: '2026-09-16', recomendacion: null
      });
    }

    return {
      id: 'trayecto-' + (i + 1), nombre, tipo: 'trayecto', procedencia: 'ours', estado: 'propuesta',
      noche: null, fechaHora: { inicio: fecha, fin: null, zona: 'Asia/Tokyo' },
      ubicacion: null, acciones,
      obligatorio: flag === 'obl', nota: nota || null
    };
  });
  return { items, avisos };
}

if (typeof module !== 'undefined') {
  module.exports = { TRANSPORT_RULES, computeAbreEn, buildTrayectoItems };
}
