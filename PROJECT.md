# PROJECT.md — Referencia canónica del proyecto

**Léeme primero.** Este documento existe para que otra conversación de Claude (u otra persona)
pueda continuar el desarrollo sin pérdida de contexto. Complementos: `PRODUCT.md` (estrategia),
`DESIGN.md` (sistema visual), `PARITY.md` (cierre de paridad), `README.md` (usuario final),
`tests/` (suite de regresión). El repositorio git es la fuente de verdad.

---

## 1. Qué es este proyecto

Planificador compartido del viaje a Japón de **tres amigos españoles** (8–28 de abril de 2027,
21 días, vuelos Finnair Madrid⇄Tokio ya reservados). **No es una app de pareja: siempre tres
viajeros.** Una sola página (`index.html`, HTML+CSS+JS vanilla, sin build) publicable en GitHub
Pages, instalable como PWA, con sincronización opcional por Firebase RTDB entre los tres móviles.

Historia: existía una **app original** (conservada como referencia de solo lectura en
`index-pre-source.html`, 8.694 líneas) que los viajeros ya usaban con datos reales en Firebase.
Este proyecto la fusionó con una arquitectura rediseñada **sin perder ninguna funcionalidad ni
dato** (prioridad absoluta nº 1). La paridad funcional se alcanzó y verificó en la Fase 8c; el
rediseño visual premium llegó en la Fase 9.

## 2. Ficheros del repositorio

| Fichero | Papel |
|---|---|
| `index.html` | LA app entera (~3.6k líneas: head+PWA, CSS del sistema visual, HTML, JS) |
| `index-pre-source.html` | App original descomprimida. **Referencia permanente, no borrar**: contiene además el único embed del PDF de Dani |
| `JAPON-DEFINITIVO-Dani.pdf` | Asset local (811.736 B) que descarga el botón 📄 de la vista Dani (`DANI_PDF_URL`) |
| `PROJECT.md` `PRODUCT.md` `DESIGN.md` `PARITY.md` | Documentación (este orden: continuidad → estrategia → visual → paridad) |
| `tests/run-all.js` + `tests/test-*.js` | Suite de regresión completa (ver §10) |
| `.claude/serve.ps1` | Servidor local de desarrollo (`http://localhost:8734/`) |

## 3. Arquitectura

Un solo archivo, JS vanilla sin framework, Leaflet 1.9 por CDN. Secciones del script (en orden):
utilidades → datos (`FLIGHTS`, `AIRPORTS`, `CATS`, `MODES`, catálogo curado `PLACES`, itinerario
semilla `SEED_DAYS`, guía) → catálogo compartido portado de la app original (`CATALOG_PLACES_RAW`,
`DANI_PLACES_RAW`, `DANI_ROUTE_GROUPS`, `applyCatalogUpdate`) → `CATALOG_ALIAS` → estado y
persistencia → Firebase → cabecera/tema/título/notificaciones → sitios propios y formulario →
hoteles → rutas reales (OSRM/Overpass) → navegación → Inicio → Itinerario (3 vistas) →
reordenación e inferencia de horas → modales → mapa → Sitios → Guía → export/import → init.

Render: funciones `renderX()` que reconstruyen `innerHTML` por sección; `renderAll()` para todo.
Los manejadores de las plantillas son `onclick` inline sobre funciones globales (deuda D5,
prevista para limpieza; los tests dependen de algunos de esos strings — ver §12).

## 4. Modelo de datos (`state`, persistido en localStorage `japon27_app_v1`)

```
state = {
  v, updatedAt, rate (¥/€), check {i:bool},          // v2: SOLO de esta app
  days: [ { date, title, city, icon, flight:[ids]?,  // 21 días FIJOS (decisión M10)
            stops: [{id, pid, time, dur, note, done}],
            trans: [{sel, opts:[{id,m,t,d,y,l,n,w,auto}]}],  // 1 por hueco entre paradas
            pre?, post? } ],
  tripTitle,                                          // compartido (escalar)
  places: [...],                                      // COMPARTIDO con la app original
  transfers: [...],                                   // del modelo original: solo lectura aquí
  origDays: [...],                                    // espejo solo-lectura de sus días
  catalogVersion                                      // versionado del catálogo compartido
}
```

- **Dos catálogos coexisten**: `PLACES` (curado, claves tipo `sensoji`, ficha rica) y
  `state.places` (esquema de la app original; ids `catalog_*`, `dani_*`, `airport_*`, `id_*` de
  usuario). `placeById(pid)` resuelve ambos; `CATALOG_ALIAS` (26 entradas) evita listados
  duplicados dejando ganar a la versión curada. La fusión REAL de ids es Fase 10: fusionar antes
  rompería la app original.
