/* ============================================================================
   IMPORTADOR DE MARÍA — extractor de listas de Google Maps (Fase 12)
   ----------------------------------------------------------------------------
   María es una CURADORA de exploración de primera clase: comparte listas de
   Google Maps por ciudad. Este script (dev-time, Node + Playwright) extrae
   automáticamente los sitios de cada lista y escribe import/maria-places.json.

   Ese JSON se hornea en index.html (`const MARIA_PLACES`) — la app en sí NO
   depende de Playwright ni de red en tiempo de ejecución (single-file, offline,
   PWA). El importador es una herramienta de recolección, no parte del runtime.

   POR QUÉ FUNCIONA AHORA (antes se creía imposible): el enlace corto
   maps.app.goo.gl redirige a consent.google.com (muro de consentimiento UE).
   Pre-sembrando la cookie SOCS de consentimiento, el navegador salta el muro y
   resuelve a la lista real; los nombres y coordenadas SÍ están en el DOM y en
   los href de cada sitio. Requiere: `npm i` + navegadores Playwright instalados
   (`npx playwright install chromium`).

   USO:  node tools/maria-import.js            # extrae y escribe el JSON
         node tools/maria-import.js --bake      # además, hornea en index.html

   INVARIANTES DEL PRODUCTO (nunca romper aquí):
   - provenance SIEMPRE 'maria'; los sitios viven en EXPLORACIÓN.
   - Nunca se marcan como confirmados ni se meten en el itinerario.
   - No se inventa NADA: si una lista no da datos, se omite y se avisa.
============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'import', 'maria-places.json');

// Fuente única de verdad de las URLs: se leen de MARIA_MAPS en index.html
// para no duplicarlas (si cambian allí, este script las sigue).
function readMariaMaps() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/const MARIA_MAPS\s*=\s*\[([\s\S]*?)\];/);
  if (!m) throw new Error('No se encontró MARIA_MAPS en index.html');
  const urls = [];
  const re = /url:\s*'([^']+)'(?:[^}]*?note:\s*'([^']*)')?/g;
  let x;
  while ((x = re.exec(m[1]))) urls.push({ url: x[1], note: x[2] || null });
  return urls;
}

// Categoría heurística por palabras clave del nombre (mapea a CATS de la app).
function guessCategory(name) {
  const s = (name || '').toLowerCase();
  if (/(templ|shrine|santuario|jinja|ji$|-ji|dera|tera|torii)/.test(s)) return 'templo';
  if (/(museo|museum|gallery|galer|teamlab|art)/.test(s)) return 'museo';
  if (/(park|parque|garden|jard|koen|hanami|forest|bosque|lake|lago|mount|monte|fuji|falls|cascada)/.test(s)) return 'naturaleza';
  if (/(ramen|sushi|izakaya|restaurant|restaurante|caf[eé]|coffee|market|mercado|ichiba|food|gyoza|yakiniku|bar\b)/.test(s)) return 'comida';
  if (/(shop|store|tienda|mall|don quijote|donki|uniqlo|book|disco|denden|electr)/.test(s)) return 'compras';
  if (/(tower|torre|observatory|mirador|view|skytree|deck|observation)/.test(s)) return 'mirador';
  if (/(station|estaci[oó]n|parking|aparcam)/.test(s)) return 'otro';
  return 'otro';
}

// Descarta entradas que no son sitios reales (coordenadas sueltas, parkings…).
function isNoise(name) {
  if (!name) return true;
  if (/^\d{1,3}°\d/.test(name)) return true;               // "35°39'07.1\"N …"
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(name)) return true; // "35.6,139.7"
  return false;
}

// Cada sitio de la lista es un <button class="SMP2wb"> con el nombre en
// .fontHeadlineSmall (probado). NO hay enlaces ni coordenadas en el DOM de la
// lista: las coordenadas reales se obtienen haciendo clic en el sitio (la URL
// pasa a /maps/place/.../data=...!3d<lat>!4d<lng>) y volviendo atrás.
const ITEM_SEL = 'button.SMP2wb';

// Hace scroll del panel de la lista hasta cargar todos los sitios (carga perezosa).
async function loadAllItems(page) {
  let last = -1, stable = 0;
  for (let i = 0; i < 60 && stable < 4; i++) {
    const n = await page.evaluate((sel) => {
      const first = document.querySelector(sel);
      let sc = null;
      if (first) {
        let el = first.parentElement;
        while (el && el !== document.body) {
          if (el.scrollHeight > el.clientHeight + 40) { sc = el; break; }
          el = el.parentElement;
        }
      }
      if (sc) sc.scrollTop = sc.scrollHeight;
      return document.querySelectorAll(sel).length;
    }, ITEM_SEL);
    if (n === last) stable++; else { stable = 0; last = n; }
    await page.waitForTimeout(800);
  }
}

async function extractList(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4500);
  const listUrl = page.url();
  // Ciudad = título de la lista ("TOKYO - Google Maps" -> "TOKYO").
  let city = (await page.title().catch(() => '')) || '';
  city = city.replace(/\s*-\s*Google\s*(Maps|マップ)\s*$/i, '').trim();

  await loadAllItems(page);

  // Nombres + categoría de Google (texto), leídos del DOM sin clics.
  const meta = await page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(sel)).map((b) => {
      const h = b.querySelector('.fontHeadlineSmall');
      const name = h ? h.textContent.trim() : '';
      // Última línea de texto informativo del item = categoría de Google.
      const spans = b.querySelectorAll('.IIrLbb span');
      const gcat = spans.length ? spans[spans.length - 1].textContent.trim() : '';
      return { name, gcat };
    });
  }, ITEM_SEL);

  // Coordenadas reales: clic en cada sitio -> parse de la URL -> volver atrás.
  const items = [];
  for (let i = 0; i < meta.length; i++) {
    const { name, gcat } = meta[i];
    if (!name) continue;
    let lat = null, lng = null;
    try {
      const btns = await page.$$(ITEM_SEL);
      if (!btns[i]) { items.push({ name, gcat, lat, lng }); continue; }
      await btns[i].click({ timeout: 8000 });
      await page.waitForFunction(() => /\/maps\/place\//.test(location.href), null, { timeout: 9000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const u = page.url();
      const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
      // Volver a la lista: goBack (SPA, conserva lo ya cargado) es rápido; si no
      // restaura los items, recargar la URL de la lista y re-scrollear.
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(700);
      let count = await page.evaluate((sel) => document.querySelectorAll(sel).length, ITEM_SEL);
      if (count <= i) {
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await loadAllItems(page);
      }
    } catch (e) { /* deja lat/lng en null; el sitio sigue siendo válido */ }
    items.push({ name, gcat, lat, lng });
  }

  return { city, url, items };
}

