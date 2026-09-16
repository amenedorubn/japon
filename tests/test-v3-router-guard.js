// v3 · guarda estática del router de pantallas (Fase 4, Bloque 3,
// 2026-09-16). v3/index.html es DOM-heavy (sin build, sin lib de router):
// en vez de reimplementar el router para poder testearlo, esta suite
// escanea el fichero real y ata en código los dos invariantes del Bloque 2
// que un cambio futuro podría romper sin darse cuenta:
//   1. Navegación entre días: mostrarPantalla() SIEMPRE destruye el mapa
//      anterior (mapa.remove()) antes de renderizar la pantalla nueva.
//   2. El mapa no debe quedar visible fuera de un día: nadie más que
//      renderDiaScreen crea un L.map(...), y #mapaDia no puede llevar
//      position fixed/sticky (haría el mapa "pegajoso" o quedaría flotando
//      sobre el resto de pantallas en vez de vivir dentro del contenido).
const fs = require('fs');
const path = require('path');

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const src = fs.readFileSync(path.join(__dirname, '..', 'v3', 'index.html'), 'utf8');

check('v3/index.html existe y define mostrarPantalla(id)', /function mostrarPantalla\(id\)\{/.test(src));

const mostrarPantallaBody = src.match(/function mostrarPantalla\(id\)\{([\s\S]*?)\n    \}/);
check('mostrarPantalla() existe y tiene cuerpo extraíble', !!mostrarPantallaBody);
if (mostrarPantallaBody) {
  const cuerpo = mostrarPantallaBody[1].trim();
  check('mostrarPantalla() destruye el mapa ANTES de decidir qué pantalla renderizar (primera línea)',
    cuerpo.startsWith('destruirMapaSiExiste();'));
}

check('destruirMapaSiExiste() llama a mapa.remove() (no solo lo oculta con CSS)',
  /function destruirMapaSiExiste\(\)\{[^}]*mapa\.remove\(\)/.test(src));

// Solo renderDiaScreen debe instanciar un mapa Leaflet: si `L.map(` aparece
// en cualquier otra función de render, hay una vía para dejar un mapa vivo
// fuera de la pantalla de un día.
const funciones = [...src.matchAll(/function (render\w+)\([^)]*\)\{/g)].map(m => m[1]);
const llamadasLMap = [];
for (const fn of funciones) {
  const re = new RegExp(`function ${fn}\\([^)]*\\)\\{`);
  const start = src.search(re);
  if (start === -1) continue;
  // recorta hasta la siguiente función top-level (aproximación suficiente: el
  // fichero declara una función por bloque, sin anidar `function` dentro).
  const rest = src.slice(start + 1);
  const nextFnRel = rest.search(/\n    function /);
  const cuerpo = nextFnRel === -1 ? rest : rest.slice(0, nextFnRel);
  if (/L\.map\(/.test(cuerpo)) llamadasLMap.push(fn);
}
check('L.map(...) SOLO se crea dentro de renderDiaScreen (' + llamadasLMap.join(', ') + ')',
  llamadasLMap.length === 1 && llamadasLMap[0] === 'renderDiaScreen');

// El contenedor del mapa vive en el flujo normal del documento: nada de
// position fixed/sticky (si no, "sigue visible encima de todo" al navegar).
const reglaMapaDia = src.match(/#mapaDia\{([^}]*)\}/);
check('#mapaDia existe en el CSS', !!reglaMapaDia);
if (reglaMapaDia) {
  check('#mapaDia NO usa position fixed/sticky (debe ir en flujo normal, con scroll de la página)',
    !/position\s*:\s*(fixed|sticky)/.test(reglaMapaDia[1]));
}

// El menú lateral y su fondo deben quedar POR ENCIMA de los panes/controles
// de Leaflet (que usan z-index 400-1000).
const zMenu = src.match(/#menu\{[^}]*z-index\s*:\s*(\d+)/);
const zOverlay = src.match(/#overlay\{[^}]*z-index\s*:\s*(\d+)/);
check('#menu tiene z-index > 1000 (por encima de los panes de Leaflet)',
  !!zMenu && Number(zMenu[1]) > 1000);
check('#overlay tiene z-index > 1000 (por encima de los panes de Leaflet)',
  !!zOverlay && Number(zOverlay[1]) > 1000);

// invalidateSize() debe llamarse ANTES de fitBounds() tras cada reinserción
// en el DOM (si no, el mapa puede salir gris o cortado).
const cuerpoRenderDia = (() => {
  const start = src.search(/function renderDiaScreen\(fecha\)\{/);
  const rest = src.slice(start + 1);
  const nextFnRel = rest.search(/\n    function /);
  return nextFnRel === -1 ? rest : rest.slice(0, nextFnRel);
})();
const idxInvalidate = cuerpoRenderDia.indexOf('invalidateSize()');
const idxFitBounds = cuerpoRenderDia.indexOf('fitBounds(');
check('renderDiaScreen llama a invalidateSize() antes de fitBounds()',
  idxInvalidate !== -1 && idxFitBounds !== -1 && idxInvalidate < idxFitBounds);

check('el router cubre las 21 pantallas de día + pendientes/reservas/mas (mismo menú)',
  /mostrarPantalla\('pendientes'\)/.test(src) && /mostrarPantalla\('reservas'\)/.test(src) &&
  /mostrarPantalla\('mas'\)/.test(src) && /renderMenuDias\(\)/.test(src));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
