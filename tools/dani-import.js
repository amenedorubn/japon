/* ============================================================================
   IMPORTADOR DANI — parsea JAPON-DEFINITIVO-Dani.pdf (Fase 3A)
   ----------------------------------------------------------------------------
   Fuente de CONTENIDO: el PDF de Dani (texto real, extraído con Node puro:
   objetos PDF + zlib inflate + CMaps ToUnicode para las fuentes Identity-H).
   Fuente de ESTRUCTURA: tools/dani-data.json — la curación manual hecha en su
   día sobre ese PDF (ids INMUTABLES referenciados por TWIN_GROUPS y la Ruta
   Dani, coordenadas, categorías, notas en español). El PDF no trae coords ni
   ids: por eso el JSON importado se corrige para conservar lo curado — lo
   inline/curado es la verdad actual (regla de Fase 3A).

   Qué hace:
   1. Extrae el texto del PDF y lo trocea en secciones por día ("N. DD JUNIO").
   2. Para CADA entrada curada busca su evidencia en el PDF (nombre normalizado
      o alias declarado) y reporta: día donde aparece o SIN EVIDENCIA.
   3. Valida (ids únicos con prefijo dani_, coords numéricas, categoría válida)
      y escribe import/dani-places.json con las entradas completas.
   4. Reporta también qué secciones/lugares del PDF no casan con ninguna
      entrada (informativo; añadirlos es decisión manual, nunca automática).

   USO:  node tools/dani-import.js            # extrae, verifica y escribe JSON
         node tools/dani-import.js --bake      # además hornea DANI_PLACES en
                                               # index.html (marcadores @@)

   INVARIANTES (nunca romper aquí):
   - Los ids del JSON salen 1:1 de tools/dani-data.json. NUNCA se inventan ni
     se renombran: TWIN_GROUPS (60 gemelos) y DANI_ROUTE_GROUPS dependen de
     ellos.
   - Nunca se inventan coordenadas ni lugares: una entrada sin evidencia en el
     PDF se REPORTA (curación manual consciente), y un lugar del PDF sin
     entrada se REPORTA; ninguno de los dos casos modifica datos por sí solo.
============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const PDF = path.join(ROOT, 'JAPON-DEFINITIVO-Dani.pdf');
const DATA = path.join(ROOT, 'tools', 'dani-data.json');
const OUT = path.join(ROOT, 'import', 'dani-places.json');
const INDEX = path.join(ROOT, 'index.html');
const START_MARKER = '// @@DANI_PLACES_START';
const END_MARKER = '// @@DANI_PLACES_END';

const VALID_CATS = ['templo', 'museo', 'naturaleza', 'comida', 'compras', 'mirador',
  'zona', 'alojamiento', 'transporte', 'excursion', 'otro'];

/* ---------------- Extracción de texto del PDF (Node puro) ---------------- */

// Indexa todos los objetos indirectos "N 0 obj ... endobj" (dict + stream).
function indexObjects(buf, s) {
  const objs = new Map();
  const objRe = /(\d+)\s+0\s+obj\b/g;
  let m;
  while ((m = objRe.exec(s))) {
    const bodyStart = m.index + m[0].length;
    const end = s.indexOf('endobj', bodyStart);
    if (end < 0) continue;
    let body = s.slice(bodyStart, end);
    let streamBuf = null;
    const sm = body.match(/stream\r?\n/);
    if (sm) {
      const sOff = bodyStart + sm.index + sm[0].length;
      streamBuf = buf.subarray(sOff, s.indexOf('endstream', sOff));
      body = body.slice(0, sm.index);
    }
    objs.set(m[1], { dict: body, streamBuf });
  }
  return objs;
}

function inflate(o) {
  if (!o || !o.streamBuf) return null;
  if (!/FlateDecode/.test(o.dict)) return o.streamBuf.toString('latin1');
  try { return zlib.inflateSync(o.streamBuf).toString('latin1'); } catch (e) { return null; }
}

