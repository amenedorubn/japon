// Runs the REAL import listener extracted from index.html under Node with DOM stubs.
const fs = require('fs');
const appJs = fs.readFileSync(process.argv[2], 'utf8');

// Extract the import listener source (from the $('#importFile') line to its closing "});")
const start = appJs.indexOf("$('#importFile').addEventListener('change'");
if (start < 0) { console.error('listener not found'); process.exit(1); }
// find matching end: first occurrence of "\n});" after start
const end = appJs.indexOf('\n});', start);
const listenerSrc = appJs.slice(start, end + 4);

let results = [];
function runCase(name, fileJson, confirms, initialState) {
  // ---- stubs ----
  const calls = { commit: 0, persistLocal: 0, pushPlaces: 0, pushTitle: 0, renderAll: 0, toasts: [] };
  let confirmQueue = confirms.slice();
  const sandbox = {
    state: initialState,
    normArr: v => Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === 'object') ? Object.values(v).filter(x => x != null) : [],
    ensureSharedShape: s => { s.places = sandbox.normArr(s.places); s.transfers = sandbox.normArr(s.transfers); s.origDays = sandbox.normArr(s.origDays); if(!s.tripTitle) s.tripTitle = "Japón '27"; return s; },
    applyCatalogUpdate: () => {},
    applyTripTitle: () => {},
    commit: () => calls.commit++,
    persistLocal: () => calls.persistLocal++,
    pushPlaces: () => calls.pushPlaces++,
    pushTitle: () => calls.pushTitle++,
    renderAll: () => calls.renderAll++,
    toast: m => calls.toasts.push(m),
    confirm: () => confirmQueue.shift(),
    $: sel => sandbox.__el, // only #importFile is queried
  };
  let capturedHandler = null;
  sandbox.__el = { addEventListener: (ev, fn) => { capturedHandler = fn; } };

  const transformed = listenerSrc
    .replace("$('#importFile').addEventListener('change', async e => {", 'const __run = async e => {')
    .replace(/\}\);\s*$/, '};');
  const fn = new Function(...Object.keys(sandbox), `
    ${transformed}
    return {run: async (ev) => { await __run(ev); }, getState: () => state};
  `);

  const api = fn(...Object.values(sandbox));
  const ev = { target: { files: [{ text: async () => JSON.stringify(fileJson) }], value: 'x' } };
  return api.run(ev).then(() => ({ name, state: api.getState(), calls }));
}

const mkState = () => ({
  days: [{ date: '2027-04-08', title: 'Vuelos', stops: [], trans: [] }, { date: '2027-04-09', title: 'Llegada', stops: [{ id: 's1', pid: 'nrt' }], trans: [] }],
  places: [{ id: 'p1', name: 'Uno' }, { id: 'p2', name: 'Dos' }],
  transfers: [], origDays: [], check: {}, rate: 170, tripTitle: 'Local', updatedAt: 5,
});

(async () => {
  // A) Original-app backup, REPLACE (confirm #1 = false → replace; shrink guard: 3>=2 no prompt)
  const origBackup = { tripTitle: 'Título original', state: {
    days: [{ id: 'd_2027-04-08', label: 'Vuelos ida', date: '2027-04-08', isFlightDay: true }],
    places: [{ id: 'p1', name: 'Uno v2' }, { id: 'p9', name: 'Nueve' }, { id: 'p10', name: 'Diez' }],
    transfers: [{ id: 't1' }], catalogVersion: 'cv-x',
  }};
  let r = await runCase('A-replace', origBackup, [false], mkState());
  console.log('A-replace:',
    'places=' + r.state.places.map(p => p.id).join(','),
    'origDaysLen=' + r.state.origDays.length,
    'daysKeptV2=' + (r.state.days[0].title === 'Vuelos'),
    'title=' + r.state.tripTitle,
    'commit=' + r.calls.commit, 'pushPlaces=' + r.calls.pushPlaces, 'pushTitle=' + r.calls.pushTitle,
    'toast=' + r.calls.toasts.join('|'));

  // A2) Original-app backup, MERGE (confirm #1 = true)
  r = await runCase('A-merge', origBackup, [true], mkState());
  console.log('A-merge:  ',
    'places=' + r.state.places.map(p => p.id).join(','),
    'p1Name=' + r.state.places[0].name,
    'title=' + r.state.tripTitle,
    'persist=' + r.calls.persistLocal, 'pushPlaces=' + r.calls.pushPlaces,
    'toast=' + r.calls.toasts.join('|'));

  // B) Legacy flat v2 backup, REPLACE
  const legacy = { days: [{ date: '2027-04-08', title: 'Vuelos X', stops: [], trans: [] }], places: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], rate: 155, check: { 0: true }, v: 'v1' };
  r = await runCase('B-replace', legacy, [false], mkState());
  console.log('B-replace:',
    'day0=' + r.state.days[0].title, 'rate=' + r.state.rate, 'places=' + r.state.places.length,
    'commit=' + r.calls.commit, 'pushPlaces=' + r.calls.pushPlaces,
    'toast=' + r.calls.toasts.join('|'));

  // C) New wrapped v2 backup, REPLACE with FEWER places → guard declines (confirm: replace=false→no; guard=false→abort)
  const wrapped = { tripTitle: 'Wrapped', state: { days: [{ date: '2027-04-08', title: 'W', stops: [], trans: [] }], places: [{ id: 'only1' }], rate: 160, check: {} } };
  r = await runCase('C-shrink-decline', wrapped, [false, false], mkState());
  console.log('C-shrink-decline:',
    'placesUntouched=' + (r.state.places.length === 2),
    'daysUntouched=' + (r.state.days[0].title === 'Vuelos'),
    'noPush=' + (r.calls.pushPlaces === 0 && r.calls.commit === 0),
    'toasts=' + r.calls.toasts.join('|'));

  // C2) Same but guard accepted
  r = await runCase('C-shrink-accept', wrapped, [false, true], mkState());
  console.log('C-shrink-accept:',
    'places=' + r.state.places.map(p => p.id).join(','), 'day0=' + r.state.days[0].title,
    'title=' + r.state.tripTitle, 'commit=' + r.calls.commit, 'pushPlaces=' + r.calls.pushPlaces);

  // D) Garbage file
  r = await runCase('D-garbage', { foo: 1 }, [], mkState());
  console.log('D-garbage:', 'toast=' + r.calls.toasts.join('|'), 'untouched=' + (r.state.places.length === 2));
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
