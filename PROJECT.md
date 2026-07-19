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
rediseño visual premium llegó en la Fase 9. En la **Fase 10** (gate aprobado: los tres viajeros
usan ya solo esta app) la app original quedó **retirada del flujo soportado**: su catálogo se
fusionó de verdad, su modelo de itinerario/trayectos se consolidó una única vez dentro del
modelo v2 y sus nodos en la nube quedaron como archivo de solo lectura.

## 2. Ficheros del repositorio

| Fichero | Papel |
|---|---|
| `index.html` | LA app entera (~5.6k líneas: head+PWA, CSS del sistema visual, HTML, JS) |
| `sw.js` | Service worker offline (Fase 10c): cache-first del shell + CDNs versionadas, refresco en segundo plano. Subir junto a index.html a GitHub Pages |
| `tools/*.js` | Importadores **dev-time** (la app en runtime no usa red ni dependencias): María (`maria-import.js` con Playwright + `maria-bake.js` + `maria-xlsx-import.js`), Dani (`dani-import.js`, parsea el PDF con Node puro, F3a), NUESTRA/docx (`docx-import.js`, F3b), Instagram (`insta-import.js`) e IA (`ai-import.js`) — todos con el mismo patrón import→bake→seed que hornea bloques entre marcadores de `index.html` |
| `import/*.json` | Datos extraídos por los importadores (maria-places 139 sitios, dani-places 150, ours-places/DOCX, insta-places, ai-places, maria-trip). Fuentes que se hornean en `index.html`; re-generables |
| `package.json` / `package-lock.json` | Declaran la ÚNICA dependencia (Playwright), sólo para el importador dev-time. `node_modules/` está en `.gitignore` |
| `index-pre-source.html` | App original descomprimida. **Referencia permanente, no borrar**: contiene además el único embed del PDF de Dani |
| `JAPON-DEFINITIVO-Dani.pdf` | Asset local (811.736 B) que descarga el botón 📄 de la vista Dani (`DANI_PDF_URL`). Si se perdiera: re-extraer decodificando el base64 de `DANI_PDF_BASE64` (línea 7025 de `index-pre-source.html`, comillas simples); debe dar `%PDF-1.7` y 811.736 bytes |
| `PROJECT.md` `PRODUCT.md` `DIRECTION.md` `DESIGN.md` `design/` `PARITY.md` | Documentación (continuidad → estrategia → dirección creativa → sistema visual y su versión modular → paridad) |
| `Itinerario.docx` | Fuente de la procedencia `ours` (lista de deseos de los tres); lo lee `tools/docx-import.js` |
| `Ruta-21-dias.docx` | La Ruta 21 días hora a hora (12.57), descargable desde el botón 📄 del itinerario Ruta; en el SHELL del SW. Se regenera con el script dev-time de la sesión que la creó |
| `tests/run-all.js` + `tests/test-*.js` | Suite de regresión completa (ver §10) |
| `.claude/serve.ps1` | Servidor local de desarrollo (`http://localhost:8734/`) |

## 3. Arquitectura

Un solo archivo (+`sw.js`), JS vanilla sin framework, Leaflet 1.9 por CDN. Secciones del script
(en orden): utilidades → datos (`FLIGHTS`, `AIRPORTS`, `CATS`, `MODES`, ficha curada `PLACES`
—solo materia prima de semilla—, itinerario semilla `SEED_DAYS`, guía) → catálogo compartido
portado de la app original (`CATALOG_PLACES_RAW`, `DANI_PLACES_RAW`, `DANI_ROUTE_GROUPS`,
`applyCatalogUpdate`) → fusión del catálogo (`LEGACY_PID_MAP`, `foldCurated`) → consolidación
del modelo original (`maybeMigrateOriginal`) → estado y persistencia → Firebase →
cabecera/tema/título/notificaciones → sitios y formulario → hoteles → rutas reales
(OSRM/Overpass) → navegación → Inicio → Itinerario (3 vistas) → reordenación e inferencia de
horas → modales → mapa → Sitios → Guía → export/import → init (incluye migración 10b de
arranque y registro del service worker).

Render: funciones `renderX()` que reconstruyen `innerHTML` por sección; `renderAll()` para todo.
Los manejadores se enlazan tras cada render con `addEventListener` (helpers `onClick` y
`bindPlaceOpen`, más bloques como `bindDayPanel`); las plantillas exponen `data-pid`/ids en vez
de `onclick` inline (D5 cerrada en la Fase 11: cero handlers inline). Los tests dependen de esos
ganchos del DOM (ver §12).

**Pestañas vigentes (desde 12.54–12.56):** Ideas 🧭 · Itinerarios 🗓️ · Confirmado ✈️ · Hoteles 🏨
· Guía 🧳. La pestaña Mapa suelta se retiró en 12.54: el mapa de Ideas vive dentro de Ideas
(eje de zona) y el mapa del plan dentro de Itinerarios (por días, escopado al itinerario ACTIVO
desde 12.56). Itinerarios presenta 5 itinerarios al mismo nivel: **Realidad** (editable; un día
solo afirma su fecha + vuelos + reserva de esa noche) · **Ruta** (12.57: la Ruta 21 días
diseñada sobre todo el catálogo, solo lectura y plantable con ＋, con documento descargable) ·
**Propuesta** (IA, solo lectura, plantable con ＋) · **Dani** · **María** (referencias solo
lectura).