- **Dos modelos de trayectos**: `day.trans` (v2, por hueco) y `state.transfers` (original, por
  par de lugares; solo lectura). Consolidación en Fase 10.
- `stops[].pid` puede apuntar a cualquiera de los dos catálogos.
- Origen de un lugar compartido: `sourceValueForPlace` → `user` | `dani` | `insta`
  (flags `dani`, `daniAdopted`, `catalogItem` gobiernan la re-siembra de `applyCatalogUpdate`).

## 5. Firebase — estructura y POLÍTICA DE ESCRITURA (invariante crítico)

Base: `viaje-japon-8748a` (europe-west1). Ruta compartida `proyectos/viaje-japon`
(o `proyectos/<hash>` si la URL trae un hash que no empieza por `/`).

```
proyectos/viaje-japon = {
  tripTitle,                       ← escalar compartido (ambas apps escriben)
  state: {
    days, places, transfers, catalogVersion,   ← modelo de la APP ORIGINAL
    v2: { v, days, rate, check, updatedAt }    ← nodo EXCLUSIVO de esta app
  }
}
```

**Política v2-only (no negociable): exactamente 3 call-sites de `fb.set` y ningún otro.**
`pushRemote → state/v2` (payload exacto `{v,days,rate,check,updatedAt}`, debounce 1.2 s) ·
`pushPlaces → state/places` (array completo, debounce 800 ms) · `pushTitle → tripTitle`
(debounce 600 ms). **Nada puede escribir jamás `state/days` ni `state/transfers`** (el
itinerario de la app original). Lectura: `onValue` sobre el nodo raíz → `adoptRemote`, con
guardas: un remoto sin lugares nunca borra los locales; v2 remoto solo gana si su `updatedAt`
es mayor; arrays vacíos podados por Firebase se reparan con `normArr`; eco propio suprimido
(2,5 s) para las notificaciones. La suite `test-8c-gate.js` verifica todo esto con un `fb` falso.

## 6. Export / Import (compatibilidad bidireccional)

Export: envoltorio `{tripTitle, state}` — el mismo de la app original, que puede leer nuestra
copia. Import acepta **tres formatos**: (A) copia de la app original `{tripTitle, state:{days
label/fecha, places, transfers}}` — solo toca campos compartidos + espejo `origDays`, jamás el
itinerario v2; (B) copias antiguas de esta app (estado plano con días v2); (C) formato actual
envuelto. Siempre con elección **Fusionar** (añade lo que falte, no borra) / **Reemplazar**, y
con guard: una copia con menos lugares que el plan actual exige una segunda confirmación
explícita antes de reducir `state.places`.

## 7. Historia de fases (cronológica, con commits)

| Fase | Commit | Objetivo | Decisiones clave |
|---|---|---|---|
| Base | `fcc07bb` | Punto de partida del rediseño + tooling | App rediseñada de 1.7k líneas; serve.ps1 |
| Ref | `ce62bed` | App original descomprimida como referencia | Solo lectura, permanente |
| 1 | `63df01a` | Modelo de datos compartido + adaptador Firebase seguro | Nace la política v2-only sobre `proyectos/viaje-japon` |
| 2 | `9e69d24` | Paridad de cabecera | Drive/Spotify, tema, título editable compartido, campana |
| 3 | `f30623d` | Creación de sitios propios | Formulario + mini-mapa + Nominatim; sync por `state/places` |
| 4 | `521e4c9` | Pestaña Hoteles | Campos estructurados con los MISMOS nombres que la app original; fix hash-vs-proyecto |
| 5 | `5d4f6d1` | Profundidad de mapa | Capas N/D/I, polígonos de zona + cola de límites Nominatim (caché compartida `viaje-japon-boundary-v3:`), rail real Overpass (caché `viaje-japon-rail-v1:`) |
| 6 | `8965288` | Interacción del itinerario | Drag&drop ratón+táctil (pulsación 420 ms), mover de día, waypoints |
| — | — | **Auditoría de paridad completa** + hoja de ruta 7a→11 aprobada | El repo como fuente de verdad; prioridades: datos > paridad > arquitectura > pulido |
| 7a | `c88ba76`+`c3b26dc` | **Seguridad de datos** | Export/import compatible (§6); PDF de Dani extraído y verificado byte a byte → asset local del repo (Drive descartado: sin permisos de subida); borrado `index - pre.html`; M10 documentado como descarte |
| 7b | `5df5977` | Experiencia Dani | Vista itinerario Dani (14 días, ★ Pasar/adoptar), polilíneas D1–D14 en mapa, selector de Origen en formulario con la contabilidad exacta de guardado del original, edición/borrado de lugares compartidos con aviso de re-siembra |
| 7c | `6e16713` | Paridad de listas | `CATALOG_ALIAS` (D1), filtros de origen en Sitios y Hoteles, categoría `excursion` (D7); los pares curado↔dani duplicados bajo "Todos" son INTENCIONALES hasta la Fase 10 |
| 8a | `a9b494b` | Paridad de mapa | Capa de vuelos (arcos círculo máximo + aeropuertos), filtro por categoría, pin de zona bajo umbral de zoom, teselas claro/oscuro (`applyMapTheme`), modo "Todos" solo-marcadores (cero OSRM) |
| 8b | `9015e27` | Paridad de plataforma | PWA (manifest dinámico de un archivo + metas Apple + theme-color), sesgo Japón en Nominatim (viewbox + reintento ", Japan"), inferencia de horas (funciones puras del original) en mover/insertar/añadir, vista "App original" solo lectura desde `origDays` |
| 8c | `cc6af8a` | **Gate de paridad** (solo verificación) | Verificación EN VIVO contra producción; auditoría de política de escritura con `fb` inyectado; suite movida a `tests/`; `PARITY.md`. **PARIDAD FUNCIONAL DECLARADA** |
| 9 | `1db5185` | **Rediseño visual premium** | Sistema washi/sumi/torii (ver §11 y DESIGN.md); cero cambios funcionales; `PRODUCT.md`+`DESIGN.md` |
| Docs | (este commit) | Referencia canónica + corrección: tres amigos, no pareja | — |

