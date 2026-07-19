# Informe de paridad funcional — Fase 8c (gate)

**Fecha:** 2026-07-07 · **Alcance:** verificación, sin cambios de código en la app.
**Veredicto: PARIDAD FUNCIONAL ALCANZADA** (con los descartes intencionales listados abajo).

La auditoría completa original está en el historial del proyecto (auditoría previa a la Fase 7a);
este documento cierra cada uno de sus ítems.

## 1. Ítems de la auditoría — estado final

### Funcionalidad que faltaba (M)

| Ítem | Estado | Fase | Nota |
|---|---|---|---|
| M1 Vista itinerario Dani (14 días + Pasar) | ✅ Completado | 7b | Datos idénticos; render adaptado al diseño actual |
| M2 PDF de Dani | ✅ Completado | 7a | Asset del repo (`JAPON-DEFINITIVO-Dani.pdf`, 811.736 B, verificado byte a byte); Drive descartado por falta de permisos |
| M3 Rutas Dani en el mapa (D1–D14) | ✅ Completado | 7b | `drawDaniRoutes` portado casi literal |
| M4 Capa de vuelos (arcos + aeropuertos + toggle) | ✅ Completado | 8a | `greatCirclePoints` y tabla AIRPORTS portados |
| M5 Filtro del mapa por categoría | ✅ Completado | 8a | Integrado con capas N/D/I; ciudades base siempre visibles |
| M6 Pin de zona bajo el umbral de zoom | ✅ Completado | 8a | `drawZonePin` portado; carga de límites intacta |
| M7 Filtros de origen + compartidos en Sitios | ✅ Completado | 7c | Sin duplicados gracias a la capa de alias (D1) |
| M8 Filtro de origen en Hoteles | ✅ Completado | 7c | Los 6 alojamientos de Dani visibles con sus datos |
| M9 Selector de origen en el formulario | ✅ Completado | 7b | Contabilidad de guardado (`daniAdopted`, `catalogItem`) portada literal |
| M10 Añadir/eliminar días | 🔶 Descartado a propósito | — | Viaje fijo de 21 días delimitado por vuelos; documentado en el código |
| M11 Inferencia de hora al mover/insertar | ✅ Completado | 8b | Funciones puras portadas literales; integradas en reordenar, mover de día y añadir |
| M12 PWA (manifest, metas Apple, theme-color) | ✅ Completado | 8b | Mismo mecanismo de manifest dinámico; branding actual |

### Regresiones (R)

| Ítem | Estado | Fase | Nota |
|---|---|---|---|
| R1 Teselas del mapa según tema | ✅ Completado | 8a | `applyMapTheme` con el mecanismo original; claro=Voyager, oscuro=CARTO dark |
| R2 Import/export compatible + fusionar | ✅ Completado | 7a | Los 3 formatos de copia; guard contra reducir `state.places` sin confirmación |
| R3 Sesgo Japón en Nominatim | ✅ Completado | 8b | `viewbox` + reintento ", Japan"; mejoras actuales conservadas |
| R4 Offline (librerías embebidas) | ✅ Completado | 10c | `sw.js` cache-first (shell + PDF + CDNs versionadas) con refresco en segundo plano; supera al embebido y la app original tampoco tenía SW |

### Parciales (P)

| Ítem | Estado | Fase | Nota |
|---|---|---|---|
| P1 Itinerario original visible | ✅ Completado | 8b | Vista "App original" solo lectura desde `state.origDays`; su modelo no se toca |
| P2 Transfers del modelo original editables | ✅ Completado | 10b | Migración única al modelo v2 (`maybeMigrateOriginal`): las opciones del original viven ahora en los huecos v2, plenamente editables |
| P3 Arrastrar parada a otro día | 🔶 Adaptación aceptada | — | Modal "Mover a otro día" (la vista es de un día); revisar UX en Fase 9 |
| P4 Descubribilidad de "Pasar" | ✅ Completado | 7b/7c | Adopción desde vista Dani, listas y ficha |
| P5 Editar/borrar lugares compartidos | ✅ Completado | 7b | Con aviso de re-siembra para ids de catálogo |
| P6 Modo "Todos los días" en el mapa | ✅ Completado | 8a | Solo marcadores; cero tráfico OSRM/Overpass |

### Deuda técnica (D)

| Ítem | Estado | Fase | Nota |
|---|---|---|---|
| D1 Dos catálogos solapados | ✅ Completado (fusión real) | 7c/10a | Catálogo único en `state.places` (`foldCurated`); `CATALOG_ALIAS` eliminado; ediciones de usuario protegidas campo a campo |
| D2 Código muerto | ✅ Completado | 11 | Borrados `TOKYO_SPECIAL_WARDS` e `isAirportPlace`; `DANI_ROUTE_GROUPS` y `origDays` están vivos |
| D3 Helpers duplicados | ✅ Completado | 11 | `haversineMeters` deriva de `haversine`; `placeUid` de `uid`; `esc` era único |
| D4 Dos modelos de transfers | ✅ Completado | 10b | = P2; el espejo `state.transfers` ya no existe en el modelo vivo |
| D5 onclick inline globales | ✅ Completado | 11 | Cero handlers inline: `data-pid`/ids + `addEventListener` tras cada render |
| D6 Restos en el repo | ✅ Completado | 7a | `index - pre.html` eliminado; `index-pre-source.html` se queda como referencia permanente |
| D7 Categoría `excursion` sin mapear | ✅ Completado | 7c | Añadida a `CATS` |