## 4. Modelo de datos (`state`, persistido en localStorage `japon27_app_v1`)

```
state = {
  v, updatedAt, rate (¥/€), check {i:bool},          // v2: SOLO de esta app
  migratedOrig,                                       // marca de consolidación 10b (fecha ISO, monótona)
  days: [ { date, title, city, icon, flight:[ids]?,  // 21 días FIJOS (decisión M10)
            stops: [{id, pid, time, dur, note, done}],
            trans: [{sel, opts:[{id,m,t,d,y,l,n,w,auto}]}],  // 1 por hueco entre paradas
            pre?, post? } ],
  tripTitle,                                          // compartido (escalar)
  places: [...],                                      // CATÁLOGO ÚNICO (fusionado en Fase 10a)
  origDays: [...],                                    // archivo solo-lectura de los días originales
  catalogVersion                                      // versionado del catálogo (v10-fusion)
}
```

- **Catálogo ÚNICO** (Fase 10a): todo lugar vive en `state.places` con los ids canónicos de
  producción (`catalog_*`, `dani_*`, `airport_*`, `id_*` de usuario y claves curadas tipo
  `nakamise` para las entradas sin gemelo). La ficha curada `PLACES` es solo materia prima:
  `foldCurated` la fusiona en la semilla y en cada subida de `CATALOG_VERSION`, aportando los
  campos ricos (`dur/yen/price/hours/web/tip`) y ganando en los campos visibles SOLO si el valor
  sigue siendo el de la semilla (las ediciones de usuario nunca se pisan). `placeById` resuelve
  únicamente `state.places` a través de la vista `placeView` (renombrada desde `userPlaceView` en
  la Fase 11).
- **`LEGACY_PID_MAP` es permanente**: copias antiguas y v2 antiguos traen pids con clave curada
  (`sensoji` → `catalog_sensoji`); se canonicalizan en semilla, arranque, adoptRemote e import.
- **Un solo modelo de trayectos** (Fase 10b): `day.trans` por hueco (+ `pre`/`post`). El modelo
  original (`state.transfers` por par + asignaciones `dayId`/hora en lugares) se consolidó UNA
  vez dentro de v2 (`maybeMigrateOriginal`, marca `migratedOrig` compartida por state/v2 y
  monótona); el espejo local `state.transfers` ya no existe.
- **Procedencia de un lugar** (campo `provenance`, estable e histórico, Fase 12): `ours` | `dani`
  | `instagram` | `ai`. Es de dónde salió el lugar y NO cambia nunca (ni al adoptar, ni al
  planificar): la procedencia es historia. El valor `ai` (etiqueta de UI **IA**; "Exploración"
  queda reservado para la CAPA, no para la procedencia) marca
  los lugares generados durante el desarrollo (catálogo semilla y propuesta de itinerario). Es un
  campo ADITIVO: la app original lo ignora; el `source` heredado (`user`/`dani`/`insta`) se
  mantiene tal cual para el esquema compartido. `foldCurated` preserva `provenance` al re-sembrar,
  y viaja en export/import.
  - **Fuente de verdad de `ours` (corrección 12.48): Itinerario.docx.** `DOCX_OURS` (35 ids
    canónicos derivados 1:1 del documento) → `ours`; un hotel con reserva confirmada → `ours`
    (regla §9.4); `source:'dani'`/`dani_*`→`dani`; `source:'insta'`→`instagram`; `maria_*`→`maria`;
    TODO lo demás (semilla, curado no-docx, añadidos a mano sin otra procedencia) → `ai`.
    `ensureProvenance` además REPARA datos persistidos con la definición antigua (docx `ai`→`ours`,
    manual `ours`→recalculado, maria `ai`→`maria`): reparar restaura la historia, no la reescribe.
- **Estado / capa** (eje distinto de la procedencia): PLANIFICADO se deriva de si el lugar está en
  el itinerario; CONFIRMADO es un flag EXPLÍCITO que se pone con una acción deliberada (marcar como
  confirmado al editar). Vuelos y los DOS hoteles reservados son Confirmado por naturaleza; hoy nada
  más está confirmado. favourite/visited/want siguen fuera a propósito (modelo mínimo, §8).
- `sourceValueForPlace` → `user` | `dani` | `insta` sigue existiendo para la re-siembra
  (flags `dani`, `daniAdopted`, `catalogItem` gobiernan `applyCatalogUpdate`).

## 5. Firebase — estructura y POLÍTICA DE ESCRITURA (invariante crítico)

Base: `viaje-japon-8748a` (europe-west1). Ruta compartida `proyectos/viaje-japon`
(o `proyectos/<hash>` si la URL trae un hash que no empieza por `/`).

```
proyectos/viaje-japon = {
  tripTitle,                       ← escalar compartido
  state: {
    days, transfers,               ← ARCHIVO del modelo de la app original (congelado)
    places, catalogVersion,        ← catálogo único (places lo escribe esta app)
    v2: { v, days, rate, check, migratedOrig, updatedAt }  ← nodo EXCLUSIVO de esta app
  }
}
```

