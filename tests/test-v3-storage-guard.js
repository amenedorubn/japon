// v3 · guarda estática: NADA fuera de v3/lib/storage.js debe tocar
// localStorage directamente (V3-DESIGN.md, Decisión 2026-09-16). Si alguien
// añade `localStorage.setItem(...)` a mano en otro fichero, este test lo
// atrapa antes de que pise una clave de v2.1 sin el prefijo 'jp27v3:'.
const fs = require('fs');
const path = require('path');

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const root = path.join(__dirname, '..', 'v3');
const storageFile = path.join(root, 'lib', 'storage.js');

function listFiles(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const candidatos = listFiles(root).filter(f =>
  (f.endsWith('.html') || f.endsWith('.js')) && f !== storageFile);

const patronDirecto = /\blocalStorage\s*[.\[]/;
const infractores = [];
for (const file of candidatos) {
  const src = fs.readFileSync(file, 'utf8');
  src.split('\n').forEach((linea, i) => {
    if (patronDirecto.test(linea)) infractores.push(`${path.relative(root, file)}:${i + 1}: ${linea.trim()}`);
  });
}

check(`v3/lib/storage.js existe y es el único punto de contacto`, fs.existsSync(storageFile));
check(`ningún otro fichero de v3/ (${candidatos.length} revisados) toca localStorage directamente`,
  infractores.length === 0);
if (infractores.length) infractores.forEach(l => console.log('  - ' + l));

// storage.js SÍ debe tocar localStorage (si no, el wrapper estaría vacío/roto).
const storageSrc = fs.readFileSync(storageFile, 'utf8');
check('v3/lib/storage.js SÍ usa rawStorage.getItem/setItem/removeItem (el wrapper real)',
  /rawStorage\.(getItem|setItem|removeItem)/.test(storageSrc));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
