// v3 · informe de posibles duplicados (V3-DESIGN.md, Decisión 2026-09-16 punto 2).
// No depende de index.html: prueba directamente v3/lib/dedupe.js.
const path = require('path');
const dedupe = require(path.join(__dirname, '..', 'v3', 'lib', 'dedupe.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

check('normalizeName: acentos, mayúsculas y puntuación no distinguen',
  dedupe.normalizeName('Tōshōgū (Nikkō)!!') === dedupe.normalizeName('toshogu nikko'));
check('normalizeName: nombres distintos de verdad siguen distintos',
  dedupe.normalizeName('Shibuya Sky') !== dedupe.normalizeName('Shibuya 109'));

check('haversineMeters: mismo punto da 0',
  dedupe.haversineMeters({ lat: 35.66, lng: 139.70 }, { lat: 35.66, lng: 139.70 }) === 0);
check('haversineMeters: sin coordenadas en alguno de los dos da null',
  dedupe.haversineMeters(null, { lat: 35.66, lng: 139.70 }) === null);
{
  // ~111 m de diferencia en latitud (1/1000 de grado ≈ 111 m).
  const d = dedupe.haversineMeters({ lat: 35.660, lng: 139.70 }, { lat: 35.661, lng: 139.70 });
  check('haversineMeters: 0.001° de latitud son ~111 m (rango 100-125)', d > 100 && d < 125);
}

const items = [
  { id: 'a', nombre: 'Templo Sensō-ji', ubicacion: { lat: 35.7148, lng: 139.7967 } },
  { id: 'b', nombre: 'TEMPLO SENSO-JI', ubicacion: { lat: 35.9000, lng: 139.1000 } }, // mismo nombre normalizado, lejos
  { id: 'c', nombre: 'Otro sitio cualquiera', ubicacion: { lat: 35.7149, lng: 139.7968 } }, // ~13 m de 'a'
  { id: 'd', nombre: 'Sitio sin coordenadas', ubicacion: null },
  { id: 'e', nombre: 'Sitio totalmente distinto', ubicacion: { lat: 34.0, lng: 135.0 } }
];

const report = dedupe.findPotentialDuplicates(items);

check('findPotentialDuplicates: detecta duplicado por NOMBRE (a/b), aunque estén lejos',
  report.some(d => (d.a === 'a' && d.b === 'b') || (d.a === 'b' && d.b === 'a')));
check('findPotentialDuplicates: ese duplicado se marca razon "nombre"',
  report.find(d => (d.a === 'a' && d.b === 'b') || (d.a === 'b' && d.b === 'a')).razon === 'nombre');

check('findPotentialDuplicates: detecta duplicado por COORDENADAS (a/c), aunque el nombre no coincida',
  report.some(d => (d.a === 'a' && d.b === 'c') || (d.a === 'c' && d.b === 'a')));
check('findPotentialDuplicates: ese duplicado se marca razon "coordenadas" con distancia en metros',
  report.find(d => (d.a === 'a' && d.b === 'c') || (d.a === 'c' && d.b === 'a')).razon === 'coordenadas' &&
  report.find(d => (d.a === 'a' && d.b === 'c') || (d.a === 'c' && d.b === 'a')).distanciaM < 150);

check('findPotentialDuplicates: NO reporta el par (a/e), ni nombre ni coordenadas coinciden',
  !report.some(d => (d.a === 'a' && d.b === 'e') || (d.a === 'e' && d.b === 'a')));
check('findPotentialDuplicates: un ítem sin coordenadas nunca revienta ni se reporta por coordenadas',
  !report.some(d => (d.a === 'd' || d.b === 'd') && d.razon.includes('coordenadas')));
check('findPotentialDuplicates: nunca informa un ítem contra sí mismo',
  !report.some(d => d.a === d.b));
check('findPotentialDuplicates: NUNCA fusiona nada, solo informa (la lista de entrada no se toca)',
  items.length === 5 && items.every(it => 'id' in it));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