**Política v2-only (no negociable, intacta tras la Fase 10): exactamente 3 call-sites de
`fb.set` y ningún otro.** `pushRemote → state/v2` (payload exacto
`{v,days,rate,check,migratedOrig,seedRetired,updatedAt}` — `seedRetired` es la marca de
retirada de la propuesta, 12.49, aditiva y ligada al LINAJE de los días —, debounce 1.2 s) · `pushPlaces → state/places`
(array completo, debounce 800 ms) · `pushTitle → tripTitle` (debounce 600 ms). **Nada escribe
jamás `state/days` ni `state/transfers`**: aunque la app original está retirada, sus nodos
quedan como archivo (alimentan la vista "App original" vía `origDays` y fueron la fuente de la
migración única 10b). Nota: `state/catalogVersion` en la nube queda congelado en v9 (nadie lo
escribe); la versión local viaja acompañando al array de places adoptado y `applyCatalogUpdate`
re-fusiona idempotentemente cuando difiere. Lectura: `onValue` sobre el nodo raíz →
`adoptRemote`, con guardas: un remoto sin lugares nunca borra los locales; v2 remoto solo gana
si su `updatedAt` es mayor y, si lo local es más nuevo (ediciones offline), se re-sube
(`localNewer`); arrays vacíos podados por Firebase se reparan con `normArr`; pids antiguos se
canonicalizan; eco propio suprimido (2,5 s) para las notificaciones. Las suites
`test-8c-gate.js` y `test-10b-consolidation.js` verifican todo esto con un `fb` falso.

Nota: en producción existe además un nodo hermano **legado** `proyectos/japon27-app-v2` (la ruta
separada que usó esta app antes de la Fase 1). Ninguna de las dos apps lo lee ya; no confundirlo
con datos activos ni borrarlo sin decisión explícita del usuario.

## 6. Export / Import (compatibilidad bidireccional)

