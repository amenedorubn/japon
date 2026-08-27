# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Proyecto Japón 2027

## 🎯 Propósito

Guía de comportamiento para Claude Code. Define patrones, restricciones y decisiones
arquitectónicas de este proyecto para evitar over-engineering, inconsistencias y sorpresas.

**La referencia canónica completa es `PROJECT.md` — léelo SIEMPRE antes de tocar código.**
Este archivo es solo el resumen de comportamiento; si algo contradice a PROJECT.md, gana PROJECT.md.

> Nota histórica: la primera versión de este archivo (16-jul-2026) describía por error un stack
> TypeScript/Node/SQL con `src/models`, `src/repositories` y Jest. Nada de eso existe ni existió
> en este repo. Corregido el 19-jul-2026.

## 📋 Stack real

- **App:** UNA página (`index.html`, ~7.3k líneas: HTML + CSS + JS vanilla). Sin framework,
  sin build, sin TypeScript, sin dependencias de runtime. Leaflet 1.9 por CDN.
- **Offline:** `sw.js` (service worker cache-first).
- **Publicación:** GitHub Pages. **Sync:** Firebase RTDB compartida entre los 3 móviles.
- **Tests:** `node tests/run-all.js` (Node ≥18, sin frameworks de test).
- **Dev-time:** importadores en `tools/` (Node puro; Playwright SOLO para el de María).

## ⚙️ Comandos

```bash
node tests/run-all.js                      # suite completa (obligatorio antes de cada commit)
```

```bash
node tests/run-all.js live.json            # + suite 8c (gate de paridad contra un volcado real)
```

El volcado en vivo NUNCA se versiona (está en `.gitignore`); se obtiene con:

```bash
curl https://viaje-japon-8748a-default-rtdb.firebaseio.com/proyectos/viaje-japon.json > live.json
```

**Ejecutar UNA sola suite** tiene truco: los `tests/test-*.js` no leen `index.html`, reciben por
`argv[2]` la ruta del JS ya extraído. `run-all.js` lo escribe en
`<tmp>/japon27-app-under-test.js`, así que tras una pasada completa basta con:

```bash
node tests/test-12-ruta.js "$TEMP/japon27-app-under-test.js"
```

En PowerShell el mismo fichero es `$env:TEMP\japon27-app-under-test.js`. Si `index.html` cambió
después, vuelve a lanzar `run-all.js` (regenera el extracto) antes de repetir la suite suelta.

**Servidor local** (smoke HTTP obligatorio antes de commitear: `index.html`, `sw.js` y el PDF en
200) — `http://localhost:8734/`. Preferible arrancarlo con la herramienta de preview
(`.claude/launch.json`, configuración `japon2027`) en vez de a mano:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1
```

**Importadores dev-time** (todos siguen el patrón import→bake→seed; `--bake` es lo que reescribe
el bloque correspondiente dentro de `index.html`):

```bash
node tools/docx-import.js --bake            # Itinerario.docx  -> DOCX_OURS_IDS
```

```bash
node tools/dani-import.js --bake            # PDF de Dani      -> DANI_PLACES_RAW
```

```bash
node tools/maria-xlsx-import.js --bake      # planningjapon.xlsx (local, no versionado)
```

`tools/maria-import.js` es la excepción: necesita `npm i` + `npx playwright install chromium`
porque resuelve las listas de Google Maps con un navegador real.

**Exportador de calendario** (el inverso: lee `index.html` y escribe assets estáticos). Regenerar
y COMITEAR tras tocar `RUTA_DAYS`/`TRANSPORT`/`FLIGHTS`; con volcado en vivo genera también el
plan real:

```bash
node tools/ics-export.js [live.json]
```

## 🏗️ Estructura real de directorios

```
japon/
├── index.html               LA app entera (datos horneados entre marcadores)
├── sw.js                    Service worker offline
├── index-pre-source.html    App original, referencia SOLO LECTURA (no borrar)
├── database.rules.json      Reglas RTDB (fuente en el repo; se pegan A MANO en la consola)
├── tools/                   Importadores dev-time (import→bake→seed) + ics-export.js
├── import/                  Datos extraídos que se hornean en index.html
├── tests/                   Suite de regresión + run-all.js
├── design/                  Sistema de diseño modular (+ DIRECTION.md, DESIGN.md)
├── *.ics                    Feeds de calendario estáticos (generados, se comitean)
├── Itinerario.docx          Fuente de la procedencia "ours"
├── JAPON-DEFINITIVO-Dani.pdf  Fuente de los lugares de Dani
└── PROJECT.md · PRODUCT.md · PARITY.md · CLAUDE.md
```

## 🔑 Tres contratos que atan todo el repo

Entender estos tres explica por qué el proyecto se toca de una forma y no de otra:

1. **Contrato de extracción de tests.** Todo el JS de la app vive en el ÚNICO bloque
   `<script>"use strict";…</script>` justo antes de `</body>`; `run-all.js` lo extrae con una
   regex, hace `node --check` y lo ejecuta con stubs de DOM/Leaflet. Añadir un segundo `<script>`
   ahí, o cambiar ese preámbulo, deja la suite entera a ciegas.
2. **Marcadores de horneado.** Los datos de fuentes externas nunca se escriben a mano: viven entre
   pares `// @@X_START` / `// @@X_END` dentro de `index.html` y los reescriben los importadores
   (`DANI_PLACES`, `OURS_IDS`, `MARIA_TRIP`, `INSTA_PLACES`, `AI_PLACES`). Editar a mano dentro de
   un marcador se pierde en el siguiente `--bake`.