## 8. Descartado a propósito (no re-implementar sin decisión del usuario)

- **M10 — añadir/eliminar días**: viaje FIJO de 21 días delimitado por los vuelos; documentado
  junto a `SEED_DAYS`.
- **P3 — arrastrar parada a otro día**: la vista es de un día; se usa el modal "Mover a otro
  día". Revisitable solo como UX.
- **PDF de Dani en Drive**: descartado (sin permisos de subida a la carpeta compartida); es
  asset local del repo.
- **Emoji como iconografía**: decisión de marca deliberada (cuaderno de viaje personal), no
  descuido; documentada en PRODUCT/DESIGN.

## 9. Deuda técnica restante y fases futuras

**Deuda consciente**: dos catálogos (alias D1 la mitiga; fusión real pendiente) · dos modelos de
trayectos (P2/D4) · `onclick` inline globales (D5) · helpers duplicados `haversine`/`haversineMeters`,
`uid`/`placeUid`, `esc` (D3) · código muerto `TOKYO_SPECIAL_WARDS` (muerto también en la original)
(D2) · em-dashes solo en comentarios de código (4) · sin service worker (R4).

**Fase 10 — Consolidación** (⚠️ gate: solo cuando LOS TRES viajeros usen esta app): un único
modelo de itinerario/trayectos con migración única; fusión real de los dos catálogos; service
worker offline cache-first. Riesgos documentados en PARITY.md §6.
**Fase 11 — Calidad de código**: D2, D3, D5, nombres, docs, rendimiento; sin cambios
visuales/funcionales. Resultado esperado: código de proyecto open-source profesional.

## 10. Verificación (disciplina obligatoria en cada fase)

`node tests/run-all.js [volcado-firebase.json]` — extrae el JS de `index.html`, hace
`node --check` y ejecuta las suites contra el **código real** con stubs de DOM/Leaflet:
7a import (6 casos) · 7b Dani (11) · 7c listas/alias (25) · 8a mapa (23, incluye fugas de capas)
· 8b plataforma (21) · 8c gate (15; necesita un volcado en vivo:
`curl .../proyectos/viaje-japon.json > live.json`, nunca se versiona). Antes de cada commit:
suite completa en verde + smoke HTTP con `.claude/serve.ps1` (index y PDF en 200). Cada fase
termina en SU PROPIO commit (puntos de rollback). Si aparece deuda que bloquee la visión final:
parar, proponer el refactor y esperar aprobación (regla vigente).

## 11. Filosofía de producto, diseño y las Skills usadas

**Producto** (PRODUCT.md): tres amigos, registro *product* — la herramienta desaparece en la
tarea; denso pero calmado; el movimiento comunica estado; un acento con intención; los datos de
los viajeros son sagrados. **Anti-referencias**: SaaS genérico, webs de agencia, dashboards
fríos, cualquier "tell" de IA.

**Sistema visual** (DESIGN.md, Fase 9): *papel washi, tinta sumi, un rojo torii*. Tokens en
`:root` de index.html; doble tema de primera clase; Inter para toda la UI + Noto Serif JP solo
en hero/kanji/frases; bloqueo de radios 16/10/20/999; sombras teñidas en dos niveles; escala z
semántica 900/1200/2000/3000/4000; contrastes AA verificados a mano en ambos temas (acentos
calibrados: `#bf3823` claro / `#cf4530` oscuro, con tono elevado `#f08b72` para acento-como-texto
pequeño en oscuro).