Export: envoltorio `{tripTitle, state}` (sin `transfers` desde la Fase 10b). Import acepta
**tres formatos**: (A) copia de la app original `{tripTitle, state:{days label/fecha, places,
transfers}}` — toca campos compartidos + archivo `origDays`, jamás pisa el itinerario v2 (sus
transfers/días asignados solo se consolidarían si `migratedOrig` aún no estuviera puesta); (B)
copias antiguas de esta app (estado plano con días v2, pids con clave curada se canonicalizan);
(C) formato actual envuelto. Siempre con elección **Fusionar** (añade lo que falte, no borra) /
**Reemplazar**, con guard: una copia con menos lugares que el plan actual exige una segunda
confirmación explícita antes de reducir `state.places`. Al reemplazar places, `catalogVersion`
viaja con el array y la fusión v10 se re-aplica si hace falta.

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
| Docs | `febdcca` | Referencia canónica + corrección: tres amigos, no pareja | — |
| 10a | `7f63a63` | **Fusión real del catálogo** (D1) | Catálogo único en `state.places`; `foldCurated` + `LEGACY_PID_MAP`; protección campo a campo de ediciones de usuario; `CATALOG_ALIAS` y doble resolución eliminados; producción 220→312 lugares al primer sync |
| 10b | `3f82943` | **Modelo único de itinerario/trayectos** (P2/D4) | `maybeMigrateOriginal`: transfers por par → hueco v2 con mismos extremos, asignaciones dayId → paradas; marca `migratedOrig` en state/v2, monótona; espejo local `state.transfers` retirado; `localNewer` re-sube ediciones offline |
| 10c | `6b40e34` | **Service worker offline** (R4) | `sw.js` cache-first del shell + CDNs versionadas, refresco silencioso en segundo plano; sin toasts de actualización; APIs vivas nunca interceptadas |
| Docs | `71396f7` | Fase 10 cerrada: gate aprobado, app original retirada del flujo soportado | — |
| 11 | (este commit) | **Calidad de código** (D2/D3/D5, nombres, comentarios) | Cero handlers `onclick` inline (`data-pid`/ids + `addEventListener`); helpers deduplicados (`haversineMeters`/`placeUid` sobre `haversine`/`uid`); código muerto borrado (`TOKYO_SPECIAL_WARDS`, `isAirportPlace`); `userPlaceView`→`placeView`, `userHotels`→`bookedHotels`; em-dashes fuera de comentarios; sin cambios visuales/funcionales (suite verde byte a byte) |
| 12.1–12.31 | varios | **Modelo de producto + primeras materializaciones** | Procedencia (`ours`/`dani`/`instagram`/`ai`/`maria`), Confirmado/Foil Press (sellar), Cord + Zoom, BudgetPeek, Seasons (`tripPhase`), Countdown Face + Rail, EmptyState, eje Ideas←Plan→Confirmado, higiene de hoteles |
| 12.32 | `5df3ff0` | **Fix crash TDZ de María** | El boot llamaba `ensureMariaPlaces()` ~340 líneas antes de `const MARIA_PLACES`: zona muerta temporal → ReferenceError que dejaba la app en blanco y rojas todas las suites. Bloque María reubicado antes del boot |
| 12.33 | `0fbd788` | **Importador de María** | Re-evaluada la extracción (antes "imposible"): AHORA es posible. Con navegadores Playwright + cookie `SOCS` de consentimiento, los enlaces `maps.app.goo.gl` resuelven la lista; nombres en `.fontHeadlineSmall`, coordenadas al hacer clic. `tools/maria-import.js` + `tools/maria-bake.js`; Playwright dev-only |
| 12.34 | `2ed4398` | **Datos reales de María (139 sitios)** | Extraídas las 5 listas (Tokio 55 · Kioto y Nara 46 · Osaka 19 · Nagoya 18 · Nagano 1). Horneados en `MARIA_PLACES` como Exploración, provenance `maria`, nunca auto-planificados ni confirmados. Tests de recuento excluyen `maria` (aditiva) |
| 12.35 | `008dfd2` | **María curadora de primera clase** | Chip 'María' en Ideas (por procedencia, fuera de 'Nuestros'); capa 'M María' en el mapa (morada), fuera de la capa 'Nosotros' |
| 12.36 | `ea5f670` | **Hero = Countdown Face (Foil)** | Retirado el cartel de gradiente rojo; hero como material Foil (papel + borde de lámina + destello), días en serif como único acento rojo; en Home sólo reservas confirmadas (Foil), bases "por reservar" demotadas a Washi |
| 12.37 | `a240574` | **Ideas editorial, sin muro** | Vista general agrupada por región (cabeceras + contador), avance de 6 por grupo con "ver todos" (divulgación progresiva); región elegida o búsqueda → lista plana. 41.544px → ~9.900px |
| 12.38 | `fac61c9` | **Plan lidera con nuestro viaje** | Switcher: "Nuestro plan" primario; "Dani" y "Original" demotados como referencias tras un rótulo (no itinerarios peer) |
| 12.40 | `51cce42` | **Reparación de procedencia María en producción** | La nube guardaba los 139 maria_* como `ai` (invisibles); `ensureProvenance` repara maria_*→maria y re-sube. Verificado sanado en producción |
| 12.41–12.46 | varios | **Pulido de producto** | Filtros de Ideas en filas de scroll; elegido-vs-propuesta por material (luego obsoleto en 12.49); filtros por procedencia; nav de escritorio = eje de certeza; tira de ruta calmada |
| 12.47 | `5985069` | **PRESUPUESTO ELIMINADO (corrección de producto)** | Fuera BudgetPeek, dayCosts, botones/chips/franja de presupuesto y el input de cambio. `state.rate` PERMANECE en el payload v2 (esquema, §5); los precios informativos de sitios/transportes permanecen (datos, no presupuesto) |
| 12.48 | `95fb36a` | **NUESTROS = Itinerario.docx (corrección)** | `DOCX_OURS` (35 ids canónicos 1:1 del documento) define `ours`; hotel con reserva sigue `ours` (§9.4); TODO lo demás no-Dani/María/Instagram → `ai` (incluidos añadidos a mano). Reparación bidireccional en `ensureProvenance`; producción sanada (ours 3→37). Capas del mapa por procedencia (N=docx, +capa IA) |
| 12.49 | `44b5e9d` | **El viaje canónico es lo DECIDIDO (corrección)** | La propuesta sembrada se RETIRA del plan editable (marca monótona `seedRetired` en el payload v2, ligada al linaje de días); queda como referencia "Propuesta" (solo lectura, plantable con ＋). El plan real: vuelos + hoteles + lo plantado (verificado en producción: 1 parada real, APA 25-abr). "Vaciar el plan" sustituye a "Restablecer plan sugerido". SUPERSEDE el mecanismo §12.14 de "retirada día a día" |
| 12.50 | `4279edf` | **Prioridad de clic del mapa (corrección UX)** | Pane propio 'zones' (z 350) bajo el overlayPane: un sitio siempre gana el clic al polígono de zona; el área se inspecciona tocando mapa vacío. Verificado en navegador real |
| 12.51 | `328c879`+`2f3ecbf`+`3f44fc1` | Docs de las correcciones 12.47–12.50 | `Itinerario.docx` entra como asset del repo; primer `CLAUDE.md` (nota: describía un stack TS/SQL erróneo, corregido el 2026-07-19) |
| F1 | `309764c` | **Guardas de procedencia IA** | `test-12-provenance.js` ampliado: precedencia de `provenanceOf` fijada (`dani_*` manda sobre señales contradictorias); auditados los 422 lugares de la semilla, 0 con marca explícita caen al fallback `ai` |
| F1.5 | `08063ca` | **Gemelos multi-procedencia** | `TWIN_GROUPS`: 60 pares Dani↔IA del mismo sitio real, ancla siempre la entrada IA (gana id/nombre/coords/web/horario/precio), nota de Dani conservada en el detalle. La unión de procedencias es SOLO capa de agrupación/render; cada entrada conserva su única `provenance`. Un gemelo no-ancla nunca pinta pin/tarjeta propia |
| F2 | `908eba6` | **Pipelines INSTA/IA conectados** | `ensureInstaPlaces`/`ensureAiPlaces` (patrón de `ensureMariaPlaces`, idempotentes) en boot, adoptRemote e import; `tools/insta-import.js` + `tools/ai-import.js` con `--bake` verificados end-to-end |
| Fix | `a47eafa` | **Hoteles de Dani adoptados NO son reservas** | Sus 6 alojamientos documentan SU viaje de junio 2025 (fechas/bookingRef de 2025): al adoptarlos entraban en Confirmado como "✓ Reservado". Guarda por id `dani_*` en `isBookedHotel`. Lo único confirmado nuestro: vuelos, APA y Louis House |
| F3a | `ccbd611` | **Importador Dani (import→bake→seed)** | Los 150 lugares de Dani salen del HTML escrito a mano (157 líneas retiradas): `tools/dani-import.js` parsea el PDF con Node puro (zlib + CMaps ToUnicode) y verifica cada entrada curada contra el texto real. El PDF es fuente del CONTENIDO; ids/coords/categorías son curación |
| F3b | `8c2ad6a` | **Importador NUESTRA/docx** | `tools/docx-import.js` (lector ZIP mínimo + inflate, sin dependencias) lee `Itinerario.docx`; puente manual `DOCX_TO_CATALOG` nombre→id (avisa si el docx cambia, nunca adivina); `DOCX_OURS_IDS` pasa a hornearse |
| 12.52 | `8c3290b`+`d9e14b5` | **Pestaña Itinerarios: la REALIDAD manda** | "Plan"→"Itinerarios". Los días de REALIDAD pierden `city/title/icon` (`stripDaySkeleton` en local y remoto): un día solo afirma su FECHA, más los vuelos (de `FLIGHTS`, por fecha real) y la reserva de esa noche (`hotelForNight`/`bookedHotels`, la misma fuente que Confirmado). La vista "📄 Original" se retira. Ficha de referencia María: sus 15 días de feb–mar 2024, solo lectura, `MARIA_MAPS` con `city` anotado |
| 12.53 | `dfa7a11` | **Eje de ZONA geográfica derivada** | DÓNDE está un sitio, derivado SOLO de coordenadas (polígonos de las 3 grandes + anclas con radio; multi-ancla en Alpes/Fuji; el polígono manda). Nunca se guarda en state: lectura cacheada en `placeView`. `region` NO se reutiliza a propósito (mezcla procedencia y etiquetas no geográficas) |
| 12.54 | `886afed` | **Dos mapas embebidos; fuera la pestaña Mapa** | Mapa de Ideas (por zona, con "Sin zona" visible) + mapa del plan (por días) dentro de sus pestañas; KIX pasa a zona Osaka; líneas de Dani apagadas por defecto |
| 12.55 | `f54dc96` | **Zona Kyūshū** | "Fukuoka" (radio) → polígono de toda la isla, cortado en el estrecho de Kanmon para no colarse a Honshu; solo cambia la zona, nunca fuente ni coordenadas |
| 12.56 | `d205107` | **El mapa sigue al itinerario ACTIVO** | Escopado por PERTENENCIA, no por procedencia (la Propuesta incluye sus lugares `ai`; las ideas sueltas no salen); capas por fuente retiradas de ese mapa; el mapa sube bajo la fila de selección y los 4 itinerarios quedan al mismo nivel (fuera el rótulo "referencias") |
| Docs | (este commit) | Docs al día hasta 12.56 + decisiones 2026-07-19 | Propuesta de IA de 5 pestañas RECHAZADA; reparto de alojamientos 12–25 abr reconocido como NO decidido (copy corregido); `CLAUDE.md` reescrito para describir el proyecto real |
| 12.57 | `f2f9518`+`199c485`+`85f7bea` | **La Ruta 21 días** (petición del usuario: "el viaje perfecto" sobre todo lo apuntado) | Quinto itinerario **Ruta** (solo lectura, plantable, anillo propio, mapa por pertenencia, vuelos): 121 paradas/19 días útiles que cubren los 60 gemelos y 12 zonas (Nikko con noche, Kanazawa ×2, Shirakawa-gō, Takayama con ryokan, Kioto+Uji, Hiroshima, Miyajima, Fukuoka, Osaka+Nara+USJ, Kamakura+Yokohama, Fuji), anclada en Louis House 9–12 y APA 25–27 (propone ampliar al 24). Catálogo v11: **USJ** (petición), 5 sitios de Kanazawa, 3 de Fukuoka, 5 bases de hotel de la Ruta, zona Kanazawa. `Ruta-21-dias.docx` hora a hora (reservas con plazos, variante Narai-juku, descartes razonados) en el SHELL del SW (caché v2). Suite `test-12-ruta.js` (19 checks) |

