/* ============================================================================
   IMPORTADOR NUESTRA — parsea Itinerario.docx (Fase 3B)
   ----------------------------------------------------------------------------
   NUESTRA es distinta del resto de fuentes: NO crea lugares. Marca como 'ours'
   entradas que YA existen en el catálogo. Su salida es el Set DOCX_OURS: la
   lista de ids del catálogo que aparecen en nuestro documento.

   Fuente: Itinerario.docx (ZIP + word/document.xml), leído con Node puro
   (lector ZIP mínimo por directorio central + zlib.inflateRawSync). Sin
   dependencias nuevas.

   El documento lista NOMBRES en prosa ("Templo de oro", "Harajuki"), no ids.
   El puente nombre→id es curación manual y vive en DOCX_TO_CATALOG, abajo:
   cada entrada declara la línea EXACTA del documento y el/los id(s) del
   catálogo que le corresponden. Se empareja por línea literal, no por
   heurística: si el documento cambia una línea, el importador avisa en vez de
   adivinar.

   USO:  node tools/docx-import.js            # extrae, verifica y escribe JSON
         node tools/docx-import.js --bake      # además hornea DOCX_OURS_IDS
         node tools/docx-import.js --check     # compara con el snapshot y sale
                                               # con código 1 si difiere

   INVARIANTES (nunca romper aquí):
   - No inventa ids: cada id sale de DOCX_TO_CATALOG, curado a mano.
   - No crea lugares: si un id no existe en el catálogo, es un error a reportar.
   - Una línea del documento sin mapeo se REPORTA, no se ignora en silencio.
============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const DOCX = path.join(ROOT, 'Itinerario.docx');
const OUT = path.join(ROOT, 'import', 'ours-places.json');
const INDEX = path.join(ROOT, 'index.html');
const SNAPSHOT = path.join(ROOT, 'tests', 'docx-ours-snapshot.json');
const START_MARKER = '// @@OURS_IDS_START';
const END_MARKER = '// @@OURS_IDS_END';

/* Encabezados del documento: son rótulos de sección, no lugares. Las bases de
   ciudad del catálogo (catalog_tokio/kioto/osaka) existen, pero son andamiaje
   de exploración con procedencia 'ai' a propósito: NO entran en NUESTRA. */
const DOCX_HEADERS = ['ITINERARIO:', 'Tokio', 'Kioto', 'Osaka'];

/* Puente línea-del-documento → id(s) del catálogo. Curado a mano; el (sic)
   marca las erratas del documento original, que se respetan tal cual. */
