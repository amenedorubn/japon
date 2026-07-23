// Phase 12 Stage 5 verification: the CONFIRMED state (Foil Press model).
// Confirmed is a deliberate, additive place flag orthogonal to provenance (§4):
// flights and the two booked hotels are confirmed by nature; sealing sets an
// explicit `confirmed` flag; unsealing only clears an explicit flag (never the
// by-nature ones); provenance is never touched.
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
  ;return { startApp, state, isBookedHotel, isConfirmed, sealPlace, unsealPlace, placeView, provenanceOf, openPlace,
    bookedHotels, renderInicio, adoptPlace };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);
api.startApp(); // Prioridad 4: arranque real gateado tras auth; los tests lo disparan a mano.

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const byId = id => api.state.places.find(p => p && p.id === id);

// ---- 1) isBookedHotel ----
check('isBookedHotel: booked reservation (apa) true', api.isBookedHotel(byId('apa_asakusabashi')) === true);
check('isBookedHotel: "por reservar" base false', api.isBookedHotel(byId('hotel_tokyo')) === false);
check('isBookedHotel: a temple is not a hotel', api.isBookedHotel(byId('catalog_sensoji')) === false);

// ---- 2) confirmed by nature vs not ----
check('isConfirmed: booked hotel is confirmed by nature', api.isConfirmed(byId('apa_asakusabashi')) === true);
check('isConfirmed: a plain place is not confirmed initially', api.isConfirmed(byId('catalog_sensoji')) === false);

// ---- 3) sealing is a deliberate act, sets the additive flag ----
const before = byId('catalog_sensoji').provenance;
check('seal: sealPlace confirms a place', api.sealPlace('catalog_sensoji') === true && api.isConfirmed(byId('catalog_sensoji')) === true);
check('seal: sets the additive confirmed flag', byId('catalog_sensoji').confirmed === true);
check('seal: provenance is NOT touched by sealing (§12.13 axis separation)', byId('catalog_sensoji').provenance === before);
check('seal: sealing an already-confirmed place is a no-op', api.sealPlace('catalog_sensoji') === false);

// ---- 4) unsealing clears only an explicit flag ----
check('unseal: unsealPlace clears an explicit confirmed flag', api.unsealPlace('catalog_sensoji') === true && api.isConfirmed(byId('catalog_sensoji')) === false);
check('unseal: a by-nature confirmed hotel cannot be unsealed here', api.unsealPlace('apa_asakusabashi') === false && api.isConfirmed(byId('apa_asakusabashi')) === true);

// ---- 5) placeView exposes confirmed ----
check('placeView exposes confirmed', api.placeView(byId('apa_asakusabashi')).confirmed === true);
check('placeView: unconfirmed place reads confirmed=false', api.placeView(byId('catalog_ueno') || byId('catalog_sensoji')).confirmed === false);

// ---- 6) Foil Press UI in the place detail (openPlace) ----
api.openPlace('apa_asakusabashi'); // confirmed by nature
const m1 = els['#modalBox'].innerHTML;
check('detail: confirmed place shows "✓ Confirmado"', m1.includes('Confirmado'));
check('detail: by-nature confirmed offers no seal button and no unseal', !m1.includes('id="pfSeal"') && !m1.includes('id="pfUnseal"'));
api.openPlace('catalog_sensoji'); // unconfirmed (sealed then unsealed above)
const m2 = els['#modalBox'].innerHTML;
check('detail: unconfirmed place offers hold-to-seal', m2.includes('id="pfSeal"') && m2.toLowerCase().includes('sellar'));

// ---- 7) El viaje de Dani (junio 2025) NUNCA es una reserva NUESTRA ----
// El PDF de Dani documenta SU viaje, ya realizado: sus 6 alojamientos traen
// checkIn/checkOut/bookingRef de 2025. Son referencia/inspiración, no reservas.
// Lo único real nuestro son apa_asakusabashi, id_louis_otsuka_nishi y FLIGHTS.

// 7a) de partida, ninguna entrada con provenance dani está confirmada
const daniPlaces = api.state.places.filter(p => p && (p.provenance || api.provenanceOf(p)) === 'dani');
check('dani: la semilla trae entradas con provenance dani', daniPlaces.length > 0);
check('dani: NINGUNA entrada con provenance dani es confirmada (sin sellado manual)',
  daniPlaces.every(p => api.isConfirmed(p) === false));
const daniLodgings = daniPlaces.filter(p => p.category === 'alojamiento');
check('dani: sus alojamientos de 2025 existen y traen campos de reserva',
  daniLodgings.length === 6 && daniLodgings.every(p => p.checkIn || p.bookingRef));