3. **Política Firebase v2-only.** Exactamente 3 `fb.set` en toda la app (`pushRemote → state/v2`,
   `pushPlaces → state/places`, `pushTitle → tripTitle`) y ni uno más. `state/days` y
   `state/transfers` son archivo congelado de la app original: se leen, jamás se escriben.
   Es el invariante nº 1 (PROJECT.md §5).

## ✅ Patrones que USAMOS (respétalos)

- **Single-file**: toda la app vive en `index.html`. Los datos de fuentes externas NO se
  escriben a mano: los hornean los importadores de `tools/` entre marcadores.
- **Render por secciones**: funciones `renderX()` que reconstruyen `innerHTML`; handlers con
  `addEventListener` tras cada render (cero `onclick` inline, cerrado en Fase 11).
- **Comentarios en español** que explican el PORQUÉ (decisiones, invariantes), no el qué.
- **Ejes separados**: procedencia (historia, inmutable) ≠ estado (planificado/confirmado) ≠
  zona (derivada de coordenadas, nunca persistida). No mezclarlos.
- **Tests contra el código real**: `run-all.js` extrae el JS de `index.html` y lo ejecuta con
  stubs de DOM/Leaflet. Los tests dependen del contrato del DOM (ids, clases-gancho, `data-pid`).
- **Servicios externos en cola, nunca en paralelo**: Nominatim 1,15 s entre peticiones, OSRM en
  cola de 250 ms, con caché en localStorage. Son servicios públicos con rate-limit.

## ❌ NUNCA hagas esto

- **No añadas frameworks, build steps ni dependencias de runtime.** La app es un archivo.
- **No escribas en Firebase fuera de los 3 `fb.set`** (`pushRemote`/`pushPlaces`/`pushTitle`):
  la política v2-only de PROJECT.md §5 es el invariante nº 1. Jamás `state/days`/`state/transfers`.
- **No renombres** ids canónicos de lugares, tokens CSS, ni claves compartidas de localStorage.
- **No toques plantillas sin actualizar `tests/` en el MISMO commit** (suite en verde siempre).
- **No borres** `index-pre-source.html` ni los nodos de archivo de la nube.
- **No dejes TODOs o FIXMEs sin contexto.**
- **No re-implementes lo descartado** (PROJECT.md §8: presupuesto, días variables, IA de 5
  pestañas Hoy/Plan/Ideas/Mapa/Guía rechazada el 19-jul-2026, etc.) sin decisión del usuario.
- **No metas datos privados de terceros en el repo**: es PÚBLICO (GitHub Pages). `planningjapon.xlsx`
  está en `.gitignore` por eso; su importador hornea solo lo publicable.

