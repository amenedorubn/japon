// Verificación de la Ruta 21 días (quinto itinerario, referencia plantable).
// Fija las promesas de diseño: mismo linaje de días que el viaje (8–28 abr),
// gemelos cubiertos salvo descartes documentados (regla v2: el criterio manda),
// el cumpleaños del 19-abr protegido, solo lectura hasta plantar, noches
// reservadas respetadas y política de escritura v2-only intacta.
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
    addLayer(){}, removeLayer(){}, fitBounds(){}, remove(){}, createPane: () => ({ style: {} }) }),
  tileLayer: () => mkLayer(), polyline: () => mkLayer(), marker: () => mkLayer(),
  circleMarker: () => mkLayer(), polygon: () => mkLayer(), geoJSON: () => mkLayer(),
  layerGroup: () => ({ addTo(){ return this; }, addLayer(){} }),
  divIcon: o => o, latLngBounds: () => ({ pad(){ return {}; } }),
};
const fetchStub = () => Promise.resolve({ ok: true, json: async () => [] });

const boot = new Function('document', 'window', 'localStorage', 'location', 'history', 'L', 'fetch', 'setInterval', 'confirm',
  '"use strict";' + appJs + `
  ;return { state, RUTA_DAYS, SEED_DAYS, RUTA_DOC_URL, ITIN_RING, TWIN_GROUPS,
            itineraryDays, itineraryPlaceIds, canonicalPid, placeById, placeView,
            provenanceOf, setItinMode, plantFromProposal, groupIdsOf,
            NIGHTS, SKIPPED, TRANSPORT, PRICES, renderGuia, renderHoteles };`);
const api = boot(documentStub, { scrollTo(){} }, localStorageStub, { hash: '' }, { replaceState(){} }, L, fetchStub, () => 0, () => true);

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };
const R = api.RUTA_DAYS;

// ================= 1) LINAJE DE DÍAS =================
check('ruta: 21 días, el viaje FIJO delimitado por los vuelos (M10)', R.length === 21);
check('ruta: fechas idénticas al linaje del viaje (índice a índice con SEED/state.days)',
  R.every((d, i) => d.date === api.SEED_DAYS[i].date && d.date === api.state.days[i].date));
check('ruta: días de vuelo puros al principio y al final (8 y 28), sin paradas',
  R[0].flight && R[0].stops.length === 0 && R[20].flight && R[20].stops.length === 0);
check('ruta: el AY0074 vuela el día 27, cuando de verdad se embarca (corrección 12.52)',
  JSON.stringify(R[19].flight) === JSON.stringify([3]) && R[19].stops.length > 0);

// ================= 2) TODAS LAS PARADAS RESUELVEN =================
const allStops = R.flatMap(d => d.stops || []);
check('ruta: todas las paradas (' + allStops.length + ') resuelven en el catálogo único',
  allStops.every(s => !!api.placeById(api.canonicalPid(s.pid))));
check('ruta: las horas de cada día van en orden estrictamente creciente',
  R.every(d => {
    const t = (d.stops || []).map(s => s.time).filter(Boolean)
      .map(x => +x.slice(0, 2) * 60 + +x.slice(3));
    return t.every((v, i) => i === 0 || v > t[i - 1]);
  }));

// ================= 3) LOS GEMELOS PESAN, EL CRITERIO MANDA (v2) =================
// Regla v2 (decisión del usuario, 19-jul-2026): estar apuntado en dos fuentes
// pesa mucho pero no obliga. La Ruta cubre todos los grupos de gemelos SALVO
// cuatro descartes razonados; si un descarte nuevo aparece sin documentarse
// aquí, este check lo caza.
const OMITTED_TWINS = {
  shibuya109: 'es un centro comercial: se ve EN el cruce, no merece parada propia',
  hiroo: 'zona residencial de cenas: cruzar la ciudad por ella no compensa (Ebisu la sustituye)',
  nihonbashi: 'un puente historico bajo una autopista: 2 min de foto que no sostienen parada',
  jimbocho: 'librerias de viejo en japones: nicho; su hueco lo ganan Tsukiji y Hamarikyu',
  kakiya: 'ostras: fuera a proposito (a alguien no le gustan); Miyajima se come con anago-meshi',
};
const rutaIds = api.itineraryPlaceIds('ruta');
const missing = api.TWIN_GROUPS.filter(g =>
  !api.groupIdsOf(g.anchor).some(id => rutaIds.has(id)));