// CMap ToUnicode → Map(cid → string). Cubre bfchar y bfrange (con lista o inicio).
function parseCMap(txt) {
  const map = new Map();
  if (!txt) return map;
  const hex4 = h => {
    let out = '';
    for (let i = 0; i < h.length; i += 4) out += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
    return out;
  };
  let b;
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((b = bfcharRe.exec(txt))) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = pairRe.exec(b[1]))) map.set(parseInt(p[1], 16), hex4(p[2]));
  }
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((b = bfrangeRe.exec(txt))) {
    const triRe =
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[((?:\s*<[0-9A-Fa-f]+>)+)\s*\])/g;
    let t;
    while ((t = triRe.exec(b[1]))) {
      const lo = parseInt(t[1], 16), hi = parseInt(t[2], 16);
      if (t[3] !== undefined) {
        const start = parseInt(t[3], 16);
        for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(start + (c - lo)));
      } else {
        (t[4].match(/<([0-9A-Fa-f]+)>/g) || []).forEach((it, i) =>
          map.set(lo + i, hex4(it.slice(1, -1))));
      }
    }
  }
  return map;
}

// Fuentes /Fn → {identityH, cmap} vía los diccionarios /Font <<...>> del PDF.
function collectFonts(objs, s) {
  const fontRefs = new Map();
  const fontDictRe = /\/Font\s*<<([^>]*)>>/g;
  let m;
  while ((m = fontDictRe.exec(s))) {
    const refRe = /\/(F\d+)\s+(\d+)\s+0\s+R/g;
    let r;
    while ((r = refRe.exec(m[1]))) fontRefs.set(r[1], r[2]);
  }
  const fonts = new Map();
  fontRefs.forEach((objId, fname) => {
    const o = objs.get(objId);
    if (!o) return;
    const tu = o.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    fonts.set(fname, {
      identityH: /Identity-H/.test(o.dict),
      cmap: tu ? parseCMap(inflate(objs.get(tu[1]))) : new Map(),
    });
  });
  return fonts;
}

function decodePdfString(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c !== '\\') { out += c; continue; }
    const n = str[++i];
    if (n === 'n') out += '\n';
    else if (n === 'r') out += '\r';
    else if (n === 't') out += '\t';
    else if (n >= '0' && n <= '7') {
      let oct = n;
      while (oct.length < 3 && str[i + 1] >= '0' && str[i + 1] <= '7') oct += str[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += n;
  }
  return out;
}

function decodeRun(raw, isHex, font) {
  if (!isHex) {
    const lit = decodePdfString(raw);
    if (font && font.identityH) {
      let out = '';
      for (let i = 0; i + 1 < lit.length; i += 2)
        out += font.cmap.get(lit.charCodeAt(i) * 256 + lit.charCodeAt(i + 1)) || '';
      return out;
    }
    return lit;
  }
  const hex = raw.replace(/[^0-9A-Fa-f]/g, '');
  if (font && font.identityH) {
    let out = '';
    for (let i = 0; i + 3 < hex.length; i += 4)
      out += font.cmap.get(parseInt(hex.slice(i, i + 4), 16)) || '';
    return out;
  }
  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2)
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