## 🔄 Cuando tengas dudas, PREGUNTA

Antes de proceder, pregunta si:

1. Necesito añadir una dependencia (aunque sea dev-time) o un fichero nuevo de primer nivel.
2. El cambio toca la política de Firebase, el modelo de datos persistido o el esquema compartido.
3. Voy a cambiar patrones o convenciones ya establecidas (o algo listado en PROJECT.md §12).
4. La solución cubre un caso edge que el usuario no mencionó explícitamente.

**Regla de oro**: es mejor frenar y preguntar que generar código que luego haya que rehacer.

## 📝 Estándares de código

- **Naming**: `camelCase` funciones/variables, `MAYUS_SNAKE` para constantes de datos horneados.
- **Líneas**: máximo ~100 caracteres. Identación 2 espacios.
- **Comentarios**: solo el porqué; sin em-dashes en comentarios (los `–` de datos/copy sí).
- **Commits**: verbo presente, uno por fase, mensaje descriptivo; suite verde antes de commitear.
- **Verificación**: `node tests/run-all.js` + smoke HTTP con `.claude/serve.ps1` antes de cada commit.

## 🚀 Estado actual

- **v2** (27-ago-2026, sin número de materialización de Fase 12): alojamiento completo — las 9
  reservas del viaje (18 noches del 9 al 27 de abril) están cerradas y confirmadas, y el traslado
  Osaka→Tokio se movió del 24 por la tarde (Nozomi 13:50) al 25 por la mañana (Shinkansen
  Shin-Ōsaka→Tokio ~06:00→~08:30, horario a confirmar cuando salga el calendario JR). Osaka pasa
  de 3 a 4 noches (21–25 abr); el 24 es día completo en Osaka (mañana de mercado/castillo ya
  existente + tarde nueva de Shinsaibashi/Tokito/Round1/Kitan); el 25 arranca con el Shinkansen,
  taquillas en Tokyo Station y Kamakura desplazado ~1h15 (nota de riesgo: único punto de fallo del
  día). `RUTA_DAYS.stay`, `NIGHTS` (las 11 filas pasan a `ok`, la fila `amp` desaparece), `DAY_EXTRAS`,
  `TRANSPORT`, `Ruta-21-dias.docx` y los `.ics` estáticos se regeneraron/editaron a mano en el mismo
  commit. `nightCityFor`/`hotelForNight` ganan un fallback a `NIGHTS` para las 7 ciudades que no
  viajan como nodo propio en `state.places` (solo Louis House y APA lo hacen): con las 18 noches
  reservadas, REALIDAD y Ruta ya coinciden en alojamiento para todo el viaje. Correcciones puntuales:
  Kanmangafuchi (12-abr) se acorta a 45 min para llegar a tiempo al check-in de Kinugawa Onsen;
  Kuwataniya (Takayama) no incluye cena kaiseki (solo desayuno con reserva previa); el motivo de
  descarte de Nagoya deja de ser "María ya la vio" (inválido) y pasa a "ciudad de paso, no destino".
  Pendiente sin decidir: los placeholders `hotel_nikko`/`kanazawa`/`takayama`/`kyoto`/`hiroshima`/
  `fukuoka`/`osaka` del catálogo ("Bases por reservar") quedan tal cual, con fechas que ahora
  coinciden con reservas ya cerradas — no se tocaron por no estar en el encargo; decidir si se
  retiran o se reescriben como "por si ampliáis" (igual que `hotel_tokyo`, que sí sigue vigente).
