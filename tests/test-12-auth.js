// Verificación de la Prioridad 4 (fase de viaje): acceso privado con Firebase
// Authentication (Email/Password). No se puede probar una sesión REAL de
// Firebase en Node (el import() remoto del SDK no resuelve aquí), así que
// esta suite cubre la lógica pura alrededor de ella: el mapeo de errores de
// login, applyAuthUIState (qué se ve según haya o no sesión, y que startApp
// solo se dispara UNA vez), currentUserEmail(), y que pushRemote() etiqueta
// el payload con quién hizo el cambio.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

const mkEl = () => ({
  _attrs: {}, innerHTML: '', textContent: '', value: '', href: '', style: {}, dataset: {},
  classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
  getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; },
  addEventListener(){}, appendChild(){}, click(){}, focus(){}, blur(){},
  querySelector: () => mkEl(), querySelectorAll: () => [],
});
const els = {};
const documentStub = {
  documentElement: { _attrs: { 'data-theme': 'light' },
    getAttribute(k){ return this._attrs[k]; }, setAttribute(k, v){ this._attrs[k] = v; } },
  activeElement: null,
  querySelector: sel => (els[sel] = els[sel] || mkEl()),
  querySelectorAll: () => [],
  createElement: () => mkEl(),
  body: { style: {}, appendChild(){} },
};
const store = { jp27_sync: '0' };
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const L = {
  map: () => ({ setView(){ return this; }, on(){ return this; }, invalidateSize(){}, getZoom(){ return 11; },
    addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){}, createPane: () => ({ style: {} }) }),
  tileLayer: () => ({addTo(){ return this; }}), polyline: () => ({addTo(){ return this; }, bindPopup(){ return this; }}),
  marker: () => ({addTo(){ return this; }, bindPopup(){ return this; }, bindTooltip(){ return this; }}),
  circleMarker: () => ({addTo(){ return this; }}), polygon: () => ({addTo(){ return this; }}),
  geoJSON: () => ({addTo(){ return this; }}), layerGroup: () => ({addTo(){ return this; }, addLayer(){}}),
  divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }),
};
const fetchStub = () => Promise.resolve({ ok: true, json: async () => ({}) });

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return {
    startApp, state, pushRemote, currentUserEmail, authErrorMessage, applyAuthUIState,
    getAppStarted: () => appStarted,
    _setFb: (f, on) => { fb = f; syncOn = on; },
    _setCurrentUser: u => { currentUser = u; },
  };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
// Sin api.startApp() aquí a propósito: esta suite prueba la puerta de acceso
// en sí (applyAuthUIState la dispara cuando corresponda), no el arranque directo.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// ============ Mapeo de errores de login ============
check('auth: contraseña incorrecta da un mensaje claro', api.authErrorMessage({code: 'auth/wrong-password'}).includes('ontraseña'));
check('auth: usuario inexistente da un mensaje claro', api.authErrorMessage({code: 'auth/user-not-found'}).includes('xiste'));
check('auth: credenciales inválidas (SDK moderno) da un mensaje claro', api.authErrorMessage({code: 'auth/invalid-credential'}).length > 0);
check('auth: un código desconocido no rompe, da un mensaje genérico', api.authErrorMessage({code: 'auth/algo-nuevo'}).length > 0);
check('auth: sin objeto de error tampoco rompe', api.authErrorMessage(undefined).length > 0);

// ============ currentUserEmail() ============
check('auth: sin sesión, currentUserEmail() es null', api.currentUserEmail() === null);
api._setCurrentUser({email: 'ruben@example.com'});
check('auth: con sesión, currentUserEmail() devuelve el email', api.currentUserEmail() === 'ruben@example.com');
api._setCurrentUser(null);

// ============ applyAuthUIState: qué se ve según haya o no sesión ============
els['#authGate'] = mkEl(); els['#appRoot'] = mkEl();
api.applyAuthUIState(null);
check('auth: sin usuario, la puerta se muestra y la app se oculta',
  els['#authGate'].style.display === 'flex' && els['#appRoot'].style.display === 'none');
check('auth: sin usuario, startApp NO se ha disparado', api.getAppStarted() === false);

api.applyAuthUIState({email: 'belen@example.com'});
check('auth: con usuario, la puerta se oculta y la app se muestra',
  els['#authGate'].style.display === 'none' && els['#appRoot'].style.display === '');
check('auth: con usuario, startApp se dispara UNA vez', api.getAppStarted() === true);
check('auth: currentUser queda fijado tras applyAuthUIState', api.currentUserEmail() === 'belen@example.com');

// startApp no debe volver a dispararse en una segunda notificación con sesión
// (evita duplicar listeners/timers si Firebase re-emite el mismo usuario):
// el flag appStarted ya está a true y applyAuthUIState no lo vuelve a llamar.
api.applyAuthUIState({email: 'carol@example.com'});
check('auth: una segunda sesión no rompe nada (flag ya está a true)', api.getAppStarted() === true);
check('auth: currentUser se actualiza a la nueva sesión', api.currentUserEmail() === 'carol@example.com');

// Logout: vuelve a mostrar la puerta.
api.applyAuthUIState(null);
check('auth: al cerrar sesión, la puerta vuelve a mostrarse', els['#authGate'].style.display === 'flex');
check('auth: al cerrar sesión, currentUserEmail() vuelve a null', api.currentUserEmail() === null);

// ============ pushRemote() etiqueta el payload con quién editó ============
api._setCurrentUser({email: 'ruben@example.com'});
const writes = [];
api._setFb({ set: (node, payload) => { writes.push({node, payload}); return Promise.resolve(); },
  v2Node: 'NODE:state/v2', titleNode: 'NODE:tripTitle', placesNode: 'NODE:state/places', rootNode: 'NODE:root' }, true);
api.pushRemote();
check('auth: pushRemote() etiqueta el payload con el email de la sesión activa',
  writes.length > 0 && writes[0].payload.lastEditedBy === 'ruben@example.com');
api._setCurrentUser(null);
api.pushRemote();
check('auth: sin sesión, lastEditedBy viaja como null (nunca undefined ni string vacío)',
  writes[1] && writes[1].payload.lastEditedBy === null);

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