## 8. Descartado a propósito (no re-implementar sin decisión del usuario)

- **M10 — añadir/eliminar días**: viaje FIJO de 21 días delimitado por los vuelos; documentado
  junto a `SEED_DAYS`.
- **P3 — arrastrar parada a otro día**: la vista es de un día; se usa el modal "Mover a otro
  día". Revisitable solo como UX.
- **PDF de Dani en Drive**: descartado (sin permisos de subida a la carpeta compartida); es
  asset local del repo.
- **Emoji como iconografía**: decisión de marca deliberada (cuaderno de viaje personal), no
  descuido; documentada en PRODUCT/DESIGN.
- **Aviso de "hay versión nueva" del service worker**: descartado a propósito (Fase 10c). El
  refresco es silencioso en segundo plano; la siguiente apertura estrena. Nada de toasts de
  actualización ni recargas a mitad de uso.
- **Migrar pares de transfers sin hueco v2 equivalente**: descartado a propósito (Fase 10b).
  Solo se consolidan los pares cuyos extremos coinciden con un hueco del plan v2; el resto
  queda legible en el archivo de la nube y en las copias.
- **Estados de lugar favourite/visited/want**: aplazados a propósito (Fase 12, decisión del
  usuario). El modelo se mantiene mínimo: por ahora solo `provenance` (estable) + "planificado"
  (derivado del itinerario). Ampliable más adelante sin rehacer el modelo.
- **Importador de Google Drive**: descartado a propósito (Fase 12). Drive es la fuente de verdad,
  pero el plan real se entra a mano dentro de la app; el producto solo hace esa entrada agradable.
- **Presupuesto**: ELIMINADO del producto (corrección 12.47, decisión del usuario). No
  re-implementar BudgetPeek ni costes ambientales. `state.rate` permanece en el modelo/payload
  (esquema compartido); los precios informativos de la ficha de un sitio y de las opciones de
  transporte son DATOS del catálogo y sí permanecen.
