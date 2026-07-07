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
| R4 Offline (librerías embebidas) | ⏳ Aplazado a Fase 10 | — | Un service worker cache-first supera al embebido; la app original tampoco tenía SW |

### Parciales (P)

| Ítem | Estado | Fase | Nota |
|---|---|---|---|
| P1 Itinerario original visible | ✅ Completado | 8b | Vista "App original" solo lectura desde `state.origDays`; su modelo no se toca |
| P2 Transfers del modelo original editables | ⏳ Aplazado a Fase 10 | — | Consolidación de los dos modelos de itinerario (migración única) |
| P3 Arrastrar parada a otro día | 🔶 Adaptación aceptada | — | Modal "Mover a otro día" (la vista es de un día); revisar UX en Fase 9 |
| P4 Descubribilidad de "Pasar" | ✅ Completado | 7b/7c | Adopción desde vista Dani, listas y ficha |
| P5 Editar/borrar lugares compartidos | ✅ Completado | 7b | Con aviso de re-siembra para ids de catálogo |
| P6 Modo "Todos los días" en el mapa | ✅ Completado | 8a | Solo marcadores; cero tráfico OSRM/Overpass |

### Deuda técnica (D)

| Ítem | Estado | Fase | Nota |
|---|---|---|---|
| D1 Dos catálogos solapados | ✅ Mitigado (alias) / ⏳ fusión real en Fase 10 | 7c | `CATALOG_ALIAS` (26 entradas) elimina listados duplicados; ids intactos por compatibilidad |
| D2 Código muerto | ⏳ Fase 11 | — | `TOKYO_SPECIAL_WARDS` (muerto también en la original); `DANI_ROUTE_GROUPS` y `origDays` ya están vivos |
| D3 Helpers duplicados | ⏳ Fase 11 | — | haversine/haversineMeters, uid/placeUid, esc |
| D4 Dos modelos de transfers | ⏳ Fase 10 | — | = P2 |
| D5 onclick inline globales | ⏳ Fase 9 | — | Se reescriben con las plantillas del rediseño |
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

## 5. Aplazado a Fase 9+ (plan aprobado)

- **Fase 9** — rediseño visual completo (Apple HIG + minimalismo japonés); absorbe P3 (UX de
  arrastre entre días) y D5 (plantillas sin onclick inline).
- **Fase 10** — consolidación: un único modelo de itinerario/transfers con migración (P2/D4),
  fusión real de catálogos (D1), service worker offline (R4). Solo cuando los tres viajeros usen esta app.
- **Fase 11** — calidad de código: D2, D3, nombres, docs, rendimiento; sin cambios visuales/funcionales.

## 6. Riesgos conocidos

1. La ficha curada y la entrada compartida con alias son objetos distintos: si la app original
   edita un `catalog_*` con gemelo curado, ese cambio no se ve en las listas de esta app
   (la versión curada manda). Se resuelve con la fusión de la Fase 10.
2. Los duplicados de nombre bajo el filtro "Todos" (par curado↔Dani) son intencionales
   hasta la Fase 10; pueden sorprender a un usuario nuevo.
3. `state/places` es un nodo compartido de escritura total (política heredada de la Fase 3):
   una restauración de copia antigua puede retroceder lugares de ambas apps — mitigado con
   las confirmaciones y el guard de reducción del import.
4. El espejo `origDays` depende de la nube: sin sincronizar nunca, la vista "App original"
   queda vacía (comportamiento documentado en la propia vista).
