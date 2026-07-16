/* ============================================================================
   IMPORTADOR DE IA — ideas de sitios sugeridas sin Maps/Insta obligatorio
   (Fase 12.52)
   ----------------------------------------------------------------------------
   Fuente: tools/ai-data.json, un array de entradas con name/city/cat y,
   opcionalmente, maps (URL de Google Maps con lat/lng). Rellenado a mano a
   partir de ideas propuestas. Este script (dev-time, Node puro, sin red)
   parsea cada entrada y escribe import/ai-places.json en el mismo formato
   que produce maria-import.js.

   Ese JSON se hornea en index.html en su propio bloque marcado:
     // @@AI_PLACES_START
     const AI_PLACES = [];
     // @@AI_PLACES_END
   Bloque propio (no el de MARIA_PLACES): así los tres orígenes (María,
   Instagram, IA) coexisten sin pisarse entre sí al hornear por separado.

   USO:  node tools/ai-import.js            # extrae y escribe el JSON
         node tools/ai-import.js --bake      # además, hornea en index.html

   INVARIANTES DEL PRODUCTO (nunca romper aquí):
   - Nunca se inventan coordenadas: si una entrada no trae Maps, se omite y se
     avisa (hace falta buscarla en Google Maps o rellenarla a mano).
   - city debe normalizar a uno de: Tokio, Osaka, Kioto, Kioto y Nara, Nara, Nagano, Nagoya.
   - cat debe ser uno de: templo, museo, naturaleza, comida, compras, mirador, otro.
============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'tools', 'ai-data.json');
const OUT = path.join(ROOT, 'import', 'ai-places.json');
const INDEX = path.join(ROOT, 'index.html');
const START_MARKER = '// @@AI_PLACES_START';
const END_MARKER = '// @@AI_PLACES_END';

const VALID_CITIES = ['Tokio', 'Osaka', 'Kioto', 'Kioto y Nara', 'Nara', 'Nagano', 'Nagoya'];
const VALID_CATS = ['templo', 'museo', 'naturaleza', 'comida', 'compras', 'mirador', 'otro'];

function readAiData() {
  if (!fs.existsSync(DATA)) throw new Error(`No existe ${path.relative(ROOT, DATA)}`);
  const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('tools/ai-data.json debe ser un array');
  return raw;
}

// Acepta varios formatos de URL/valor de Google Maps y extrae lat/lng reales.
// No inventa nada: si no encuentra coordenadas, devuelve null.
function parseLatLng(maps) {
  const s = (maps || '').trim();
  if (!s) return null;
  let m = s.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = s.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = s.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

// Normaliza la ciudad al vocabulario de la app. Devuelve null si no reconoce
// nada válido (nunca inventa una ciudad).
function normalizeCity(raw) {
  const s = (raw || '').trim();
  const u = s.toUpperCase();
  if (/^TOKYO|TOKIO/.test(u)) return 'Tokio';
  if (/^OSAKA/.test(u)) return 'Osaka';
  if (/^NAGOYA/.test(u)) return 'Nagoya';
  if (/KIOTO|KYOTO/.test(u)) return /NARA/.test(u) ? 'Kioto y Nara' : 'Kioto';
  if (/^NARA/.test(u)) return 'Nara';
  if (/^NAGANO/.test(u)) return 'Nagano';
  return VALID_CITIES.includes(s) ? s : null;
}

// Categoría heurística por palabras clave (mismo patrón que maria-import.js).
function guessCategory(text) {
  const s = (text || '').toLowerCase();
  if (/(templ|shrine|santuario|jinja|ji$|-ji|dera|tera|torii|onsen)/.test(s)) return 'templo';
  if (/(museo|museum|gallery|galer|teamlab|art)/.test(s)) return 'museo';
  if (/(park|parque|garden|jard|koen|hanami|forest|bosque|lake|lago|mount|monte|fuji|falls|cascada)/.test(s)) return 'naturaleza';
  if (/(ramen|sushi|izakaya|restaurant|restaurante|caf[eé]|coffee|market|mercado|ichiba|food|gyoza|yakiniku|bar\b)/.test(s)) return 'comida';
  if (/(shop|store|tienda|mall|don quijote|donki|uniqlo|book|disco|denden|electr)/.test(s)) return 'compras';
  if (/(tower|torre|observatory|mirador|view|skytree|deck|observation)/.test(s)) return 'mirador';
  return 'otro';
}

// cat puede venir en español libre ("Baños termales"); normaliza contra
// VALID_CATS y, si no coincide, cae a la heurística por nombre/descripción.
function normalizeCat(raw, fallbackText) {
  const s = (raw || '').trim().toLowerCase();
  if (VALID_CATS.includes(s)) return s;
  const map = { templos: 'templo', santuario: 'templo', 'baños termales': 'templo', onsen: 'templo',
    museos: 'museo', naturaleza: 'naturaleza', comida: 'comida', restaurante: 'comida',
    compras: 'compras', tienda: 'compras', mirador: 'mirador', miradores: 'mirador' };
  if (map[s]) return map[s];
  return guessCategory(fallbackText);
}

function buildPlaces(rawEntries) {
  const places = [];
  for (const e of rawEntries) {
    const name = (e.name || '').trim();
    if (!name) { console.error('✗ entrada sin name, omitida'); continue; }
    const coords = parseLatLng(e.maps);
    if (!coords) {
      console.error(`✗ ${name} — sin coordenadas Maps, omitida (búsqueda manual pendiente)`);
      continue;
    }
    const city = normalizeCity(e.city);
    if (!city) { console.error(`✗ ${name} — ciudad "${e.city || ''}" no reconocida, omitida`); continue; }
    const cat = normalizeCat(e.cat, `${name} ${e.desc || ''}`);
    const place = { name, city, lat: coords.lat, lng: coords.lng, cat };
    if (e.desc) place.notes = e.desc;
    places.push(place);
    console.error(`✓ ${name} — ${city} · ${cat}`);
  }
  return places;
}

function fmtEntry(p) {
  const parts = [`name: ${JSON.stringify(p.name)}`, `city: ${JSON.stringify(p.city)}`];
  parts.push(`lat: ${p.lat}`, `lng: ${p.lng}`, `cat: ${JSON.stringify(p.cat)}`);
  if (p.notes) parts.push(`notes: ${JSON.stringify(p.notes)}`);
  return '  {' + parts.join(', ') + '}';
}

// Hornea `places` en el bloque // @@AI_PLACES_START … END de index.html.
// Bloque propio: no toca MARIA_PLACES ni INSTA_PLACES. Si los marcadores no
// existen, avisa y no escribe nada (no inventa dónde inyectar los datos).
function bake(places) {
  if (!Array.isArray(places)) throw new Error('bake(): places debe ser un array');
  let html = fs.readFileSync(INDEX, 'utf8');
  const re = new RegExp(
    `(${START_MARKER}\\r?\\nconst AI_PLACES = )\\[[\\s\\S]*?\\](;\\r?\\n${END_MARKER})`
  );
  if (!re.test(html)) {
    console.error(
      `✗ No se encontraron los marcadores ${START_MARKER} / ${END_MARKER} en index.html. ` +
      'Añádelos junto a MARIA_PLACES antes de hornear.'
    );
    return -1;
  }
  const body = places.length ? '\n' + places.map(fmtEntry).join(',\n') + ',\n' : '';
  html = html.replace(re, `$1[${body}]$2`);
  fs.writeFileSync(INDEX, html);
  return places.length;
}

function main() {
  const doBake = process.argv.includes('--bake');
  const rawEntries = readAiData();
  const places = buildPlaces(rawEntries);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(places, null, 2) + '\n');
  console.error(`\nEscrito ${places.length} sitios en ${path.relative(ROOT, OUT)}`);

  if (doBake) {
    const n = bake(places);
    if (n >= 0) console.error(`Horneados ${n} sitios en index.html (const AI_PLACES).`);
  }
}

if (require.main === module) { try { main(); } catch (e) { console.error('FATAL', e); process.exit(1); } }
module.exports = {
  readAiData, parseLatLng, normalizeCity, normalizeCat, guessCategory, buildPlaces,
  fmtEntry, bake,
};