- **Fase 12** (EN CURSO): procedencia, importadores (F1–F3b), pestaña Itinerarios; con la
  planificación dada por completa, el foco pasa a ser el mejor compañero durante el viaje real.
  Última materialización **12.75** (revisión de acceso: Google Sign-In + flujo de aprobación,
  sustituye la lista fija de Email/Password de 12.74 — cualquier cuenta de Google puede
  autenticarse, pero el acceso exige aprobación de un administrador designado; panel 👥 para
  aprobar/rechazar/revocar — ver PROJECT.md §16, incluye los 3 PASOS MANUALES pendientes: habilitar
  el proveedor Google, fijar `access/adminEmail`, pegar las reglas de RTDB actualizadas). Antes,
  **12.73** (feed de calendario suscribible:
  `tools/ics-export.js` genera
  `ruta-japon-2027.ics`/`realidad-japon-2027.ics` como assets estáticos publicados por GitHub
  Pages, con enlace `webcal://` en Guía — "se actualiza" significa regenerar + commit + push,
  igual que el docx de la Ruta; sin servidor que lo haga solo). Antes, **12.72** (arquitectura
  preparada para un futuro modo en vivo, SIN UI: `nowStatus()` sobre las entradas ya derivadas de
  la agenda de Realidad — ver PROJECT.md §15). Antes, **12.71** (Booking Timeline: nueva sección en Guía + teaser en Inicio
  que responden "¿qué toca reservar a continuación?" combinando `BOOKINGS` — 10 reservas con
  ventana de venta real cuando se conoce — con las noches `res`/`amp` de `NIGHTS`, sin fechas
  inventadas). Antes, **12.70** (agenda 2.0: origen/destino visibles en cada tramo de Realidad +
  aviso "(estimado)" explícito) y **12.69** (mapa: un solo lenguaje visual de marcador —
  `pinIcon()` unifica paradas numeradas, POIs de "Todos" (ahora con emoji de categoría, no un
  punto plano), extras opcionales y aeropuertos/vuelos en 3 variantes de aro que se leen sin
  texto). Antes, **12.68** (5 prioridades de esa fase): "〰️ Líneas Dani" solo se ve en el
  itinerario de Dani; los extras "si sobra tiempo" se leen inlineados DENTRO del recorrido de un
  día concreto (panel y mapa, con rama punteada hacia un pin propio) en vez de aparte, salvo en
  "Todos los días" que conserva el `<details>` colapsado; Realidad gana horas inferidas en cada
  hueco de transporte + aviso 🎫 de reserva y su propio export **.ics** en vivo (sigue el plan
  real, no una referencia fija); e indicador de intensidad por día (🟢🟡🟠🔴) visible en el Cord, en
  Realidad y en la Ruta. Antes, **12.66–12.67** (`dayTimeline()`: agenda cronológica del día,
  fuente única para el render de la Ruta y su export .ics; el mapa ya filtra de verdad por día
  seleccionado — fix 12.65 — y el toggle 🎁 Extras es independiente del itinerario). El docx
  (`Ruta-21-dias.docx`) queda deliberadamente FUERA de esa fuente única por ahora: ya tiene
  narrativa más rica de la que `dayTimeline()` deriva hoy, y regenerarlo sería una regresión (ver
  PROJECT.md §7).
- **Después de 12.75** (endurecimiento, sin número de materialización): `database.rules.json`
  entra al repo con las reglas RTDB reales (lectura y escritura solo para uid aprobado, `tripTitle`
  solo admin, lista de usuarios cerrada, autorregistro validado a `pending`/`traveler` con email
  verificado) y se corrige el `start_url`/`scope` del manifest PWA dinámico. Las reglas del repo
  son la FUENTE, pero solo aplican cuando el usuario las pega en la consola de Firebase.
- Pestañas vigentes: Ideas · Itinerarios (Realidad · Ruta · Dani · María; Propuesta oculta pero
  restaurable) · Confirmado · Hoteles · Guía.
- Decisiones del 19-jul-2026: propuesta de 5 pestañas RECHAZADA; el reparto de alojamientos
  del 12 al 25 de abril está SIN DECIDIR (ver PROJECT.md §9).

Historia completa de fases, invariantes y supuestos: `PROJECT.md` §7, §12 y §13.

---

**Última actualización:** 27 de agosto de 2026
**Mantenedor:** amenedorubn
**Sincronización:** Archivado en Git. Actualizar cuando cambien decisiones arquitectónicas.

---

## Cómo usar este archivo

1. Claude Code lo lee automáticamente al abrir el repo.
2. Si algo no está claro, Claude preguntará antes de proceder.
3. Actualiza este archivo cada vez que tomes una nueva decisión arquitectónica.
4. Commit y push después de cambios. El historial en Git es tu audit trail.