- **"Restablecer plan sugerido"**: retirado en 12.49. La propuesta ya no entra en el plan; el
  botón es ahora "Vaciar el plan" (deja los 21 días sin paradas, conservando vuelos/hoteles/
  catálogo y la referencia Propuesta).
- **IA de 5 pestañas Hoy/Plan/Ideas/Mapa/Guía**: RECHAZADA (2026-07-19, decisión del usuario).
  Las pestañas actuales (Ideas · Itinerarios · Confirmado · Hoteles · Guía, con los mapas
  embebidos de 12.54) funcionan bien hoy. No re-proponer sin decisión del usuario.

## 9. Deuda técnica restante y fases futuras

**Fase 10 — Consolidación: COMPLETADA** (gate aprobado el 2026-07-07: los tres viajeros usan
solo esta app). D1 (fusión real del catálogo), P2/D4 (modelo único de itinerario/trayectos con
migración única) y R4 (service worker offline) cerrados.

**Fase 11 — Calidad de código: COMPLETADA.** Sin cambios visuales ni funcionales (suite verde,
la misma cobertura); solo borrado/simplificación/renombrado. Cerrado:
- **D5** (`onclick` inline globales): cero handlers inline. Las plantillas exponen `data-pid`/ids
  y el enlazado ocurre tras cada render vía `addEventListener` (helpers `onClick`/`bindPlaceOpen`
  y bloques como `bindDayPanel`). El botón "★ Pasar" conserva su `stopPropagation`.
- **D3** (helpers duplicados): `haversineMeters` ahora deriva de `haversine`; `placeUid` de `uid`
  (con parámetro de prefijo). `esc` era único ya. Sin duplicados.
- **D2** (código muerto): borrados `TOKYO_SPECIAL_WARDS` (muerto también en la original) e
  `isAirportPlace` (sin referencias). Barrido estático: 0 símbolos de nivel superior sin uso.
- **Nombres heredados**: `userPlaceView`→`placeView`, `userHotels`→`bookedHotels` (hoy sirven a
  todo el catálogo, no solo a los lugares de usuario).
- **Comentarios**: em-dashes retirados de los tres comentarios que los tenían (los `–` restantes
  son datos/copy visible: horarios y rangos de fecha, no se tocan).

Corrección de doc: `hotelArea` **sí** se edita en el formulario (`#fpHotelArea`) y se guarda; la
nota previa que lo daba por no editable era obsoleta.

**Deuda restante conocida: ninguna de la lista D.** Posibles mejoras futuras (no bloqueantes, sin
decisión pendiente): rendimiento de re-render por sección (hoy se reconstruye `innerHTML` entero),
y `state/places` sigue siendo un nodo de escritura total (mitigado; ver PARITY §6).

**Fase 12 — Procedencia y separación conceptual (EN CURSO, arquitectura aprobada por el usuario).**
No es limpieza: es modelo de producto. *(Estado 2026-07-19: el alcance 1–5 de abajo está
implementado y verificado — ver historia 12.1–12.56 y F1–F3b en §7; la fase sigue abierta como
paraguas del trabajo de producto en marcha.)* Objetivo: hacer visibles tres modelos mentales
distintos (ver PRODUCT.md y §11):
- **Confirmado**: vuelos y hoteles reservados. Información cierta.
- **Planificación**: el itinerario que deciden los tres, procedente de sus documentos de Google
  Drive (fuente de verdad). La app se pone al día a mano, sin importador.
- **Exploración**: lugares de procedencia `ai`/`dani`/`instagram` mientras no se programen a propósito.

Alcance técnico aprobado:
1. Campo `provenance` estable (`ours`/`dani`/`instagram`/`ai`) + backfill único (§4). Aditivo y
   compatible con la app original; `source` no se toca.
2. UI que distingue las cuatro procedencias sin equipararlas: Exploración recede (sin acento,
   etiqueta "Exploración"). Procedencia (historia) y estado (planificado) se muestran separados.
3. El itinerario semilla (`ai`) permanece VISIBLE y se retira DÍA A DÍA a medida que entra el plan
   real: nunca se vacía la app antes de tener plan, nunca un borrado global, nunca capa permanente.
4. Higiene de hoteles: fusión del APA duplicado (`apa_asakusabashi` + gemelo `id_*` creado en el
   formulario), alta de Louis House Otsuka Nishi (9–12 abr, 267,52 €); un hotel con reserva
   confirmada es siempre `provenance: ours`.
5. Adopción: deja de cambiar la procedencia (invariante §12.13). Lo que cambia es la inclusión en
   el viaje (estado), no de dónde vino el lugar.
Sin nuevos estados (favourite/visited/want) por ahora: modelo mínimo (§8).

**Correcciones de esta sesión (canónicas, 2026-07-07):**
- **Confirmado es estrecho y se gana**: hoy SOLO vuelos + los dos hoteles reservados están
  confirmados; todo lo demás (incluido `Itinerario.docx`) es planificación o exploración. Confirmar
  es una ACCIÓN DELIBERADA (flag `confirmed` explícito al editar), no un efecto colateral.
- **Etiqueta de procedencia `ai` = "IA"** (no "Exploración", que es una CAPA).
- **Hoteles se tratan como los vuelos** (hechos de Confirmado, no lugares normales).
- **Los precios NO dominan la UI**: nada de costes de transporte/entradas siempre visibles;
  presupuesto bajo demanda (divulgación progresiva).