## 2. Verificación en vivo contra Firebase (producción)

- Estructura remota correcta: `proyectos/viaje-japon = {tripTitle, state}`;
  `state = {days, places, transfers, catalogVersion, v2}` — **coexistencia confirmada**.
- Los 21 días del modelo original conservan exactamente `{date, id, isFlightDay, label}`:
  **cero contaminación del modelo v2** tras semanas de escrituras de esta app.
- El nodo `v2` contiene solo `{days, rate, updatedAt, v}` — sin places/transfers/tripTitle.
- 220 lugares en producción (190 de semilla + ediciones), 150 de Dani, catalogVersion vigente.
- Ida y vuelta de escritura verificada en una clave hermana aislada
  (`proyectos/japon27-gate-test`, creada, leída y borrada; invisible para ambas apps).
- El `adoptRemote` real consumió el payload de producción sin errores: 220 lugares
  adoptados, espejo de 21 días originales, v2 restaurado con arrays reparados.

## 3. Auditoría de la política de escritura

Con un `fb` falso inyectado en la app real (suite `test-8c-gate.js`):

- `pushRemote` → **solo** `state/v2`, payload exactamente `{v, days, rate, check, updatedAt}`.
- `pushPlaces` → **solo** `state/places` (el array tal cual).
- `pushTitle` → **solo** `tripTitle` (escalar).
- Exactamente 3 call-sites de `fb.set` en todo el código; ninguno sobre `rootNode`.
- **Ninguna ruta de escritura puede alcanzar `state/days` ni `state/transfers` del modelo original.**

## 4. Suites de regresión (todas en verde)

`node tests/run-all.js [volcado-firebase.json]`

| Suite | Cobertura | Checks |
|---|---|---|
| test-7a-import | 3 formatos de copia, fusionar/reemplazar, guard de lugares | 6 casos |
| test-7b-dani | vista Dani, adopción, rutas D1–D14, origen | 11 |
| test-7c-lists | integridad de alias, sin duplicados, filtros, hoteles Dani | 25 |
| test-8a-map | vuelos, categorías, pins de zona, teselas, Todos, fugas de capas | 23 |
| test-8b-platform | theme-color, viewbox Japón, inferencia de hora, vista original | 21 |
| test-8c-gate | payload en vivo + política de escritura | 15 |

Además: comprobación de sintaxis del script completo y smoke HTTP
(index 200, PDF 200 `application/pdf`, manifest servido).

*Nota (2026-07-19): esta tabla es la foto del gate 8c. `test-7c-lists.js` se retiró después,
al desaparecer la capa de alias con la fusión real del catálogo (10a), y la Fase 12 añadió 13
suites nuevas. La lista vigente la define `tests/run-all.js` (ver PROJECT.md §10).*

## 5. Fases posteriores (estado)

- **Fase 9** — rediseño visual completo (Apple HIG + minimalismo japonés): HECHA (`1db5185`).
- **Fase 10** — consolidación (gate aprobado 2026-07-07, los tres viajeros usan solo esta app):
  HECHA. 10a fusión real de catálogos (`7f63a63`), 10b modelo único de itinerario/transfers con
  migración única (`3f82943`), 10c service worker offline (`6b40e34`).
- **Fase 11** — calidad de código: HECHA. D2 (código muerto), D3 (helpers duplicados) y D5
  (onclick inline globales) cerradas; `userPlaceView`→`placeView`, `userHotels`→`bookedHotels`;
  em-dashes fuera de comentarios. Sin cambios visuales/funcionales (suite verde). Con esto, la
  tabla de Deuda técnica (D1–D7) queda íntegramente en verde.
- **Fase 12** — procedencia, importadores y pestaña Itinerarios (12.1–12.56 + F1–F3b): EN CURSO.
  Historia completa y decisiones en PROJECT.md §7–§9. La paridad de este informe no se ve
  afectada: los cambios son de modelo de producto sobre la base ya paritaria.

## 6. Riesgos conocidos (revisados tras la Fase 10)

1. ~~Ediciones de la app original en un `catalog_*` con gemelo curado invisibles aquí~~ —
   RESUELTO en 10a: catálogo único con protección campo a campo (la edición de usuario gana
   sobre la semilla; lo verificó el caso real de Akihabara `zona→compras` en producción).
2. ~~Duplicados de nombre curado↔catálogo bajo "Todos"~~ — RESUELTOS en 10a. Los pares
   nuestros↔Dani siguen siendo entradas separadas A PROPÓSITO (fuentes paralelas con notas
   propias); conviven bajo "Todos".
3. `state/places` sigue siendo un nodo de escritura total: una restauración de copia antigua
   puede retroceder lugares — mitigado con las confirmaciones, el guard de reducción del
   import y la re-fusión automática del catálogo al adoptar.
4. El archivo `origDays` depende de la nube: sin sincronizar nunca, la vista "App original"
   queda vacía (comportamiento documentado en la propia vista).
5. Borrar `migratedOrig` a mano re-ejecutaría la consolidación 10b y podría resucitar paradas
   eliminadas: la marca es monótona y no debe tocarse (PROJECT.md §12.11).
