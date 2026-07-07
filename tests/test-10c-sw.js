// Phase 10c verification: offline service worker. Checks sw.js syntax and
// contract plus its registration inside the app's main script block.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const appJs = fs.readFileSync(process.argv[2], 'utf8');
const swPath = path.join(__dirname, '..', 'sw.js');

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

check('sw.js exists next to index.html', fs.existsSync(swPath));
const sw = fs.readFileSync(swPath, 'utf8');

// syntax
try { execFileSync('node', ['--check', swPath], { stdio: 'pipe' }); check('sw.js: valid syntax', true); }
catch (e) { check('sw.js: valid syntax', false); }

// cache contract
check('sw: versioned cache name (japon27-*)', /const CACHE = 'japon27-v\d+'/.test(sw));
check('sw: shell precaches the app and the Dani PDF',
  sw.includes("'./'") && sw.includes('JAPON-DEFINITIVO-Dani.pdf'));
check('sw: runtime hosts cover Leaflet, fonts and Firebase modules',
  ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'].every(h => sw.includes(h)));
check('sw: activate cleans old japon27-* caches', sw.includes("k.startsWith('japon27-') && k !== CACHE"));
check('sw: only GET requests handled', sw.includes("req.method !== 'GET'"));
check('sw: navigations fall back to the shell', sw.includes("cacheFirst(e, req, './')"));
check('sw: never caches partial responses (206-safe: status === 200 or opaque)',
  sw.includes('res.status === 200') && sw.includes("res.type === 'opaque'") && !/res\.ok/.test(sw));
check('sw: live APIs never intercepted (no tiles/nominatim/osrm/overpass hosts)',
  !/cartocdn|nominatim|routing\.openstreetmap|overpass|firebasedatabase/.test(sw));

// registration inside the ONE main script block (extraction contract intact)
check('app: registers ./sw.js guarded by feature detection',
  appJs.includes("'serviceWorker' in navigator") && appJs.includes("navigator.serviceWorker.register('./sw.js')"));
check('app: registration failure is swallowed (file:// or unsupported)',
  /register\('\.\/sw\.js'\)\.catch\(\(\) => \{\}\)/.test(appJs));

console.log(fail ? '\n' + fail + ' FAILURES' : '\nALL PASS');
process.exit(fail ? 1 : 0);