- **`Itinerario.docx` es una LISTA DE DESEOS**, no un itinerario: listas por región + excursiones;
  añade destinos nuevos que la semilla no tenía (Kanazawa, Takayama/Kamikochi + ryokan, Fukuoka,
  Narai-juku, Uji). Alimenta el tablero de Exploración con intención `ours`.
- **El rediseño de la Fase 9 se considera visualmente DEMASIADO CONSERVADOR.** Antes de implementar
  la Fase 12 se hará una iteración DEDICADA de rediseño de producto/UX con las cuatro Skills
  (animation-vocabulary, design-taste-frontend, emil-design-eng, impeccable) con mandato de RETAR
  la interfaz (no pulirla): jerarquía, interacción, animación, estados de día vacío y día completado
  (sin definir a propósito: los diseña la Skill), transiciones, divulgación progresiva; producto de
  viaje premium moderno. *(Iteración realizada: su resultado canónico es `DIRECTION.md` y el
  sistema modular `design/`; las materializaciones, en la historia 12.1–12.56.)*
- ~~**Propuesta de implementación presentada, PENDIENTE de aprobación**~~ **CERRADA: RECHAZADA
  (2026-07-19, decisión del usuario).** La IA de 5 pestañas (Hoy/Plan/Ideas/Mapa/Guía) NO se
  adopta: las pestañas actuales (Ideas · Itinerarios · Confirmado · Hoteles · Guía) funcionan bien
  en el momento actual (ver §8). Las piezas de aquella propuesta que se materializaron por su
  cuenta (retirada de la pestaña Mapa en 12.54, hoteles como hechos de Confirmado, etiqueta "IA",
  `confirmed` explícito) ya están recogidas en la historia de fases; el resto (pluck-and-place,
  hold-to-seal, segmented day scrub tal como se describieron) queda sin compromiso.

**Correcciones canónicas (2026-07-19):**
- **Del 12 al 25 de abril el plan está SIN DECIDIR (ciudades, orden y noches).** El reparto
  Tokio (12–16 y 22–25) / Kioto (16–19) / Osaka (19–22) era la PROPUESTA hablando en nombre del
  viaje, no una decisión. Reservar los alojamientos de esas noches sigue pendiente, pero no
  necesariamente con ese reparto. El copy de la checklist de la Guía y de las tres bases
  "por reservar" del catálogo se corrigió para decirlo. *(12.57: la Ruta 21 días PROPONE un
  reparto concreto de esas noches — Nikko, Kanazawa ×2, Takayama, Kioto ×3, Hiroshima,
  Fukuoka, Osaka ×3 — siempre etiquetado como propuesta de la Ruta, nunca como decisión.)*

## 10. Verificación (disciplina obligatoria en cada fase)

`node tests/run-all.js [volcado-firebase.json]` — extrae el JS de `index.html`, hace
`node --check` y ejecuta las suites contra el **código real** con stubs de DOM/Leaflet:
7a import · 7b Dani · 8a mapa (incluye fugas de capas) · 8b plataforma · 8c gate (necesita un
volcado en vivo: `curl .../proyectos/viaje-japon.json > live.json`, nunca se versiona) ·
10a catálogo fusionado · 10b consolidación · 10c service worker · y las suites de la Fase 12:
provenance (con las guardas F1) · twins · pipelines · dani-import · docx-import · maria ·
hotels · confirmed · axis · cord · seasons · realidad · zones. (`test-7c-lists.js` se retiró
al desaparecer la capa de alias con la fusión real del catálogo; la lista vigente la define
`tests/run-all.js`.) Antes de cada commit: suite completa en verde + smoke HTTP con `.claude/serve.ps1`
(index, sw.js y PDF en 200). Cada fase termina en SU PROPIO commit (puntos de rollback). Si
aparece deuda que bloquee la visión final: parar, proponer el refactor y esperar aprobación
(regla vigente).

## 11. Filosofía de producto, diseño y las Skills usadas

**Producto** (PRODUCT.md): tres amigos, registro *product* — la herramienta desaparece en la
tarea; denso pero calmado; el movimiento comunica estado; un acento con intención; los datos de
los viajeros son sagrados. **Anti-referencias**: SaaS genérico, webs de agencia, dashboards
fríos, cualquier "tell" de IA.

**Procedencia y separación conceptual (Fase 12, canónico en PRODUCT.md)**: cada lugar tiene una
**procedencia** estable e histórica (`ours`/`dani`/`instagram`/`ai`=Exploración) que no cambia
nunca; el ESTADO (planificado, y más adelante favourite/visited) es un eje aparte. El producto
mantiene visibles tres modelos mentales distintos: **confirmado** (vuelos, hoteles reservados),
**planificación** (el itinerario que deciden los tres, desde sus documentos de Google Drive, que
son la fuente de verdad) y **exploración** (lo `ai`/Dani/Instagram hasta que se programa). Nada de
Exploración se presenta como parte del viaje real hasta que los viajeros lo deciden; la propuesta
`ai` es andamiaje de desarrollo que desaparece a medida que entra el plan real y nunca es capa
permanente.