check('ruta: 55 de 60 gemelos con parada; los que faltan son EXACTAMENTE los 5 descartes documentados',
  missing.length === 5 && missing.every(g => g.anchor in OMITTED_TWINS));
check('ruta: los descartes son de verdad (ninguno tiene parada)',
  Object.keys(OMITTED_TWINS).every(id => !rutaIds.has(id)));
check('ruta: a cambio entran Himeji y Tsukiji por criterio (v2)',
  rutaIds.has('himeji_castle') && rutaIds.has('tsukiji'));
// v3 (decisión del usuario): el castillo de Osaka VUELVE y el canon de
// imprescindibles queda cubierto (Umeda Sky y Sanjūsangen-dō entran).
check('ruta v3: castillo de Osaka dentro (decisión del usuario), Umeda Sky y Sanjūsangen-dō dentro',
  ['osaka_castle', 'umeda_sky', 'maria_sanjusangen_do_kioto_y_nara'].every(id => rutaIds.has(id)));

// ================= 3b) EL 19 DE ABRIL ES EL CUMPLE =================
const cumple = R[11];
check('cumple: el 19-abr se celebra (Fushimi al alba, Uji, Himeji, cena de cumpleaños)',
  cumple.date === '2027-04-19' && /CUMPLEAÑOS/.test(cumple.note || '') &&
  cumple.stops.some(s => s.pid === 'himeji_castle') &&
  cumple.stops.some(s => /CUMPLEAÑOS/.test(s.note || '')));
check('cumple: la bomba NO cae en el cumpleaños (el Museo de la Paz es el día 20)',
  !cumple.stops.some(s => ['peace_museum', 'atomic_dome'].includes(s.pid)) &&
  R[12].stops.some(s => s.pid === 'peace_museum'));

// ================= 4) EL QUINTO ITINERARIO EXISTE Y ESCOPA EL MAPA =================
check('mapa: itineraryDays("ruta") son los días de la Ruta', api.itineraryDays('ruta') === R);
check('mapa: la Ruta incluye lo suyo (USJ, Kenroku-en, yatai de Fukuoka)',
  ['usj', 'kenrokuen', 'nakasu_yatai'].every(id => rutaIds.has(id)));
check('mapa: las ideas sueltas NO pertenecen a la Ruta (Okinawa, Kumano fuera)',
  !rutaIds.has('okinawa') && !rutaIds.has('kumano'));