**Las tres Skills instaladas y su influencia real** (obligatorias en trabajo de UI futuro):
- **emil-design-eng** — marco de decisión de animación: lo frecuente casi no se anima (cambio de
  pestaña 180 ms solo-opacidad; cierre de modal instantáneo); `scale(.97)` en `:active` de todo
  lo pulsable; curvas ease-out propias (`--ease`); hoja modal móvil con curva de drawer iOS
  `cubic-bezier(.32,.72,0,1)`; solo `transform`/`opacity`; entrada/salida asimétricas.
- **impeccable** — flujo init (PRODUCT.md/DESIGN.md), registro *product* ("familiaridad ganada"),
  verificación de contraste que CAZÓ fallos AA reales del acento, bloqueo de formas, anillo
  `:focus-visible` universal, pase de auto-revisión (p. ej. el ring que deformaba las píldoras).
- **design-taste-frontend** — lectura de brief + diales (VARIANCE 4 / MOTION 4 / DENSITY 5),
  bloqueos de consistencia (tema/color/forma), prohibiciones anti-slop (cero em-dash en copy
  visible, hover solo bajo `(hover:hover)`, sin nuevos clichés), auditoría de copy.

## 12. Convenciones e invariantes (ROMPER ESTO ROMPE EL PROYECTO)

1. **Política Firebase v2-only** (§5): 3 `fb.set`, ni uno más; jamás `state/days`/`state/transfers`.
2. **Ids compartidos inmutables**: `catalog_*`, `dani_*`, `airport_*` y el `CATALOG_VERSION`
   están vivos en la base de producción de tres personas. No renombrar, no fusionar (hasta F10).
3. **Nombres de token CSS = API interna**: las plantillas JS los usan inline (`--muted` 62 usos…).
   No renombrar tokens; añadir es seguro.
4. **Los tests dependen del contrato del DOM**: ids (`#dayPanel`, `#placesGrid`, `#mapCatChips`…),
   clases-gancho (`.fchip`, `.day-chip`, `.stop`, `.t-opt`, `.dani-row`, `add-stop`…) y algunos
   strings de plantilla (`openPlace('id')`, `✓ nuestro`, `D Dani`, `🕐`, `Todos`). Si cambias
   plantillas, actualiza `tests/` en el MISMO commit y deja la suite en verde.
5. **`index-pre-source.html` es permanente** (referencia + único embed del PDF).
6. **Compatibilidad de copias** (§6) y **esquema de lugares compartidos** (nombres de campo de
   hotel, flags de origen) no se cambian: la app original los lee tal cual.
7. **Contrato de extracción de tests**: el JS principal vive en el ÚNICO bloque
   `<script>"use strict";…</script>` antes de `</body>` (la regex de `run-all.js` depende de ello).
8. **Cachés compartidas de localStorage** entre ambas apps: claves `japon27_theme`,
   `japon27_notifications`, `viaje-japon-boundary-v3:*`, `viaje-japon-rail-v1:*`. No renombrar.
9. **Un commit por fase**, mensaje descriptivo, suite verde antes de commitear.
10. **Tres amigos**: cualquier copy, ejemplo o decisión de producto asume 3 viajeros
    (presupuestos "por persona", nunca "pareja"/"ambos").

## 13. Supuestos que el trabajo futuro no debe romper por accidente

- La app original sigue desplegada y EN USO; puede escribir en Firebase en cualquier momento.
  Todo cambio debe sobrevivir a un `onValue` con datos suyos (arrays podados incluidos).
- `applyCatalogUpdate` puede re-sembrar lugares borrados al subir `CATALOG_VERSION` (avisado en
  el confirm de borrado). Subir la versión del catálogo afecta a las DOS apps.
- Los servicios externos (OSRM de FOSSGIS, Overpass, Nominatim) son públicos y con rate-limit:
  la cola de límites espera 1,15 s entre peticiones; OSRM en cola de 250 ms; cachés en
  localStorage. No paralelizar esas peticiones.
- `mapDay === -1` significa "Todos los días" (sin rutas, sin OSRM). `curDay`/`mapDay` indexan
  `state.days`; el array es fijo de 21 (M10).
- El pre-pintado del tema vive en un `<script>` del `<head>` (evita flash); `setTheme` mantiene
  sincronizados `data-theme`, `<meta theme-color>` y las teselas de mapa/mini-mapa.
- El manifest PWA se genera en runtime (blob) dentro del propio HTML: no hay manifest.json.
- Node ≥18 basta para la suite; no hay `package.json` ni dependencias: mantenerlo así.
