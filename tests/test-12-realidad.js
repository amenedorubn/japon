// Verificación 12.52: la pestaña ITINERARIOS y el modo REALIDAD.
// REALIDAD solo afirma lo que el viaje ya sabe: la fecha de cada día, los
// vuelos de FLIGHTS en su fecha y las reservas confirmadas en sus noches
// (hotelForNight/bookedHotels, la misma fuente que lee Confirmado). El
// esqueleto especulativo (city/title/icon por día) se retiró, y con él la
// vista "📄 Original" — que NO es lo mismo que retirar el dato origDays.
const fs = require('fs');
const path = require('path');
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
const store = {};
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const mkLayer = () => ({ addTo(){ return this; }, bindPopup(){ return this; }, bindTooltip(){ return this; }, on(){ return this; },
  setLatLng(){ return this; }, setView(){ return this; } });
const L = {
  map: () => ({ setView(){ return this; }, on(){ return this; }, invalidateSize(){}, getZoom(){ return 11; },
    addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){} }),
  tileLayer: () => mkLayer(), polyline: () => mkLayer(), marker: () => mkLayer(),
  circleMarker: () => mkLayer(), polygon: () => mkLayer(), geoJSON: () => mkLayer(),
  layerGroup: () => ({ addTo(){ return this; }, addLayer(){} }),
  divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }),
};
const fetchStub = () => Promise.resolve({ ok: true, json: async () => [] });

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return { startApp, state, TABS, SEED_DAYS, renderCord, renderItinerary, setItinMode, zoomToDay,
            stripDaySkeleton, flightsOn, nightCityFor, hotelForNight, bookedHotels, buildSeedState };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
api.startApp(); // Prioridad 4: arranque real gateado tras auth; los tests lo disparan a mano.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const dayIdx = iso => api.state.days.findIndex(d => d.date === iso);
const panel = () => els['#dayPanel'].innerHTML;

// ---- 1) el esqueleto especulativo ya no existe en el plan ----
const skeleton = ['city', 'title', 'icon'];
check('REALIDAD: ningún día del plan afirma ciudad/título/icono',
  api.state.days.every(d => skeleton.every(f => !(f in d))));
check('REALIDAD: la semilla nace sin esqueleto',
  api.buildSeedState().days.every(d => skeleton.every(f => !(f in d))));
check('REALIDAD: los días conservan su FECHA (lo único que afirman)',
  api.state.days.length === 21 && api.state.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date)));

// ---- 2) stripDaySkeleton limpia un linaje anterior, y es idempotente ----
const legacy = [{ date: '2027-04-09', city: 'Tokio', title: 'Llegada a Tokio', icon: '🛬', stops: [] }];
check('stripDaySkeleton: limpia city/title/icon de un linaje anterior',
  api.stripDaySkeleton(legacy) === true && !('city' in legacy[0]) && !('title' in legacy[0]) && !('icon' in legacy[0]));
check('stripDaySkeleton: conserva fecha y paradas', legacy[0].date === '2027-04-09' && Array.isArray(legacy[0].stops));
check('stripDaySkeleton: idempotente (segunda pasada no cambia nada)', api.stripDaySkeleton(legacy) === false);

// ---- 3) los vuelos salen de FLIGHTS, en SU fecha ----
check('flightsOn: el 8 de abril salen los dos vuelos de ida', api.flightsOn('2027-04-08').length === 2);
check('flightsOn: el AY0074 sale el 27 (cuando se embarca), no el 28',
  api.flightsOn('2027-04-27').map(f => f.flight).join() === 'AY0074');
check('flightsOn: el 28 solo queda el AY1661 a Madrid',
  api.flightsOn('2027-04-28').map(f => f.flight).join() === 'AY1661');
check('flightsOn: un día sin vuelos no inventa ninguno', api.flightsOn('2027-04-15').length === 0);

api.setItinMode('ours');
api.zoomToDay(dayIdx('2027-04-27'));
check('REALIDAD: el día 27 muestra su vuelo real (AY0074)', panel().includes('AY0074'));
api.zoomToDay(dayIdx('2027-04-08'));
check('REALIDAD: el día de ida muestra sus dos tramos', panel().includes('AY1662') && panel().includes('AY0073'));

// ---- 4) las noches las dicen las reservas (misma fuente que Confirmado) ----
const louis = api.bookedHotels().find(p => /louis house/i.test(p.name));
check('REALIDAD: Louis House es una reserva confirmada (bookedHotels)', !!louis);
check('hotelForNight: cubre las noches 9, 10 y 11 de abril',
  ['2027-04-09', '2027-04-10', '2027-04-11'].every(x => api.hotelForNight(x) === louis));
check('hotelForNight: el 12 ya no (checkOut excluido)', api.hotelForNight('2027-04-12') !== louis);
check('nightCityFor: la ciudad sale de la reserva, no del día', api.nightCityFor('2027-04-09') === 'Tokio');
check('nightCityFor: una noche sin reserva no tiene ciudad', api.nightCityFor('2027-04-17') === '');

api.zoomToDay(dayIdx('2027-04-09'));
check('REALIDAD: la noche reservada aparece con su hotel', panel().includes('Louis House'));
check('REALIDAD: y la ciudad de esa noche se afirma (viene de la reserva)', panel().includes('🛏 Tokio'));
api.zoomToDay(dayIdx('2027-04-17'));
check('REALIDAD: una noche sin reserva no afirma ciudad', !panel().includes('🛏 '));

// ---- 5) el Cord se apoya en lo real ----
api.renderCord();
const cord = els['#cord'].innerHTML;
check('cord: el DayNode se ancla en la fecha', cord.includes('9 abr') || /\d+ \w+/.test(cord));
check('cord: el hilo solo existe donde hay reserva', /--stay:var\(--stay-[1-4]\)/.test(cord));

// ---- 6) la vista "Original" se retiró; el DATO origDays no ----
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
check('12.52: el chip "📄 Original" ya no está en la barra', !html.includes('itinModeOrig'));
check('12.52: renderOrigItinerary ya no existe', !html.includes('renderOrigItinerary'));
check('12.52: adoptRemote sigue reflejando el linaje real en origDays',
  /state\.origDays = normArr\(rs\.days\)/.test(html));
check('12.52: origDays sigue viajando en las copias (export)', /origDays: state\.origDays/.test(html));
check('12.52: la consolidación 10b (maybeMigrateOriginal) sigue en pie',
  html.includes('function maybeMigrateOriginal(') && html.includes('maybeMigrateOriginal(_legacyTransfers)'));

// ---- 7) la pestaña se llama Itinerarios; la Propuesta se queda como estaba ----
check('Itinerarios: la pestaña del eje se llama Itinerarios',
  (api.TABS.find(t => t[0] === 'itinerario') || [])[2] === 'Itinerarios');
check('Propuesta: SEED_DAYS conserva su propia ciudad/título (es una propuesta, y lo dice)',
  api.SEED_DAYS.every(sd => !!sd.city && !!sd.title) && api.SEED_DAYS.length === 21);

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