// Texto del PDF como líneas (agrupa runs por coordenada Y de cada página).
function extractPdfLines(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const s = buf.toString('latin1');
  const objs = indexObjects(buf, s);
  const fonts = collectFonts(objs, s);
  const pages = [];
  objs.forEach(o => {
    const txt = inflate(o);
    if (txt && /\bBT\b/.test(txt) && /\bTJ\b|\bTj\b/.test(txt)) pages.push(txt);
  });
  const runs = [];
  pages.forEach((cs, page) => {
    let x = 0, y = 0, font = null;
    const tokRe = new RegExp([
      '\\/(F\\d+)\\s+[\\d.]+\\s+Tf',
      '(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+Tm',
      '(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(Td|TD)',
      '\\(((?:[^()\\\\]|\\\\.)*)\\)\\s*Tj',
      '<([0-9A-Fa-f\\s]+)>\\s*Tj',
      '\\[((?:[^\\[\\]\\\\]|\\\\.|\\((?:[^()\\\\]|\\\\.)*\\)|<[0-9A-Fa-f\\s]*>)*)\\]\\s*TJ',
    ].join('|'), 'g');
    let t;
    while ((t = tokRe.exec(cs))) {
      if (t[1]) { font = fonts.get(t[1]) || null; continue; }
      if (t[7] !== undefined) { x = parseFloat(t[6]); y = parseFloat(t[7]); continue; }
      if (t[10]) { x += parseFloat(t[8]); y += parseFloat(t[9]); continue; }
      let text = '';
      if (t[11] !== undefined) text = decodeRun(t[11], false, font);
      else if (t[12] !== undefined) text = decodeRun(t[12], true, font);
      else if (t[13] !== undefined) {
        const partRe = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]*)>/g;
        let p;
        while ((p = partRe.exec(t[13]))) {
          if (p[1] !== undefined) text += decodeRun(p[1], false, font);
          else if (p[2] !== undefined) text += decodeRun(p[2], true, font);
        }
      }
      if (text) runs.push({ page, y: Math.round(y * 10) / 10, x, text });
    }
  });
  const byLine = new Map();
  runs.forEach(r => {
    const key = r.page + '@' + r.y;
    if (!byLine.has(key)) byLine.set(key, { page: r.page, y: r.y, parts: [] });
    byLine.get(key).parts.push(r);
  });
  return Array.from(byLine.values())
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map(l => l.parts.sort((a, b) => a.x - b.x).map(p => p.text).join('')
      .replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/* ---------------- Secciones por día y evidencia por entrada ---------------- */

const DAY_RE = /^(\d+)\.\s*(\d+)\s+JUNIO\b(.*)$/;

function splitDays(lines) {
  const days = [];
  let cur = { key: 'PREÁMBULO', lines: [] };
  lines.forEach(ln => {
    const m = ln.match(DAY_RE);
    if (m) {
      days.push(cur);
      cur = { key: `${m[2]} junio${m[3] ? ' ·' + m[3] : ''}`.trim(), lines: [] };
    }
    cur.lines.push(ln);
  });
  days.push(cur);
  return days;
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[“”«»"']/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'en', 'a', 'no',
  'templo', 'santuario', 'parque', 'puente', 'estacion', 'station', 'museo', 'mercado',
  'barrio', 'calle', 'jardines', 'jardin', 'torre', 'monte', 'isla', 'gran', 'casa',
  'castillo', 'street', 'grandes']);

function tokens(s) {
  return norm(s).split(' ').filter(t => t && t.length > 1 && !STOP.has(t));
}

/* Alias de evidencia: entradas cuyo nombre curado difiere de cómo lo escribe
   el PDF. El alias documenta la frase del PDF que respalda la entrada. */
const PDF_ALIASES = {
  dani_dotonbori: ['dotonbori'],                       // PDF parte "Glico / Man" entre líneas
  dani_nipponbashi: ['nipponbashi'],                   // PDF: "Barrio Nipponbashi (…manga…)"
  dani_shinsekai: ['shinsekai'],                       // PDF parte "Torre Tsutenkaku" de línea
  dani_rest_house: ['casa rest'],                      // PDF: "Casa Rest: conserva el aspecto…"
  dani_miyajima_pier: ['isla de mijayima', 'mijayima'], // PDF (sic): "Mijayima" (ferry 45 min)
  dani_otorii: ['otorii'],                             // PDF: "es la Otorii, gran puerta…"
  dani_itsukushima: ['itsukushima'],                   // PDF: "Santuario de Itsukushima"
  dani_nakatanido: ['nakatanido'],                     // PDF: "Nakatanido" (confitería)
  dani_ameyoko: ['yokocho amekoyo'],                   // PDF: "Mercado de Yokocho-Amekoyo"
  dani_fujisanbike: ['nbc fujisanbike'],               // PDF: "NBC (Fujisanbike Studio)"
  dani_car_rental_kyoto: ['alquiler de coche en kioto'],
  dani_ikebukuro_return: ['devolver coche'],           // PDF: "Ir hacia Tokio y devolver coche"
  dani_narita_return: ['narita international airport'],
  dani_jimbocho: ['kimbocho'],                         // PDF (sic): "barrio de los libros de Kimbocho"
  dani_kabukiza: ['teatro de kabuki ka', 'kabuki ginza'], // PDF (sic): "Teatro de Kabuki-ka"
  dani_nigatsudo: ['nigatuso do'],                     // PDF (sic): "Nigatuso-do"
  dani_kofukuji: ['kofuku ji'],
  dani_mizuya: ['mizuya chaya', 'mizuya-chaya'],
  dani_tokyo_station: ['estacion de tokio'],
  dani_imperial_palace: ['palacio imperial de tokio'],
  dani_metropolitan_gov: ['gobierno metropolitano'],
  dani_love: ['escultura love'],
  dani_misen: ['monte misen'],
  dani_daishoin: ['daisho in'],
  dani_senjokaku: ['senjo kaku'],
  dani_cafe_lente: ['cafe lente'],
  dani_kakiya: ['kakiya'],
  dani_isuien: ['isui en'],
  dani_ichino_torii: ['ichi no torii'],
  dani_ukimido: ['ukimido'],
  dani_wakamiya: ['wakamiya jinja'],
  dani_otagi: ['otagi nenbutsuji'],
  dani_saga_torimoto: ['saga torimoto'],
  dani_myoshinji: ['myoshin ji', 'taizo in'],
  dani_bamboo: ['bosque de bambu'],
  dani_arashiyama_station: ['bosque de kimonos'],
  dani_togetsukyo: ['togetsukyo'],
  dani_hirayu: ['hirayu onsen', 'hirayu-onsen'],
  dani_kamikochi: ['kamikochi', 'kappabashi'],
  dani_hotaka: ['santuario hotaka'],
  dani_myojin: ['estanque myojin'],
  dani_taisho: ['estanque taisho'],
  dani_fuji_5th: ['quinta estacion del monte fuji'],
  dani_chureito: ['pagoda chureito'],
  dani_honcho: ['calle honcho', 'honcho en shimoyoshida'],
  dani_kawaguchi: ['lago kawaguchi'],
  dani_shoji_hotel: ['shoji lake hotel'],
  dani_kazaguruma: ['kazaguruma'],
  dani_rikka_takayama: ['takayama rikka baba ichi'],
  dani_shirakawago: ['shirakawa go'],
  dani_shirakawa_hachimangu: ['shirakawa hachimangu'],
  dani_ogimachi_bridge: ['puente colgante de ogimachi'],
  dani_myozenji: ['myozen ji'],
  dani_hida_kokubunji: ['hida kokubun ji'],
  dani_kaji_bridge: ['puente de kaji'],
  dani_miyagawa_market: ['mercado matutino de miyagawa'],
  dani_sanmachi: ['caso antiguo de takayama', 'casco antiguo de takayama'],
  dani_nakabashi: ['puente de nakabashi'],
  dani_shiroyama: ['parque shiroyama', 'takayama joato'],
  dani_tobu_nikko: ['tobu nikko'],
  dani_takinoo: ['takino o'],
  dani_taiyuinbyo: ['taiyuinbyo'],
  dani_kanmangafuchi: ['kanmangafuchi'],
  dani_kintetsu_nara: ['kintetsu nara station'],
  dani_yukari_kyoto: ['yukari shijo'],
  dani_tokyo_airbnb: ['airbnb tokio'],
  dani_miyabi_asakusa: ['kimono miyabi asakusa'],
  dani_kagetsudo: ['kagetsudo'],
  dani_sumida_park: ['parque sumida'],
  dani_azuma_bridge: ['puente azuma'],
  dani_kameido_gyoza: ['kameido gyoza'],
  dani_skytree: ['skytree'],
  dani_hachiko: ['estatua de hachiko'],
  dani_shibuya_sky: ['shibuya sky'],
  dani_shibuya109: ['shibuya 109'],
  dani_gyoza_lou: ['gyoza lou'],
  dani_meiji: ['meiji jingu'],
  dani_yoyogi: ['yoyogi'],
  dani_tochomae: ['tochomae'],
  dani_golden_gai: ['golden gai'],
  dani_omoide: ['omoide yokocho'],
  dani_kabukicho: ['kabukicho'],
  dani_shin_okubo: ['shin okubo'],
  dani_nichome: ['nichome'],
  dani_roppongi: ['roppongi'],
  dani_kamakura_buddha: ['gran buda de kamakura'],
  dani_hasedera: ['hase dera'],
  dani_wakamiyaoji: ['wakamiyaoji'],
  dani_komachi: ['komachi'],
  dani_tsurugaoka: ['tsurugaoka'],
  dani_minato_mirai: ['minato mirai'],
  dani_yokohama_chinatown: ['barrio chino de yokohama'],
  dani_kix: ['aeropuerto internacional de kansai'],
  dani_shin_osaka: ['shin osaka'],
  dani_hiroshima_station: ['estacion de hiroshima'],
  dani_hiroshima_castle: ['hiroshima jo'],
  dani_rise_osaka: ['the rise osaka kitashinchi'],
  dani_vermillion: ['vermillion espresso'],
  dani_fushimi_inari: ['fushimi inari'],
  dani_kiyomizu: ['kiyomizu dera', 'kiyumizo dera'],
  dani_sannenzaka: ['sannenzaka'],
  dani_kodaiji: ['kodai ji', 'templo kodai'],
  dani_chionin: ['chion in'],
  dani_shorenin: ['shoren in'],
  dani_gion: ['gion'],
  dani_yasaka: ['yasaka'],
  dani_pontocho: ['pontocho'],
  dani_kanjiro: ['kanjiro kawai'],
  dani_nijo: ['castillo de nijo'],
  dani_kinkakuji: ['pabellon dorado'],
  dani_ryoanji: ['ryoan ji'],
  dani_tenryuji: ['tenryu ji'],
  dani_nandaimon: ['nandai mon', 'nandaimon'],
  dani_todaiji: ['todai ji'],
  dani_hokkedo: ['hokke do'],
  dani_kasuga: ['kasuga taisha', 'kasuga-taisha'],
  dani_nara_park: ['parque de nara'],
  dani_nara_museum: ['museo nacional de nara'],
  dani_naramachi: ['naramachi'],
};

/* Evidencia de una entrada en el PDF: por línea (nombre, alias o tokens) y,
   si el PDF parte el nombre entre líneas (muy común en este documento), un
   segundo pase contra el texto UNIDO de cada día conserva la atribución. */
function findEvidence(entry, days, fullNorm) {
  const aliases = (PDF_ALIASES[entry.id] || []).map(norm);
  const nameN = norm(entry.name);
  const toks = tokens(entry.name);
  for (let d = 0; d < days.length; d++) {
    for (let i = 0; i < days[d].lines.length; i++) {
      const lnN = norm(days[d].lines[i]);
      if (!lnN) continue;
      if (nameN && lnN.includes(nameN))
        return { day: days[d].key, line: days[d].lines[i], via: 'nombre' };
      if (aliases.some(a => a && lnN.includes(a)))
        return { day: days[d].key, line: days[d].lines[i], via: 'alias' };
      if (toks.length > 1 && toks.every(t => lnN.includes(t)))
        return { day: days[d].key, line: days[d].lines[i], via: 'tokens' };
    }
  }
  for (let d = 0; d < days.length; d++) {
    const dayN = norm(days[d].lines.join(' '));
    if (!dayN) continue;
    if (nameN && dayN.includes(nameN)) return { day: days[d].key, line: '', via: 'nombre·día' };
    if (aliases.some(a => a && dayN.includes(a)))
      return { day: days[d].key, line: '', via: 'alias·día' };
    if (toks.length > 1 && toks.every(t => dayN.includes(t)))
      return { day: days[d].key, line: '', via: 'tokens·día' };
  }
  if (nameN && fullNorm.includes(nameN)) return { day: '(multi-línea)', line: '', via: 'nombre' };
  return null;
}

/* ---------------- Validación y salida ---------------- */

function buildPlaces(data, days, fullNorm) {
  const seen = new Set();
  const out = [];
  const noEvidence = [];
  for (const e of data.places) {
    if (!e || !e.id || !e.name) { console.error('✗ entrada sin id/name, omitida'); continue; }
    if (!/^dani_/.test(e.id)) { console.error(`✗ ${e.id}: id sin prefijo dani_, omitida`); continue; }
    if (seen.has(e.id)) { console.error(`✗ ${e.id}: id duplicado, omitida`); continue; }
    seen.add(e.id);
    if (typeof e.lat !== 'number' || typeof e.lng !== 'number') {
      console.error(`✗ ${e.id}: sin coordenadas numéricas, omitida`); continue;
    }
    const category = VALID_CATS.includes(e.category) ? e.category : 'otro';
    const ev = findEvidence(e, days, fullNorm);
    if (ev) console.error(`✓ ${e.id} — ${ev.day} (${ev.via})`);
    else { noEvidence.push(e.id); console.error(`⚠ ${e.id} — SIN EVIDENCIA en el PDF`); }
    const place = { id: e.id, name: e.name, category, region: e.region || 'Dani',
      lat: e.lat, lng: e.lng, notes: e.notes || '' };
    ['address', 'checkIn', 'checkOut', 'bookingRef'].forEach(k => {
      if (e[k]) place[k] = e[k];
    });
    out.push(place);
  }
  return { places: out, noEvidence };
}

// Informativo: líneas de lugar del PDF (viñetas) que no casan con ninguna entrada.
function reportUnmatchedPdf(days, data) {
  const allNames = data.places.map(e => tokens(e.name).join(' ')).filter(Boolean);
  const aliasFlat = Object.values(PDF_ALIASES).flat().map(norm);
  const unmatched = [];
  days.forEach(d => {
    d.lines.forEach(ln => {
      if (!/^[-•]\s/.test(ln)) return;
      const lnN = norm(ln);
      const hit = allNames.some(nm => nm && lnN.includes(nm)) ||
        aliasFlat.some(a => a && lnN.includes(a)) ||
        data.places.some(e => {
          const t = tokens(e.name);
          return t.length && t.every(tok => lnN.includes(tok));
        });
      if (!hit) unmatched.push(`${d.key}: ${ln.slice(0, 90)}`);
    });
  });
  return unmatched;
}

/* ---------------- Bake (marcadores @@DANI_PLACES en index.html) ---------------- */

function fmtEntry(p) {
  const parts = [`id: ${JSON.stringify(p.id)}`, `name: ${JSON.stringify(p.name)}`,
    `category: ${JSON.stringify(p.category)}`, `region: ${JSON.stringify(p.region)}`,
    `lat: ${p.lat}`, `lng: ${p.lng}`, `notes: ${JSON.stringify(p.notes)}`];
  ['address', 'checkIn', 'checkOut', 'bookingRef'].forEach(k => {
    if (p[k]) parts.push(`${k}: ${JSON.stringify(p[k])}`);
  });
  return '  {' + parts.join(', ') + '}';
}

function bake(places) {
  let html = fs.readFileSync(INDEX, 'utf8');
  const re = new RegExp(
    `(${START_MARKER}\\r?\\nconst DANI_PLACES = )\\[[\\s\\S]*?\\](;\\r?\\n${END_MARKER})`
  );
  if (!re.test(html)) {
    console.error(`✗ Faltan los marcadores ${START_MARKER} / ${END_MARKER} en index.html.`);
    return -1;
  }
  const body = places.length ? '\n' + places.map(fmtEntry).join(',\n') + ',\n' : '';
  html = html.replace(re, `$1[${body}]$2`);
  fs.writeFileSync(INDEX, html);
  return places.length;
}

/* ---------------- main ---------------- */

function main() {
  const doBake = process.argv.includes('--bake');
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  if (!data || !Array.isArray(data.places)) throw new Error('tools/dani-data.json inválido');
  const lines = extractPdfLines(PDF);
  const days = splitDays(lines);
  const fullNorm = norm(lines.join(' '));
  console.error(`PDF: ${lines.length} líneas, ${days.length - 1} secciones de día\n`);

  const { places, noEvidence } = buildPlaces(data, days, fullNorm);
  const unmatchedPdf = reportUnmatchedPdf(days, data);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(places, null, 2) + '\n');
  console.error(`\nEscrito ${places.length} sitios en ${path.relative(ROOT, OUT)}`);
  if (noEvidence.length) {
    console.error(`\n⚠ ${noEvidence.length} entrada(s) curadas SIN evidencia textual en el PDF`);
    console.error('  (curación manual consciente; se conservan, la verdad es lo curado):');
    noEvidence.forEach(id => console.error('  - ' + id));
  }
  if (unmatchedPdf.length) {
    console.error(`\nℹ ${unmatchedPdf.length} viñeta(s) del PDF sin entrada curada (decisión manual):`);
    unmatchedPdf.forEach(l => console.error('  - ' + l));
  }
  if (doBake) {
    const n = bake(places);
    if (n >= 0) console.error(`\nHorneados ${n} sitios en index.html (const DANI_PLACES).`);
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('FATAL', e); process.exit(1); }
}
module.exports = { extractPdfLines, splitDays, norm, tokens, findEvidence, buildPlaces, bake };
