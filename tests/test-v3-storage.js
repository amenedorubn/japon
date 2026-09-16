// v3 · único wrapper de localStorage, siempre con prefijo 'jp27v3:'
// (V3-DESIGN.md, Decisión 2026-09-16: v2.1 y v3 comparten origen y por tanto
// localStorage — nunca se debe pisar una clave de v2.1). No depende de
// index.html: prueba directamente v3/lib/storage.js con un localStorage falso.
const path = require('path');
const { PREFIX, makeStorage } = require(path.join(__dirname, '..', 'v3', 'lib', 'storage.js'));

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

check("PREFIX es 'jp27v3:'", PREFIX === 'jp27v3:');

function makeFakeRawStorage(){
  const store = {};
  const tocadas = [];
  return {
    store,
    tocadas,
    getItem(k){ tocadas.push(k); return k in store ? store[k] : null; },
    setItem(k, v){ tocadas.push(k); store[k] = String(v); },
    removeItem(k){ tocadas.push(k); delete store[k]; }
  };
}

// --- get/set/remove siempre anteponen el prefijo ---
{
  const raw = makeFakeRawStorage();
  const s = makeStorage(raw);
  s.set('tema', 'oscuro');
  check('set: la clave real en localStorage lleva el prefijo', raw.store['jp27v3:tema'] === 'oscuro');
  check('set: NO se escribe la clave sin prefijo', !('tema' in raw.store));
  check('get: devuelve el valor guardado', s.get('tema') === 'oscuro');
  s.remove('tema');
  check('remove: borra la clave CON prefijo', !('jp27v3:tema' in raw.store));
}

// --- getJSON/setJSON: round-trip + fallback seguro ---
{
  const raw = makeFakeRawStorage();
  const s = makeStorage(raw);
  check('getJSON: sin nada guardado, devuelve el fallback', JSON.stringify(s.getJSON('hechoOverrides', {})) === '{}');
  s.setJSON('hechoOverrides', { 'usj::reserva': true });
  check('getJSON: round-trip exacto', s.getJSON('hechoOverrides', {})['usj::reserva'] === true);
  check('setJSON: la clave real lleva el prefijo', 'jp27v3:hechoOverrides' in raw.store);
  raw.store['jp27v3:roto'] = '{esto no es json';
  check('getJSON: JSON corrupto no revienta, devuelve el fallback', JSON.stringify(s.getJSON('roto', 'ok')) === '"ok"');
}

// --- NUNCA se toca una clave sin el prefijo, para cualquier operación ---
{
  const raw = makeFakeRawStorage();
  const s = makeStorage(raw);
  s.set('a', '1'); s.get('b'); s.remove('c'); s.setJSON('d', [1, 2]); s.getJSON('e', null);
  check('ninguna clave tocada en localStorage carece del prefijo jp27v3:',
    raw.tocadas.every(k => k.startsWith(PREFIX)));
}

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
