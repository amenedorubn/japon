/* ============================================================================
   HORNEAR MARÍA — inyecta import/maria-places.json en el const MARIA_PLACES
   de index.html (Fase 12).
   ----------------------------------------------------------------------------
   La app es single-file y offline (PWA): los datos de María viven INLINE en
   index.html, no se piden por red en tiempo de ejecución (igual que el catálogo
   ya inlineado). Este paso de "horneado" es determinista y re-ejecutable:
   `node tools/maria-import.js --bake` extrae y hornea en un solo comando, o
   `node tools/maria-bake.js` hornea el JSON ya existente.

   No decide nada de producto: solo transporta {name, city, lat, lng, cat} al
   array que ensureMariaPlaces siembra como Exploración con provenance 'maria'.
============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'import', 'maria-places.json');

function fmtEntry(p) {
  const parts = [`name: ${JSON.stringify(p.name)}`, `city: ${JSON.stringify(p.city || 'Ideas')}`];
  if (typeof p.lat === 'number' && typeof p.lng === 'number') { parts.push(`lat: ${p.lat}`, `lng: ${p.lng}`); }
  if (p.cat) parts.push(`cat: ${JSON.stringify(p.cat)}`);
  if (p.notes) parts.push(`notes: ${JSON.stringify(p.notes)}`);
  return '  {' + parts.join(', ') + '}';
}

function bake(places) {
  if (!Array.isArray(places)) throw new Error('bake(): places debe ser un array');
  let html = fs.readFileSync(INDEX, 'utf8');
  const re = /const MARIA_PLACES = \[[\s\S]*?\];/;
  if (!re.test(html)) throw new Error('No se encontró el bloque const MARIA_PLACES en index.html');
  const body = places.length ? '\n' + places.map(fmtEntry).join(',\n') + ',\n' : '';
  const block = 'const MARIA_PLACES = [' + body + '];';
  html = html.replace(re, block);
  fs.writeFileSync(INDEX, html);
  return places.length;
}

if (require.main === module) {
  const places = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const n = bake(places);
  console.error(`Horneados ${n} sitios de María en index.html`);
}

module.exports = { bake, fmtEntry };