**Correcciones canónicas (Fase 12, esta sesión):** Confirmado es estrecho (hoy solo vuelos + los
dos hoteles reservados) y confirmar es una acción deliberada; la procedencia `ai` se etiqueta "IA"
(no "Exploración", que es capa); los hoteles se tratan como los vuelos; los precios no dominan la
UI (presupuesto bajo demanda). El rediseño visual de la Fase 9 se considera **demasiado
conservador**: antes de la Fase 12 se hará una iteración de rediseño de producto/UX con las cuatro
Skills que RETE la interfaz en vez de pulirla (día vacío, día completado, jerarquía, interacción,
animación, divulgación progresiva; producto de viaje premium moderno). `Itinerario.docx` es lista
de deseos, no itinerario.

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

1. **Política Firebase v2-only** (§5): 3 `fb.set`, ni uno más; jamás `state/days`/`state/transfers`
   (archivo congelado de la app original: tampoco borrarlos sin decisión explícita del usuario).
2. **Ids canónicos inmutables**: `catalog_*`, `dani_*`, `airport_*` y las claves curadas
   (`nakamise`…) están vivos en la base de producción de tres personas. No renombrar.
   `LEGACY_PID_MAP` es permanente (copias antiguas traen pids con clave curada).
3. **Nombres de token CSS = API interna**: las plantillas JS los usan inline (`--muted` 62 usos…).
   No renombrar tokens; añadir es seguro.
4. **Los tests dependen del contrato del DOM**: ids (`#dayPanel`, `#placesGrid`, `#mapCatChips`…),
   clases-gancho (`.fchip`, `.day-chip`, `.stop`, `.t-opt`, `.dani-row`, `.place-card`, `.b-pasar`,
   `add-stop`…), el atributo `data-pid` de las tarjetas de lugar (los tests extraen ids de ahí desde
   la Fase 11) y algunos strings de plantilla (`✓ nuestro`, `D Dani`, `🕐`, `Todos`). Si cambias
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
11. **`migratedOrig` es monótona**: nunca se borra ni se pisa con un remoto vacío; borrarla
    re-ejecutaría la consolidación 10b (resucitaría paradas eliminadas).
12. **`sw.js`**: el nombre de caché (`japon27-vN`) solo sube si cambia la lista `SHELL`; el
    contenido se refresca solo. Nunca interceptar APIs vivas (teselas, Nominatim, OSRM,
    Overpass, RTDB) ni cachear respuestas parciales (206).
13. **La procedencia es historia (inmutable)**: `provenance` (`ours`/`dani`/`instagram`/`ai`) se
    fija al entrar el lugar y NO cambia nunca. Adoptar o planificar un lugar NO altera su
    procedencia (un lugar de Dani sigue siendo de Dani; uno de `ai` sigue siendo `ai`). Lo que
    cambia es si se incluye en el viaje (estado), no de dónde vino. Es un eje distinto del estado.
14. **Separación confirmado / planificación / exploración**: mantener los tres modelos mentales
    visualmente distintos en todo el producto. Confirmado = vuelos + hoteles reservados;
    planificación = itinerario decidido; exploración = `ai`/Dani/María/Instagram sin
    programar. **Actualizado en 12.49:** la propuesta sembrada YA NO vive dentro del plan:
    se retiró de una vez (marca `seedRetired`, ligada al linaje de días) y existe solo como
    la referencia "Propuesta" (solo lectura, cada parada plantable a propósito con ＋). Toda
    parada del plan es una decisión. La propuesta nunca vuelve a entrar en el plan por sí sola.

## 13. Supuestos que el trabajo futuro no debe romper por accidente

- La app original está RETIRADA del flujo soportado (decisión del usuario, Fase 10), pero sus
  datos siguen llegando por otras vías: nodos de archivo en la nube (`state/days`,
  `state/transfers`), copias de seguridad antiguas y localStorage viejo. Todo cambio debe
  sobrevivir a un `onValue` o import con esos datos (arrays podados incluidos, pids con clave
  curada, catálogos sin fusionar).
- `applyCatalogUpdate` puede re-sembrar lugares borrados al subir `CATALOG_VERSION` (avisado en
  el confirm de borrado). La fusión (`foldCurated`) debe seguir siendo determinista e
  idempotente: los tres móviles convergen byte a byte al mismo array.
- Los servicios externos (OSRM de FOSSGIS, Overpass, Nominatim) son públicos y con rate-limit:
  la cola de límites espera 1,15 s entre peticiones; OSRM en cola de 250 ms; cachés en
  localStorage. No paralelizar esas peticiones.
- `mapDay === -1` significa "Todos los días" (sin rutas, sin OSRM). `curDay`/`mapDay` indexan
  `state.days`; el array es fijo de 21 (M10).
- El pre-pintado del tema vive en un `<script>` del `<head>` (evita flash); `setTheme` mantiene
  sincronizados `data-theme`, `<meta theme-color>` y las teselas de mapa/mini-mapa.
- El manifest PWA se genera en runtime (blob) dentro del propio HTML: no hay manifest.json.
- El service worker sirve el shell cache-first: tras desplegar un cambio, la PRIMERA apertura
  con red aún muestra la versión anterior mientras se refresca en segundo plano; la segunda
  apertura ya estrena. Es el comportamiento elegido (sin toasts ni recargas a mitad de uso).
- Node ≥18 basta para la suite. La APP en runtime sigue sin dependencias ni build
  (single-file + `sw.js`). Excepción dev-time: `package.json` declara Playwright
  SÓLO para el importador de María (`tools/maria-import.js`); `node_modules/` está
  en `.gitignore` y no se sube. Ejecutar el importador requiere `npm i` +
  `npx playwright install chromium`. No introducir dependencias de runtime.
