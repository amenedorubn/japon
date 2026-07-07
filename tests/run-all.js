// Runner de las suites de verificación (fases 7a–8c).
// Uso:  node tests/run-all.js [ruta-a-live-payload.json]
// Extrae el JS inline de index.html y ejecuta cada suite contra el código real.
// La suite 8c (gate) solo corre si se pasa un volcado del payload de Firebase
// (curl .../proyectos/viaje-japon.json > live.json) — nunca se versiona.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) { console.error('No se encontró el bloque <script> principal en index.html'); process.exit(1); }
const appJs = path.join(os.tmpdir(), 'japon27-app-under-test.js');
fs.writeFileSync(appJs, m[1]);

execFileSync('node', ['--check', appJs], { stdio: 'inherit' });
console.log('SYNTAX OK\n');

const suites = ['test-7a-import.js', 'test-7b-dani.js', 'test-10a-catalog.js', 'test-10b-consolidation.js', 'test-10c-sw.js', 'test-8a-map.js', 'test-8b-platform.js'];
let failed = 0;
for (const s of suites) {
  console.log('=== ' + s + ' ===');
  try { execFileSync('node', [path.join(__dirname, s), appJs], { stdio: 'inherit' }); }
  catch (e) { failed++; }
}
const live = process.argv[2];
if (live) {
  console.log('=== test-8c-gate.js (payload en vivo) ===');
  try { execFileSync('node', [path.join(__dirname, 'test-8c-gate.js'), appJs, live], { stdio: 'inherit' }); }
  catch (e) { failed++; }
} else {
  console.log('(test-8c-gate.js omitido: pásale un volcado de Firebase para ejecutarlo)');
}
console.log(failed ? '\n' + failed + ' suite(s) con fallos' : '\nTODAS LAS SUITES PASAN');
process.exit(failed ? 1 : 0);