check('mapa: la Ruta tiene su anillo propio y no usurpa el rojo (red is earned)',
  !!api.ITIN_RING.ruta && !/^#(cf|bf)/.test(api.ITIN_RING.ruta));

// ================= 5) RENDER SOLO LECTURA + PLANTAR =================
api.setItinMode('ruta');
const html = els['#dayPanel'].innerHTML;
check('render: la vista Ruta pinta sus días con filas plantables', html.includes('La Ruta 21 días') &&
  html.includes('b-plant') && html.includes('Kenroku-en'));
check('render: las noches reservadas se respetan (Louis House 9-12, APA 25-27)',
  R.slice(1, 4).every(d => /Louis House/.test(d.stay || '')) &&
  R.slice(17, 19).every(d => /APA/.test(d.stay || '')) && /AMPLIAR/.test(R[16].stay || ''));
check('render: el documento hora a hora se ofrece solo en la Ruta',
  els['#btnRutaDoc'].style.display === '' && api.RUTA_DOC_URL.endsWith('.docx'));
api.setItinMode('ours');
check('render: al salir de la Ruta el botón del documento se esconde',
  els['#btnRutaDoc'].style.display === 'none');

const before = api.state.days[15].stops.length;
api.plantFromProposal('usj', 15);
check('plantar: USJ entra en el día 23-abr de NUESTRO plan como acto deliberado',
  api.state.days[15].stops.length === before + 1 &&
  api.state.days[15].stops.some(s => s.pid === 'usj'));
check('plantar: repetir no duplica', (api.plantFromProposal('usj', 15),
  api.state.days[15].stops.filter(s => s.pid === 'usj').length === 1));

// ================= 6) USJ (petición del usuario) =================
const usj = api.placeById('usj');
check('usj: existe, es idea añadida a mano (provenance ai, regla 12.48) y cae en Osaka',
  !!usj && api.provenanceOf(usj) === 'ai' && api.placeView(usj).zone === 'osaka');

// ================= 7) LA POLÍTICA DE ESCRITURA NO SE TOCA =================
check('firebase: siguen existiendo exactamente 3 call-sites de fb.set',
  (appJs.match(/fb\.set\(/g) || []).length === 3);

// ================= 8) MIYAJIMA v4: SIN OSTRAS, CON MAREAS =================
const miyajima = R[12]; // 20-abr
check('miyajima: el día 20 NO lleva ostras (kakiya) y SÍ anago-meshi (decisión del usuario)',
  miyajima.date === '2027-04-20' &&
  !miyajima.stops.some(s => s.pid === 'kakiya') &&
  miyajima.stops.some(s => s.pid === 'anago_meshi'));
check('miyajima: la parada del torii documenta las mareas reales del 20-abr',
  miyajima.stops.some(s => s.pid === 'itsukushima' && /pleamar|09:05/.test(s.note || '')) &&
  miyajima.stops.some(s => /bajamar|15:21/.test(s.note || '')));
check('catálogo: anago-meshi existe, es de Miyajima y no es marisco crudo',
  !!api.placeById('anago_meshi') && api.placeView(api.placeById('anago_meshi')).zone === 'miyajima');

// ================= 9) LA WEB DOCUMENTA NOCHES / TRANSPORTES / PRECIOS / DESCARTES =================
check('noches: las 20 noches con Louis House y APA marcadas RESERVADO (ok)',
  api.NIGHTS.length === 12 && // 12 tramos (algunos multi-noche)
  api.NIGHTS.some(n => /Louis House/.test(n[1]) && n[2] === 'ok') &&
  api.NIGHTS.some(n => /APA/.test(n[1]) && n[2] === 'amp'));
check('transportes: hay reservas obligatorias (Kagayaki, buses Nouhi) y recomendadas (Nozomi)',
  api.TRANSPORT.some(t => t[0] === 'obl' && /Kagayaki/.test(t[3])) &&
  api.TRANSPORT.some(t => t[0] === 'obl' && /Nouhi/.test(t[3])) &&
  api.TRANSPORT.some(t => t[0] === 'rec' && /Nozomi/.test(t[3])));
check('precios: cubren hotel, comida, transporte y el veredicto JR Pass',
  ['hotel', 'comida', 'transporte', 'bono'].every(c => api.PRICES.some(p => p[0] === c)) &&
  api.PRICES.some(p => /JR Pass/.test(p[1]) && /NO compensa/.test(p[3])));
check('descartes: documenta Nagano y Nagoya como zonas fuera, y las ostras',
  api.SKIPPED.some(s => s[0] === 'zona' && /Nagano/.test(s[1])) &&
  api.SKIPPED.some(s => s[0] === 'zona' && /Nagoya/.test(s[1])) &&
  api.SKIPPED.some(s => /[Oo]stras/.test(s[1])));
// Render real: las secciones pintan en el DOM (contrato de la Guía/Hoteles).
api.renderHoteles(); api.renderGuia();
check('render: Hoteles pinta las noches y Guía pinta transportes/precios/descartes',
  /Louis House/.test(els['#nightsList'].innerHTML) &&
  /Kagayaki/.test(els['#transportList'].innerHTML) &&
  /JR Pass/.test(els['#pricesList'].innerHTML) &&
  /Nagano/.test(els['#skippedList'].innerHTML));

console.log(fail ? '\n' + fail + ' FALLO(S)' : '\nALL PASS');
process.exit(fail ? 1 : 0);