const DOCX_TO_CATALOG = [
  // --- Tokio ---
  { docx: 'Shibuya', ids: ['catalog_shibuya'] },
  { docx: 'Templo Senso-Ji', ids: ['catalog_sensoji'] },
  { docx: 'Parque Ueno', ids: ['catalog_ueno'] },
  { docx: 'Barrio de Ginza', ids: ['catalog_ginza'] },
  { docx: 'Isla artificial de Odaiba', ids: ['catalog_odaiba'] },
  { docx: 'Harajuki', ids: ['catalog_harajuku'] },                  // (sic) Harajuki
  { docx: 'Parque Yoyogi', ids: ['catalog_yoyogi'] },
  { docx: 'Santuario Meiji', ids: ['catalog_meiji'] },
  { docx: 'Calle Takeshita: moda', ids: ['catalog_takeshita'] },
  { docx: 'Akihabara: tiendas frikis', ids: ['catalog_akihabara'] },
  { docx: 'Shinjuku: neones', ids: ['catalog_shinjuku'] },
  { docx: 'Centro metropolitano', ids: ['catalog_tokyo_metropolitan'] },
  { docx: 'Torre Mori', ids: ['catalog_mori_tower'] },
  // --- Excursiones desde Tokio ---
  { docx: 'Excursión a Kamakura', ids: ['catalog_kamakura_excursion'] },
  { docx: 'Excursión a Takayama/Kamikochi en los alpes japoneses y dormir en ryokan típico',
    ids: ['catalog_takayama_kamikochi_excursion'] },
  { docx: 'Excursión a Nikko', ids: ['catalog_nikko_excursion'] },
  { docx: 'Excursión a Hakone y Mt Fuji', ids: ['catalog_hakone_fuji_excursion'] },
  // --- Kioto ---
  { docx: 'Bosque de bambús de Arashiyama', ids: ['catalog_arashiyama'] },
  { docx: 'Centro Pontocho', ids: ['catalog_pontocho'] },
  { docx: 'Shijo-kawaramachi', ids: ['catalog_shijo_kawaramachi'] },
  { docx: 'Castillo de Nijo', ids: ['catalog_nijo_castle'] },
  { docx: 'Templo de oro', ids: ['catalog_kinkakuji'] },            // Pabellón Dorado
  { docx: 'Higashiyama', ids: ['catalog_higashiyama'] },
  { docx: 'Calle Sannenzaka', ids: ['catalog_sannenzaka'] },
  { docx: 'Santuario Yasaka', ids: ['catalog_yasaka'] },
  { docx: 'Barrio de las geishas de Guion', ids: ['catalog_gion'] }, // (sic) Guion = Gion
  // --- Osaka + excursiones ---
  { docx: 'Denden town (barrio otaku)', ids: ['catalog_denden_town'] },
  { docx: 'Barrio de Namba: neones y luces', ids: ['catalog_namba'] },
  // 1 línea → 2 ids: la excursión Y el parque de los ciervos que nombra.
  { docx: 'Excursión a Nara e Inari (templos y ciervos)',
    ids: ['catalog_nara', 'catalog_nara_inari_excursion'] },
  { docx: 'Excursión a Hiroshima y Miyajima', ids: ['catalog_hiroshima_miyajima_excursion'] },
  { docx: 'Excursión a Uji', ids: ['catalog_uji_excursion'] },
  // --- Destinos sueltos del final del documento ---
  { docx: 'Kanazawa', ids: ['catalog_kanazawa'] },
  { docx: 'Nikko', ids: ['catalog_nikko_excursion'] },              // repite la excursión
  { docx: 'Uji', ids: ['catalog_uji_excursion'] },                  // repite la excursión
  { docx: 'Fukuoka', ids: ['catalog_fukuoka'] },
  { docx: 'Narai Juku: pueblo auténtico', ids: ['catalog_narai_juku'] },
];

/* ---------------- Lector ZIP mínimo (directorio central) ---------------- */

function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('No es un ZIP válido (falta el End Of Central Directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Directorio central corrupto');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const cmtLen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // El extra field de la cabecera local puede diferir del central: se relee.
    const dataOff = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    files.set(name, { method, raw: buf.subarray(dataOff, dataOff + compSize) });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

function decodeEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}

// Párrafos con texto de word/document.xml, en orden de documento.
function extractDocxParagraphs(file) {
  const files = readZip(file);
  const doc = files.get('word/document.xml');
  if (!doc) throw new Error('El .docx no contiene word/document.xml');
  const xml = doc.method === 0 ? doc.raw.toString('utf8')
    : zlib.inflateRawSync(doc.raw).toString('utf8');
  const paras = [];
  const pRe = /<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g;
  let m;
  while ((m = pRe.exec(xml))) {
    const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let t, s = '';
    while ((t = tRe.exec(m[0]))) s += decodeEntities(t[1]);
    s = s.replace(/\s+/g, ' ').trim();
    if (s) paras.push(s);
  }
  return paras;
}

/* ---------------- Mapeo ---------------- */