async function main() {
  const bake = process.argv.includes('--bake');
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.error('Playwright no está instalado. Ejecuta `npm i` en la raíz.'); process.exit(2); }

  let maps = readMariaMaps();
  const onlyArg = process.argv.find((a) => a.startsWith('--list='));
  if (onlyArg) { const i = parseInt(onlyArg.split('=')[1], 10); maps = maps.slice(i, i + 1); }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'es-ES' });
  // Cookie de consentimiento: salta el muro consent.google.com.
  await ctx.addCookies([
    { name: 'SOCS', value: 'CAISHAgBEhJnd3NfMjAyMzExMjgtMF9SQzIaAmVzIAEaBgiA_LyaBg', domain: '.google.com', path: '/' },
    { name: 'CONSENT', value: 'PENDING+987', domain: '.google.com', path: '/' },
  ]);
  const page = await ctx.newPage();

  const places = [];
  const summary = [];
  for (const { url, note } of maps) {
    try {
      const { city, items } = await extractList(page, url);
      const kept = items.filter((it) => !isNoise(it.name));
      kept.forEach((it) => places.push({
        name: it.name,
        city: city || 'Ideas',
        lat: it.lat, lng: it.lng,
        cat: guessCategory(it.name),
      }));
      summary.push({ url, city, found: items.length, kept: kept.length, note });
      console.error(`✓ ${city || '(sin título)'} — ${kept.length}/${items.length} sitios${note ? ' · ' + note : ''}`);
    } catch (e) {
      summary.push({ url, error: String(e).split('\n')[0], note });
      console.error(`✗ ${url} — ${String(e).split('\n')[0]}`);
    }
  }
  await browser.close();

  // Dedup global por nombre+ciudad (una lista puede repetir sitios de otra).
  const byKey = new Map();
  for (const p of places) {
    const k = (p.name + '|' + p.city).toLowerCase();
    if (!byKey.has(k)) byKey.set(k, p);
  }
  const deduped = Array.from(byKey.values());

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(deduped, null, 2) + '\n');
  console.error(`\nEscrito ${deduped.length} sitios en ${path.relative(ROOT, OUT)}`);
  console.error('Resumen:', JSON.stringify(summary, null, 2));

  if (bake) {
    const bakeMod = require('./maria-bake.js');
    bakeMod.bake(deduped);
    console.error('Horneado en index.html (const MARIA_PLACES).');
  }
}

if (require.main === module) main().catch((e) => { console.error('FATAL', e); process.exit(1); });
module.exports = { readMariaMaps, guessCategory, isNoise };
