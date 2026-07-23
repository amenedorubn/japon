// Verificación de la Prioridad 4 (fase de viaje, revisión): acceso privado
// con Google Sign-In + flujo de aprobación (en vez de una lista fija de
// emails). No se puede completar una sesión REAL de Google/Firebase en Node
// (el import() remoto del SDK no resuelve aquí), así que esta suite cubre:
// (a) toda la lógica pura (quién es admin, qué pantalla toca, el HTML de
// cada vista) sin ningún Firebase real, y (b) el flujo de I/O
// (resolveAccess/settleAccess/panel de admin) contra una base de datos FALSA
// en memoria inyectada vía _setAuthM/_setAccessDb — mismo patrón que los
// demás setters de test ya usados en el resto de la suite (setMapDay, etc.).
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

const mkEl = () => ({
  _attrs: {}, innerHTML: '', textContent: '', value: '', href: '', style: {}, dataset: {}, disabled: false,
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
    startApp, state, pushRemote, currentUserEmail,
    buildAccessRequest, isDesignatedAdmin, computeGateView, authErrorMessage,
    authGateHTML, adminPanelHTML, settleAccess, resolveAccess, updateAdminButton,
    setAccessStatus, renderAdminPanel,
    getAppStarted: () => appStarted, getCurrentAccessRecord: () => currentAccessRecord,
    _setFb: (f, on) => { fb = f; syncOn = on; },
    _setAuthM: m => { authM = m; }, _setAccessDb: d => { accessDb = d; },
    _setAuth: a => { auth = a; },
  };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
// Sin api.startApp() aquí a propósito: esta suite prueba la puerta de acceso
// en sí (settleAccess la dispara cuando corresponda), no el arranque directo.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

// ============ Base de datos falsa en memoria (para resolveAccess/settleAccess/panel) ============
let fakeDb = {};
const fakeAuthM = {
  dbRef: (db, path) => path,
  dbGet: async path => ({ val: () => (path in fakeDb ? fakeDb[path] : null) }),
  dbSet: async (path, value) => { fakeDb[path] = JSON.parse(JSON.stringify(value)); },
  signOut: async () => {},
  GoogleAuthProvider: function GoogleAuthProvider(){},
  signInWithPopup: async () => {},
};
api._setAuthM(fakeAuthM);
api._setAccessDb('FAKE_DB');
api._setAuth('FAKE_AUTH');

const ruben = { uid: 'uid_ruben', email: 'ruben@example.com', displayName: 'Rubén', photoURL: 'https://x/ruben.jpg' };
const belen = { uid: 'uid_belen', email: 'belen@example.com', displayName: 'Belén', photoURL: null };

// ============ Funciones puras ============
check('buildAccessRequest: trae exactamente los campos pedidos, status pending por defecto', (() => {
  const r = api.buildAccessRequest(ruben);
  return r.uid === 'uid_ruben' && r.email === 'ruben@example.com' && r.displayName === 'Rubén' &&
    r.photoURL === ruben.photoURL && r.status === 'pending' && r.role === 'traveler' && typeof r.createdAt === 'number';
})());

check('isDesignatedAdmin: coincide con el email del administrador', api.isDesignatedAdmin('ruben@example.com', 'ruben@example.com') === true);
check('isDesignatedAdmin: no coincide con otro email', api.isDesignatedAdmin('belen@example.com', 'ruben@example.com') === false);
check('isDesignatedAdmin: sin adminEmail configurado, nadie es admin', api.isDesignatedAdmin('ruben@example.com', null) === false);
check('isDesignatedAdmin: sin email, nunca es admin', api.isDesignatedAdmin(null, 'ruben@example.com') === false);

check('computeGateView: sin usuario -> signin', api.computeGateView(null, null) === 'signin');
check('computeGateView: usuario sin registro todavía -> pending', api.computeGateView(ruben, null) === 'pending');
check('computeGateView: registro pending -> pending', api.computeGateView(ruben, {status: 'pending'}) === 'pending');
check('computeGateView: registro approved -> approved', api.computeGateView(ruben, {status: 'approved'}) === 'approved');
check('computeGateView: registro rejected -> rejected', api.computeGateView(ruben, {status: 'rejected'}) === 'rejected');

check('authErrorMessage: ventana de Google cerrada da un mensaje claro', api.authErrorMessage({code: 'auth/popup-closed-by-user'}).length > 0);
check('authErrorMessage: proveedor no habilitado da un mensaje claro (guía la config pendiente)',
  api.authErrorMessage({code: 'auth/operation-not-allowed'}).includes('activado'));
check('authErrorMessage: código desconocido no rompe, da un mensaje genérico', api.authErrorMessage({code: 'auth/algo-nuevo'}).length > 0);
check('authErrorMessage: sin objeto de error tampoco rompe', api.authErrorMessage(undefined).length > 0);

// ============ HTML de cada vista de la puerta ============
check('authGateHTML(signin): botón de Google presente, sin email/contraseña',
  api.authGateHTML('signin', null).includes('authGoogleBtn') && !api.authGateHTML('signin', null).includes('type="password"'));
check('authGateHTML(pending): saluda por nombre y NO permite entrar (solo comprobar/salir)',
  api.authGateHTML('pending', ruben).includes('Rubén') && api.authGateHTML('pending', ruben).includes('authRetry'));
check('authGateHTML(rejected): mensaje de rechazo + salir, sin botón de reintentar',
  api.authGateHTML('rejected', ruben).includes('no ha sido aprobado') && !api.authGateHTML('rejected', ruben).includes('authRetry'));
check('authGateHTML(connecting): no expone ni el botón de Google ni acciones', !api.authGateHTML('connecting', null).includes('authGoogleBtn'));

// ============ Panel de administración: HTML ============
const panelUsers = [
  {uid: 'p1', email: 'p1@x.com', displayName: 'Pendiente Uno', status: 'pending'},
  {uid: 'a1', email: 'a1@x.com', displayName: 'Aprobada', status: 'approved', role: 'traveler'},
  {uid: 'admin1', email: 'ruben@example.com', displayName: 'Rubén', status: 'approved', role: 'admin'},
  {uid: 'r1', email: 'r1@x.com', displayName: 'Rechazado', status: 'rejected'},
];
const panelHTML = api.adminPanelHTML(panelUsers);
check('adminPanelHTML: el pendiente tiene botones de aprobar/rechazar', panelHTML.includes('data-approve="p1"') && panelHTML.includes('data-reject="p1"'));
check('adminPanelHTML: el aprobado (no-admin) tiene botón de revocar', panelHTML.includes('data-revoke="a1"'));
check('adminPanelHTML: el admin NO tiene botón de revocar (se ve como "Admin")', !panelHTML.includes('data-revoke="admin1"') && panelHTML.includes('>Admin<'));
check('adminPanelHTML: el rechazado se puede volver a aprobar', panelHTML.includes('data-approve="r1"'));
check('adminPanelHTML: sin pendientes, dice que no hay nadie esperando', !api.adminPanelHTML(panelUsers.slice(1)).includes('data-approve="p1"'));

(async () => {
  // ============ resolveAccess: crear la solicitud + auto-promoción del admin ============
  fakeDb = {}; // sin adminEmail todavía
  let record = await api.resolveAccess(belen);
  check('resolveAccess: usuario nuevo sin adminEmail configurado queda pending', record.status === 'pending');
  check('resolveAccess: el registro queda guardado en la base de datos', fakeDb['proyectos/viaje-japon/access/users/uid_belen'].status === 'pending');

  // Un segundo resolveAccess para la MISMA persona no la re-crea ni pierde el estado si un admin ya la aprobó.
  fakeDb['proyectos/viaje-japon/access/users/uid_belen'].status = 'approved'; // simula que el admin ya aprobó
  record = await api.resolveAccess(belen);
  check('resolveAccess: no pisa una aprobación ya hecha por el admin', record.status === 'approved');

  // Ahora se configura el adminEmail (paso manual del usuario en consola),
  // MANTENIENDO el registro ya aprobado de belén (no se borra nada solo por
  // añadir el admin: son dos cambios independientes en la base de datos real).
  fakeDb['proyectos/viaje-japon/access/adminEmail'] = 'ruben@example.com';
  record = await api.resolveAccess(ruben);
  check('resolveAccess: el email designado se auto-promueve a approved+admin la primera vez',
    record.status === 'approved' && record.role === 'admin');
  check('resolveAccess: la auto-promoción queda persistida', fakeDb['proyectos/viaje-japon/access/users/uid_ruben'].role === 'admin');

  // Alguien que NO es el admin designado sigue con su estado tal cual (no se
  // auto-promueve a admin por el mero hecho de que exista un adminEmail).
  record = await api.resolveAccess(belen);
  check('resolveAccess: quien no es el admin designado no se auto-promueve', record.status === 'approved' && record.role !== 'admin');

  // ============ settleAccess: qué se ve y cuándo arranca la app ============
  fakeDb = {};
  els['#authGate'] = mkEl(); els['#appRoot'] = mkEl(); els['#btnAdmin'] = mkEl();
  await api.settleAccess(belen); // primera vez: sin registro -> pending
  check('settleAccess: usuario nuevo ve la puerta (pending), NO entra a la app',
    els['#authGate'].style.display === 'flex' && els['#appRoot'].style.display === 'none');
  check('settleAccess: startApp NO se dispara para un pending', api.getAppStarted() === false);

  fakeDb['proyectos/viaje-japon/access/adminEmail'] = 'ruben@example.com';
  await api.settleAccess(ruben); // el admin designado se auto-aprueba y entra
  check('settleAccess: el administrador designado entra directamente (auto-promoción)',
    els['#authGate'].style.display === 'none' && els['#appRoot'].style.display === '');
  check('settleAccess: startApp se dispara UNA vez al entrar', api.getAppStarted() === true);
  check('settleAccess: el botón de admin se muestra para el administrador', els['#btnAdmin'].style.display === '');
  check('currentUserEmail: refleja la sesión activa', api.currentUserEmail() === 'ruben@example.com');

  // Logout: vuelve a mostrar la puerta (signin), sin volver a arrancar la app.
  await api.settleAccess(null);
  check('settleAccess: al cerrar sesión, la puerta vuelve a mostrarse', els['#authGate'].style.display === 'flex');
  check('settleAccess: al cerrar sesión, currentUserEmail() vuelve a null', api.currentUserEmail() === null);

  // ============ setAccessStatus: aprobar/rechazar/revocar desde el panel ============
  fakeDb = { 'proyectos/viaje-japon/access/users/uid_belen': api.buildAccessRequest(belen) };
  await api.setAccessStatus('uid_belen', 'approved');
  check('setAccessStatus: aprobar cambia el status en la base de datos', fakeDb['proyectos/viaje-japon/access/users/uid_belen'].status === 'approved');
  await api.setAccessStatus('uid_belen', 'rejected'); // revocar = poner rejected
  check('setAccessStatus: revocar (rejected) también se refleja', fakeDb['proyectos/viaje-japon/access/users/uid_belen'].status === 'rejected');
  await api.setAccessStatus('uid_no_existe', 'approved');
  check('setAccessStatus: un uid inexistente no crea nada de la nada', !('proyectos/viaje-japon/access/users/uid_no_existe' in fakeDb));

  // ============ pushRemote() sigue etiquetando el payload con quién editó ============
  const writes = [];
  api._setFb({ set: (node, payload) => { writes.push({node, payload}); return Promise.resolve(); },
    v2Node: 'NODE:state/v2', titleNode: 'NODE:tripTitle', placesNode: 'NODE:state/places', rootNode: 'NODE:root' }, true);
  await api.settleAccess(ruben); // vuelve a fijar currentUser tras el logout de arriba
  api.pushRemote();
  check('pushRemote: sigue etiquetando el payload con el email de la sesión activa',
    writes.length > 0 && writes[writes.length - 1].payload.lastEditedBy === 'ruben@example.com');

  console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})();