function buildOurs(paras) {
  const byDocx = new Map(DOCX_TO_CATALOG.map(e => [e.docx, e.ids]));
  const used = new Set();
  const rows = [];        // {docx, id} en orden de documento, sin repetir id
  const seenIds = new Set();
  const unmapped = [];
  paras.forEach((line, i) => {
    if (DOCX_HEADERS.includes(line)) return;   // rótulo de sección, no lugar
    const ids = byDocx.get(line);
    if (!ids) { unmapped.push({ i, line }); return; }
    used.add(line);
    ids.forEach(id => {
      if (seenIds.has(id)) { rows.push({ docx: line, id, repeat: true }); return; }
      seenIds.add(id);
      rows.push({ docx: line, id });
    });
  });
  const staleMap = DOCX_TO_CATALOG.filter(e => !used.has(e.docx)).map(e => e.docx);
  return { rows, ids: Array.from(seenIds), unmapped, staleMap };
}

/* ---------------- Bake ---------------- */

function bake(rows) {
  let html = fs.readFileSync(INDEX, 'utf8');
  const re = new RegExp(
    `(${START_MARKER}\\r?\\nconst DOCX_OURS_IDS = )\\[[\\s\\S]*?\\](;\\r?\\n${END_MARKER})`
  );
  if (!re.test(html)) {
    console.error(`✗ Faltan los marcadores ${START_MARKER} / ${END_MARKER} en index.html.`);
    return -1;
  }
  const fresh = rows.filter(r => !r.repeat);
  const body = fresh.length
    ? '\n' + fresh.map(r => `  ${JSON.stringify(r.id)}, // ${r.docx}`).join('\n') + '\n'
    : '';
  html = html.replace(re, `$1[${body}]$2`);
  fs.writeFileSync(INDEX, html);
  return fresh.length;
}

/* ---------------- main ---------------- */

function main() {
  const doBake = process.argv.includes('--bake');
  const doCheck = process.argv.includes('--check');
  const paras = extractDocxParagraphs(DOCX);
  const { rows, ids, unmapped, staleMap } = buildOurs(paras);

  console.error(`Itinerario.docx: ${paras.length} párrafos con texto`);
  console.error(`Rótulos de sección omitidos: ${DOCX_HEADERS.join(', ')}\n`);
  rows.forEach(r => console.error(
    `${r.repeat ? '↻' : '✓'} ${r.docx.slice(0, 52).padEnd(54)} → ${r.id}${r.repeat ? '  (ya mapeado)' : ''}`));
  console.error(`\n${ids.length} ids únicos desde el documento`);

  if (unmapped.length) {
    console.error(`\n⚠ ${unmapped.length} línea(s) del documento SIN mapeo (decisión manual):`);
    unmapped.forEach(u => console.error(`  [${u.i}] ${u.line}`));
  }
  if (staleMap.length) {
    console.error(`\n⚠ ${staleMap.length} entrada(s) de DOCX_TO_CATALOG que ya no casan con ninguna línea`);
    console.error('  (el documento cambió: hay que revisar el puente a mano):');
    staleMap.forEach(d => console.error('  - ' + d));
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(rows.filter(r => !r.repeat), null, 2) + '\n');
  console.error(`\nEscrito ${ids.length} ids en ${path.relative(ROOT, OUT)}`);

  if (doCheck || doBake) {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const a = new Set(snap), b = new Set(ids);
    const missing = snap.filter(id => !b.has(id));
    const extra = ids.filter(id => !a.has(id));
    console.error(`\nContra el snapshot (${snap.length} ids): faltan ${missing.length}, sobran ${extra.length}`);
    if (missing.length) console.error('  FALTAN: ' + missing.join(', '));
    if (extra.length) console.error('  SOBRAN: ' + extra.join(', '));
    if (doCheck && (missing.length || extra.length)) process.exit(1);
  }
  if (doBake) {
    const n = bake(rows);
    if (n >= 0) console.error(`\nHorneados ${n} ids en index.html (const DOCX_OURS_IDS).`);
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('FATAL', e); process.exit(1); }
}
module.exports = { readZip, extractDocxParagraphs, buildOurs, bake, DOCX_TO_CATALOG, DOCX_HEADERS };
