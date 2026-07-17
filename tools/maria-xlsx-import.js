/* Extractor del planning de María (su viaje de febrero–marzo de 2024).
   Lee planningjapon.xlsx y hornea la ficha de referencia: 15 días con su
   fecha, sus ciudades, sus traslados, sus actividades y dónde durmió.

   PRIVACIDAD — el repo es PÚBLICO (GitHub Pages), así que esto es una LISTA
   BLANCA, no una lista negra. El xlsx NO se versiona (.gitignore): vive solo
   en local y de él sale únicamente lo publicable:
     · fechas, días de la semana, ciudades por día
     · traslados y notas de llegada/salida
     · actividades
     · nombres de hotel y su enlace de MAPA (son negocios, y el pin es público)
   NO sale, y assertNoPrivateData lo verifica antes de escribir nada:
     · ningún enlace de reserva de terceros, ni el id de reserva que lleva uno
       de ellos dentro;
     · el alojamiento particular de su anfitriona (su nombre no se publica:
       se sustituye por un rótulo neutro);
     · la hoja "costs" entera (precios y reparto) y los comentarios personales.
   Ni siquiera este fichero los nombra: se versiona, así que enumerarlos aquí
   sería publicarlos. Se derivan del xlsx en cada ejecución (collectPrivateStrings).
   Los enlaces de las LISTAS de Google Maps por ciudad no se copian aquí: ya
   viven en MARIA_MAPS (index.html) y el render los resuelve por ciudad.

   USO:  node tools/maria-xlsx-import.js           # extrae, verifica y escribe el JSON
         node tools/maria-xlsx-import.js --bake    # además hornea en index.html
         node tools/maria-xlsx-import.js --check   # compara con el snapshot y sale
*/
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { readZip } = require('./docx-import.js'); // lector ZIP mínimo, ya probado

const ROOT = path.join(__dirname, '..');
const XLSX = path.join(ROOT, 'planningjapon.xlsx');
const OUT = path.join(ROOT, 'import', 'maria-trip.json');
const INDEX = path.join(ROOT, 'index.html');
const SNAPSHOT = path.join(ROOT, 'tests', 'maria-trip-snapshot.json');
const START_MARKER = '// @@MARIA_TRIP_START';
const END_MARKER = '// @@MARIA_TRIP_END';

/* Único host de enlace que puede salir publicado: el pin de Google Maps. */
const ALLOWED_LINK_HOST = 'maps.app.goo.gl';

/* La rejilla del xlsx (hoja "visits"): B..P son los 15 días. */
const DAY_COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
const ROW_DATE = 1, ROW_WEEKDAY = 2, ROW_CITIES = 3, ROW_ACC = 11;
const NOTE_ROWS = [4, 5, 6, 7, 8, 9, 10]; // A4:A10 = "Notes": un bloque libre por día
const ROW_HOTEL_NAME = 24, ROW_HOTEL_MAP = 25;

/* ---------------- Lectura del XLSX ---------------- */

function inflate(entry) {
  return entry.method === 0 ? entry.raw.toString('utf8') : zlib.inflateRawSync(entry.raw).toString('utf8');
}
function decodeEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}
/* Serial de fecha de Excel → ISO. El epoch es 1899-12-30 (el bug del año
   bisiesto de 1900 que Excel arrastra por compatibilidad). */