check('dani: ninguno de sus alojamientos cuenta como isBookedHotel',
  daniLodgings.every(p => api.isBookedHotel(p) === false));
check('bookedHotels(): solo nuestras 2 reservas reales',
  api.bookedHotels().map(p => p.id).sort().join(',') === 'apa_asakusabashi,id_louis_otsuka_nishi');

// 7b) LA FUGA (corregida): adoptar un hotel de Dani no lo hace reserva nuestra.
// adoptPlace pone dani=false y source='user'; sin la guarda por id dani_*,
// isBookedHotel lo aceptaba y aparecía en Confirmado con "✓ Reservado" y las
// fechas de 2025 de Dani.
(function(){
  const d = api.state.places.find(p => p && p.id === 'dani_rise_osaka');
  api.adoptPlace('dani_rise_osaka'); // la vía real de adopción, no una simulación
  check('adopt: la adopción ocurre de verdad (dani=false, source=user, daniAdopted)',
    d.dani === false && d.source === 'user' && d.daniAdopted === true);
  check('adopt: un hotel de Dani adoptado NO es isBookedHotel', api.isBookedHotel(d) === false);
  check('adopt: un hotel de Dani adoptado NO es isConfirmed', api.isConfirmed(d) === false);
  check('adopt: NO se cuela en bookedHotels()', !api.bookedHotels().some(p => /^dani_/.test(p.id)));
  api.renderInicio();
  check('adopt: NO aparece en la pestaña Confirmado',
    !els['#hotelCards'].innerHTML.includes('dani_rise_osaka'));
  check('adopt: su procedencia sigue siendo dani (§12.13, eje intacto)', api.provenanceOf(d) === 'dani');
})();

// 7c) NO-REGRESIÓN: openPlaceForm marca daniAdopted en CUALQUIER sitio editado
// con origen 'user'. Filtrar por daniAdopted (en vez de por el id) habría
// des-confirmado nuestras reservas reales al editarlas. Esto lo fija.
(function(){
  const apa = api.state.places.find(p => p && p.id === 'apa_asakusabashi');
  const louis = api.state.places.find(p => p && p.id === 'id_louis_otsuka_nishi');
  apa.daniAdopted = true;   // exactamente lo que hace openPlaceForm al guardar
  louis.daniAdopted = true;
  check('no-regresión: APA sigue confirmado tras editarlo en el formulario', api.isConfirmed(apa) === true);
  check('no-regresión: Louis sigue confirmado tras editarlo en el formulario', api.isConfirmed(louis) === true);
  check('no-regresión: bookedHotels() conserva nuestras 2 reservas',
    api.bookedHotels().map(p => p.id).sort().join(',') === 'apa_asakusabashi,id_louis_otsuka_nishi');
  api.renderInicio();
  check('no-regresión: la pestaña Confirmado sigue mostrando nuestras 2 reservas',
    els['#hotelCards'].innerHTML.includes('apa_asakusabashi') &&
    els['#hotelCards'].innerHTML.includes('id_louis_otsuka_nishi'));
})();

// 7d) La vía DELIBERADA sigue abierta: sellar a mano un lugar de Dani funciona.
// El arreglo cierra la confirmación AUTOMÁTICA (por naturaleza), no la decisión
// explícita, que vive en el flag `confirmed` y no en isBookedHotel.
(function(){
  const d = api.state.places.find(p => p && /^dani_/.test(p.id) && p.category !== 'alojamiento');
  check('seal: sellar a mano un lugar de Dani sigue funcionando',
    api.sealPlace(d.id) === true && api.isConfirmed(d) === true);
  check('seal: sellar no cambia su procedencia', api.provenanceOf(d) === 'dani');
  check('unseal: y se puede des-sellar (era un flag explícito)',
    api.unsealPlace(d.id) === true && api.isConfirmed(d) === false);
  // incluso un hotel de Dani puede sellarse a mano si es una decisión consciente
  const h = api.state.places.find(p => p && p.id === 'dani_yukari_kyoto');
  check('seal: un hotel de Dani también puede sellarse a mano (acto deliberado)',
    api.sealPlace('dani_yukari_kyoto') === true && api.isConfirmed(h) === true);
  check('seal: pero sigue sin ser isBookedHotel (no es una reserva nuestra)',
    api.isBookedHotel(h) === false && !api.bookedHotels().some(p => p.id === 'dani_yukari_kyoto'));
  api.unsealPlace('dani_yukari_kyoto');
})();

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