function excelDateToISO(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000).toISOString().slice(0, 10);
}
function readSheet(file) {
  const files = readZip(file);
  const ssEntry = files.get('xl/sharedStrings.xml');
  const shared = ssEntry
    ? [...inflate(ssEntry).matchAll(/<si>([\s\S]*?)<\/si>/g)]
        .map(m => decodeEntities([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')))
    : [];
  const sheet = files.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('El .xlsx no contiene xl/worksheets/sheet1.xml');
  const xml = inflate(sheet);
  const relsEntry = files.get('xl/worksheets/_rels/sheet1.xml.rels');
  const rels = {};
  if (relsEntry) {
    [...inflate(relsEntry).matchAll(/<Relationship[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)]
      .forEach(m => { rels[m[1]] = decodeEntities(m[2]); });
  }
  // Hipervínculo por celda. Un ref puede ser un rango ("J24:K24"): vale su ancla.
  const links = {};
  [...xml.matchAll(/<hyperlink ref="([A-Z]+\d+)(?::[A-Z]+\d+)?"[^>]*?r:id="([^"]+)"/g)]
    .forEach(m => { if (!links[m[1]]) links[m[1]] = rels[m[2]]; });
  // Celdas. OJO: las vacías vienen autocerradas (<c r="C24" s="78"/>); tratarlas
  // igual que las normales hace que una celda se coma el valor de la siguiente.
  const cells = {};
  [...xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>\/]*)(?:\/>|>([\s\S]*?)<\/c>)/g)].forEach(m => {
    const v = ((m[4] || '').match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    if (v == null) return;
    cells[m[1] + m[2]] = /t="s"/.test(m[3] || '') ? shared[+v] : v;
  });
  return { cells, links };
}

/* ---------------- Clasificación de las notas de un día ---------------- */

const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const isMove = s => /→/.test(s);
const isLogistics = s => /^(arrival|departure)\b|back home/i.test(clean(s));
/* Bloque libre multilínea ("Things to do in Tokyo · Shibuya Sky · Mt. Fuji…"):
   son ideas sueltas, no una actividad del día. Se dejan fuera a propósito. */
const isIdeaBlock = s => /[\r\n]/.test(String(s || ''));

/* ---------------- Extracción ---------------- */

function extractHotels({ cells, links }) {
  // Las tarjetas de hotel (filas 24-25) NO están alineadas con las columnas de
  // los días: son rangos combinados puestos para que se lean. El vínculo con el
  // día va por el número ①-⑤, nunca por la columna.
  const CIRCLED = '①②③④⑤';
  const hotels = [];
  DAY_COLS.forEach(c => {
    const raw = clean(cells[c + ROW_HOTEL_NAME]);
    if (!raw) return;
    const n = CIRCLED.indexOf(raw[0]) + 1;
    if (!n) return;
    const map = links[c + ROW_HOTEL_MAP] || '';
    if (map && !map.includes(ALLOWED_LINK_HOST)) {
      throw new Error(`El mapa del hotel ${n} no es un pin de ${ALLOWED_LINK_HOST}: ${map}`);
    }
    hotels.push({ n, name: raw.slice(1).trim(), map }); // el enlace de RESERVA (fila 24) se descarta
  });
  return hotels.sort((a, b) => a.n - b.n);
}

function extractDays({ cells, links }, hotels) {
  const CIRCLED = '①②③④⑤';
  const byNum = new Map(hotels.map(h => [h.n, h]));
  const days = [];
  let carried = null; // "→" = sigue en el mismo sitio que la noche anterior
  DAY_COLS.forEach((c, i) => {
    const serial = cells[c + ROW_DATE];
    if (!serial) throw new Error(`Falta la fecha del día ${i + 1} (celda ${c}${ROW_DATE})`);
    const cities = clean(cells[c + ROW_CITIES]).split('/').map(clean).filter(Boolean);
    const notes = NOTE_ROWS.map(r => cells[c + r]).filter(x => x != null && clean(x));
    const move = notes.filter(n => isMove(n) || isLogistics(n)).map(clean);
    const activities = notes.filter(n => !isMove(n) && !isLogistics(n) && !isIdeaBlock(n))
      .map(clean)
      // Una nota que solo repite una ciudad del día (día 5: "NARA") no añade nada.
      .filter(n => !cities.some(city => city.toUpperCase() === n.toUpperCase()));

    // Dónde durmió. "→" arrastra la noche anterior; el alojamiento particular
    // de su anfitriona no se publica (PRIVACIDAD): se anota como tal y sin nombre.
    const accRaw = clean(cells[c + ROW_ACC]);
    let stay = null;
    if (accRaw === '→') {
      stay = carried;
    } else if (accRaw) {
      const m = accRaw.match(new RegExp('[' + CIRCLED + ']'));
      if (m) {
        const h = byNum.get(CIRCLED.indexOf(m[0]) + 1);
        stay = h ? { kind: 'hotel', n: h.n } : null;
      } else {
        stay = { kind: 'private' }; // alojamiento particular · sin nombre
      }
      carried = stay;
    } else {
      carried = null;
    }
    days.push({ n: i + 1, date: excelDateToISO(serial), weekday: clean(cells[c + ROW_WEEKDAY]),
      cities, move, activities, stay });
  });
  return days;
}

function buildTrip(file) {
  const sheet = readSheet(file);
  const hotels = extractHotels(sheet);
  const days = extractDays(sheet, hotels);
  return { source: 'planningjapon.xlsx (viaje de María, 2024) · sin datos privados',
    from: days[0].date, to: days[days.length - 1].date, days, hotels };
}

/* ---------------- Guardas ---------------- */

/* Lo que hay que callar se DERIVA del propio xlsx, no se escribe aquí. Un
   guardián que lleva dentro la lista de secretos los publica él mismo: este
   fichero sí se versiona (repo público), así que no puede contener ni el id de
   reserva ni el nombre de su anfitriona. El xlsx (que no se versiona) es la
   única fuente de ambos, y de ahí salen en cada ejecución.
   Privado = todo enlace que no sea el pin de Maps + toda etiqueta de
   alojamiento que no sea un hotel ①-⑤, y también cada una de sus palabras
   sueltas: si la etiqueta lleva un nombre propio, ese nombre queda protegido
   por separado, no solo la etiqueta entera. */
function collectPrivateStrings({ cells, links }) {
  const CIRCLED = '①②③④⑤';
  const secrets = new Set();
  Object.values(links).forEach(u => { if (u && !u.includes(ALLOWED_LINK_HOST)) secrets.add(u); });
  DAY_COLS.forEach(c => {
    const acc = clean(cells[c + ROW_ACC]);
    if (!acc || acc === '→' || new RegExp('[' + CIRCLED + ']').test(acc)) return;
    secrets.add(acc);
    acc.split(/[\s,·/]+/).filter(w => w.length > 2).forEach(w => secrets.add(w));
  });
  return [...secrets];
}
/* Última barrera antes de escribir: si algo privado se coló, no se publica.
   Doble red — lista blanca de enlaces (lo único que puede salir) y los secretos
   derivados del xlsx (lo que seguro no). */
function assertNoPrivateData(trip, secrets) {
  const json = JSON.stringify(trip);
  const urls = json.match(/https?:\/\/[^"\\]+/g) || [];
  const bad = urls.filter(u => !u.includes(ALLOWED_LINK_HOST));
  if (bad.length) throw new Error(`Enlace no permitido en el JSON: ${bad.join(', ')}. No se escribe nada.`);
  const leak = (secrets || []).find(s => s && new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(json));
  if (leak) throw new Error('DATO PRIVADO del xlsx en el JSON. No se escribe nada.'); // sin eco: lo publicaría
  return true;
}
function verify(trip) {
  const errs = [];
  if (trip.days.length !== 15) errs.push(`se esperaban 15 días, hay ${trip.days.length}`);
  if (trip.hotels.length !== 5) errs.push(`se esperaban 5 hoteles, hay ${trip.hotels.length}`);
  const acts = trip.days.reduce((n, d) => n + d.activities.length, 0);
  if (acts !== 6) errs.push(`se esperaban 6 actividades, hay ${acts}`);
  if (trip.hotels.some(h => !h.map)) errs.push('algún hotel se quedó sin enlace de mapa');
  trip.days.forEach(d => { if (!d.cities.length) errs.push(`el día ${d.n} se quedó sin ciudad`); });
  return errs;
}

/* ---------------- Horneado ---------------- */

function fmtDay(d) {
  const stay = d.stay ? (d.stay.kind === 'hotel' ? `{kind:'hotel', n:${d.stay.n}}` : `{kind:'private'}`) : 'null';
  const arr = a => '[' + a.map(x => JSON.stringify(x)).join(', ') + ']';
  return `  {n:${d.n}, date:'${d.date}', weekday:${JSON.stringify(d.weekday)}, ` +
    `cities:${arr(d.cities)}, move:${arr(d.move)}, activities:${arr(d.activities)}, stay:${stay}},`;
}
function fmtHotel(h) {
  return `  {n:${h.n}, name:${JSON.stringify(h.name)}, map:${JSON.stringify(h.map)}},`;
}
function bake(trip) {
  const html = fs.readFileSync(INDEX, 'utf8');
  const a = html.indexOf(START_MARKER), b = html.indexOf(END_MARKER);
  if (a < 0 || b < 0) { console.error(`No encuentro los marcadores ${START_MARKER}/${END_MARKER}`); return -1; }
  const block = [
    START_MARKER,
    'const MARIA_TRIP_2024 = [',
    ...trip.days.map(fmtDay),
    '];',
    'const MARIA_HOTELS_2024 = [',
    ...trip.hotels.map(fmtHotel),
    '];',
    END_MARKER,
  ].join('\n');
  const out = html.slice(0, a) + block + html.slice(b + END_MARKER.length);
  fs.writeFileSync(INDEX, out);
  return trip.days.length;
}

function main() {
  const doBake = process.argv.includes('--bake');
  const doCheck = process.argv.includes('--check');
  if (!fs.existsSync(XLSX)) {
    console.error(`No encuentro ${path.basename(XLSX)} en la raíz.\n` +
      'No se versiona a propósito (repo público): pídeselo a María y déjalo ahí para re-hornear.');
    process.exit(2);
  }
  const sheet = readSheet(XLSX);
  const trip = buildTrip(XLSX);
  assertNoPrivateData(trip, collectPrivateStrings(sheet));
  const errs = verify(trip);
  console.error(`${trip.days.length} días · ${trip.hotels.length} hoteles · ` +
    `${trip.days.reduce((n, d) => n + d.activities.length, 0)} actividades · ` +
    `${trip.from} → ${trip.to}`);
  if (errs.length) { errs.forEach(e => console.error('  ✗ ' + e)); process.exit(1); }
  console.error('✓ sin datos privados · solo pines de ' + ALLOWED_LINK_HOST);

  if (fs.existsSync(SNAPSHOT)) {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const same = JSON.stringify(snap) === JSON.stringify(trip);
    console.error(same ? '✓ idéntico al snapshot' : '✗ DIFIERE del snapshot');
    if (doCheck && !same) process.exit(1);
  } else if (doCheck) {
    console.error('No hay snapshot con el que comparar'); process.exit(1);
  }
  if (doCheck) return;

  fs.writeFileSync(OUT, JSON.stringify(trip, null, 2) + '\n');
  console.error(`Escrito ${path.relative(ROOT, OUT)}`);
  if (doBake) {
    const n = bake(trip);
    if (n >= 0) console.error(`Horneados ${n} días en index.html (MARIA_TRIP_2024 / MARIA_HOTELS_2024).`);
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('FATAL', e.message || e); process.exit(1); }
}
module.exports = { readSheet, buildTrip, extractHotels, extractDays, verify, assertNoPrivateData,
  collectPrivateStrings, excelDateToISO, bake, ALLOWED_LINK_HOST };
