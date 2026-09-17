# HANDOFF v3 — Japón 2027

Traspaso de sesión (poca cuota restante, se abre chat nuevo). Léelo entero antes de tocar nada.

## 1. Estado actual

**Último commit:** ver historial abajo (sesión 2026-09-18: fix de orfandad de overrides en el
importador + documentación del camino seguro de actualización). Antes, `0a785ff` — fix de
`v3/sw.js` (filtro de esquema en el `fetch` listener). Antes, `a3dc65e` — "v3: Fase 6 - login
Google + sync Firebase (viaje-japon-v3), sin desplegar reglas".

**Fase 6 CERRADA DEL TODO (2026-09-17/18):** reglas publicadas (diff de V3-DESIGN.md §H,
comparado antes byte a byte con lo que ya había en la consola — idénticas), `proyectos/viaje-
japon-v3/state` sembrado (349 items, con los campos privados ya dentro — price/bookingRef/
address/hotelPhone — corrección 2 del usuario, no esperan a la Fase 8), dominios de Auth
confirmados (`amenedorubn.github.io` y `localhost`, ya estaban), **y la prueba con 2
dispositivos dio OK: sync en tiempo real, offline con modo avión + cierre de la app, y Deshacer
propagado correctamente al otro dispositivo.** v2.1 sigue funcionando sin notar nada.

Historial reciente relevante (más nuevo primero):
- *(sin commitear todavía)* — **camino seguro de actualización del catálogo** (encargo del
  usuario tras la siembra manual con `set()`: "documenta que NUNCA se repita ese bloque con
  datos ya en uso"). `tools/v3-migrate-import.js` acepta ahora, como 3er argumento, el export
  COMPLETO de `proyectos/viaje-japon-v3/state` desde la consola de Firebase (⋮ → Export JSON;
  antes solo aceptaba un array plano de items, formato viejo de la Fase 2) y detecta overrides
  HUÉRFANOS: una entrada de `hechoOverrides`/`estadoOverrides` cuyo itemId ya no existiría tras
  la actualización (p.ej. el dedup agrupó ese sitio de otra forma) — se avisa por consola, nunca
  se borra nada solo. El resto (Decisión B, `v3/lib/merge.js`, ya existía desde la Fase 2, sin
  tocar) sigue igual: conserva `notas`/`hecho`/`estadoManual` de cada ítem y nunca borra un ítem
  que solo exista en v3. Procedimiento completo en §2. `v3-actual*.json` (el volcado local que
  usa este camino) añadido a `.gitignore` — lleva datos de reserva reales, igual que `live.json`.
- `0a785ff` — fix `v3/sw.js`: el listener `fetch` intentaba `cache.put()` con
  peticiones `chrome-extension://` (error real visto por el usuario al recargar con alguna
  extensión de Chrome instalada: "Request scheme 'chrome-extension' is unsupported") — ahora
  `esCacheable(url)` filtra a solo `http/https` del propio origen o `unpkg.com` (la única CDN que
  usa v3 hoy, Leaflet); lo demás se ignora del todo (sin `respondWith`, red directa, mismo patrón
  ya usado para `/import/`). `sw.js` raíz de v2.1 sin tocar.
- `a3dc65e` — **Fase 6 (código): login Google + sync Firebase.** Puerta de acceso reutiliza el
  nodo de aprobación de v2.1 (`proyectos/viaje-japon/access`, solo lectura, sin nodo `access`
  propio de v3 — decisión ya cerrada en V3-DESIGN.md §H). Nuevo `v3/lib/sync.js` (puro, testeado
  sin Firebase real): `fusionInicialHecho`/`fusionInicialEstado` (fusión "hecho gana" de UN SOLO
  USO por móvil, flag `jp27v3:migrado` — corrección 1 del usuario: después de esa fusión, Firebase
  manda solo y Deshacer hace un `remove` real, nunca puede resucitar desde caché local vieja) y
  `encolarEscritura`/`quitarDeCola` (cola de escrituras offline por RUTA, persistida en
  localStorage ANTES de intentar la red — corrección 3: sobrevive a cerrar la app en modo avión,
  se vacía sola al reconectar vía `.info/connected`). `marcarHechoPar`/`deshacerPar`/
  `marcarReservado`/`deshacerReservado` reescritos para pasar por esa cola; `itemsConOverrides()`
  lee de `overridesEnMemoria` (reflejo en vivo), ya no de `localStorage` directo. **Bug real
  encontrado probando con un mock de Firebase** (documentado, no inventado): el primer snapshot
  del listener en vivo podía llegar antes de que las escrituras de la fusión inicial se
  confirmasen, pisándola con datos viejos — arreglado ignorando ese primer snapshot justo tras
  migrar (`ignorarPrimerSnapshotHecho`/`Estado`). NO se desplegó ninguna regla ni se sembró ningún
  dato en ese commit (eso lo hizo el usuario después, ver arriba). Diff de reglas mostrado dos
  veces (al proponerlo y justo antes de desplegar), sin cambios entre una vez y otra.
- `387a4b6` — auditoría de reservas de comida: de 22 RouteItem de categoría 'comida' en la Ruta,
  solo K36 (Kioto) y Kitan Hibiki (Osaka) recomiendan reserva con fuente OFICIAL verificada
  (ninguna publica ventana de antelación → acción Pendientes nivel 4 "cuando puedas"); el resto
  son mercados/zonas de puestos (no aplica) o sitios sin fuente oficial clara ("sin confirmar", no
  inventado). La cena de cumpleaños del 19-abr en Hiroshima nunca tuvo restaurante en los datos
  reales (solo una nota condicional en el CHECKLIST/BOOKINGS de v2.1, sin pid) — Okonomimura (el
  plan que sí está en `RUTA_DAYS` ese día, con nota propia que ya dice "CENA DE CUMPLEAÑOS") se
  queda intacto; se añadió un ítem sintético curado a mano (`decision-cena-cumple-19abr`, sin
  ubicación, nunca se hace pasar por una parada real) con una acción sin fecha "decidir".
- `7f58ad5` — docs + privacidad: `V3-DESIGN.md` Fase 8 suma la tarea de sacar de los ficheros
  versionados de v2.1 raíz (precios de hoteles, bookingRef, direcciones, teléfonos, el enlace de
  Drive) y moverlos a Firebase, sin reescribir historial de git. Nuevo gate en
  `tests/test-v3-field-parity.js`: falla si aparece un enlace a `drive.google.com`/`dropbox.com`
  en cualquier fichero versionado bajo `v3/` o `tools/` (por patrón, no solo por el valor de hoy).
- `2a3397f` — **Fase 5b cerrada**: paridad de campos (auditoría → arreglo). `notes/web/video/tip/
  hours/price/yen/dur/region` (lugares) + `hotelArea/address/hotelPhone/bookingRef` (hoteles) +
  `flight/arr/airline/terminal/note` (vuelos) copiados sin renombrar — v2.1 (`foldCurated`) ya los
  tenía en `state.places`/`FLIGHTS`, era un bug de mapeo del importador, no falta de datos en la
  fuente. `v3/lib/twins.js`: `groupCanonical`/`applyManualMerges` ahora acumulan `fuentes[]` con
  TODOS los campos de cada procedencia fusionada (antes solo sobrevivía el id de la no ganadora).
  Ficha de detalle nueva en `v3/index.html` (hoja inferior, un solo sitio reutilizado desde Ruta/
  Reservas/Ideas/Pendientes vía `data-ficha`): descripción, horario, precio, tip, enlaces (web/
  Instagram/Google Maps) como botones, y un bloque por procedencia fusionada con lo que aporte
  DISTINTO de la ganadora (contradicciones se muestran las dos, nunca se elige una a ciegas).
  `duracionOrientativa` cuando RUTA_DAYS no trae `dur` pero el catálogo sí (marcada, nunca dato
  cierto). Filtro de Reservas por 6 categorías (`grupoReserva`, clasificado en el importador) +
  contador. Nuevo test permanente `tests/test-v3-field-parity.js` (gate con `live.json`, mismo
  patrón que el 8c): 1519+19 valores comprobados, 0 faltan; incluye chequeo de que
  `bookingRef`/`price`/`hotelPhone`/`address` de hoteles reales no aparezcan en ningún fichero
  versionado de la superficie v3.
- `7e8dca3` — **Fase 5 cerrada** (Reservas + Más). Reservas: 3 grupos —
  ✅ Confirmado (13: 9 hoteles + 4 vuelos), 🎫 Por reservar (reutiliza `pendientesView` tal
  cual, sin lógica propia), 👀 Vigilar apertura — cada tarjeta con enlace "Ver en la Ruta →
  fecha". Botón "Marcar como reservado" (solo en 🎫): promueve el ÍTEM a
  `estado:'confirmado'` + `estadoManual:true` vía `v3/lib/estado-overrides.js` (mismo patrón
  que `hecho-overrides.js`, jp27v3: local hasta Fase 6) + nota opcional (`notaReserva`, nunca
  versionada) + marca también la acción como hecha (desaparece de Pendientes a la vez). Nuevo
  helper `itemsConOverrides()` combina las dos capas (hecho + estado) y lo usan Pendientes,
  Ruta (un día) y Reservas por igual, así que un ítem reservado a mano se ve igual en las tres
  pantallas. Más: 205 ideas filtrables por procedencia/**categoría**/**ciudad** (dos campos
  nuevos horneados en el importador — `categoria` = `state.places.category` tal cual;
  `ciudad` = hotel confirmado más cercano por coordenadas, haversine sobre los 9 reales, nunca
  una tabla de ciudades inventada) + Guía (Tips/Frases/Precios/Descartes) extraída de
  `index.html` raíz con el mismo mecanismo que `RUTA_DAYS`/`TRANSPORT` (nunca retranscrita a
  mano — `loadV2Baked()` ahora también devuelve `TIPS/PHRASES/PRICES/SKIPPED`). CHECKLIST y
  "pasar idea a Ruta" quedaron fuera a propósito (decisión 2026-09-16). Probado en el móvil
  real por el usuario: Reservas, marcar como reservado, deshacer y Más — todo OK. Suite
  completa + gate 8c en verde, `git diff --stat -- index.html sw.js` vacío.
- `f6b3234` — **Fase 4 cerrada de verdad**: franja de check-in real (9 hoteles) + llegada
  estimada curada (siempre "≈", nunca dato cierto) sustituyen a la hora de apertura de franja
  como clave de ordenación — bug real corregido (19-abr salía a las 14:00, antes de Himeji).
  16-abr Kioto: bloque "🧳 Hueco 14:20–16:00 · maletas" + acción Pendientes nivel 4
  ("preguntar cuando puedas", NO nivel 3 — cuidado, `reglaApertura` fuerza nivel 3 en
  `precisionLevel()`, usar `recomendacion` para texto libre en nivel 4). Aviso ⚠️ unificado
  (franja sin confirmar, llegada antes de apertura, o margen al cierre <1h): solo 09/16/21-abr
  lo llevan, 12-abr Nikkō no. 12-abr y 20-abr: huecos locales sin tramo en TRANSPORT (v2.1
  congelado) cuentan como "desplazamiento sin definir" vía `GAPS_LOCALES_SIN_TRAMO` en
  `v3/index.html` (curado a mano, no un RouteItem — evita el problema de que `ordenarDia` manda
  TODOS los trayectos siempre arriba del día). Probado en el móvil real: OK (hueco de maletas,
  check-in de 19-abr después de Himeji, pendiente de maletas). Suite completa + gate 8c en
  verde, `git diff --stat -- index.html sw.js` vacío en todo el commit.
- `def3ecf` — fix de `tests/test-8c-gate.js` (desenvuelve el export nuevo de consola de Firebase, conteos refrescados a 476).
- `48c8319` — v3: el día empieza en el hotel de anoche y acaba en el de esta noche (bloques "Salida"/llegada, `ordenarDia` ya no manda el check-in sin hora al principio) + horas de check-in "estándar del hotel" investigadas para 7 reservas + fix CSS de Pendientes a 360px.
- `d2f4b6c` — hora real de check-in de Kyoto Guesthouse (16:00–19:00, de la propia reserva).
- `c1bb9b0` — **Bloque 3**: SPA unificada de v3 (menú 🇯🇵 + Pendientes + 21 días de Ruta reales, sustituye la maqueta estática).
- `45c8bb0` — **Bloque 2**: mapa solo vive dentro de la pantalla de un día, menú siempre por encima (z-index).
- `3abd3b8` — **Bloque 1**: fix de v2.1 (único cambio autorizado en `index.html` raíz — CARTO exigía API key, cambio a Esri).

**Fases completadas:** Fase 0 (freeze v2.1, `/v3/` placeholder) · Fase 1 (modelo de datos/timezone) · Fase 2 (importador + dedupe 3 niveles) · Fase 3 (Pendientes) · Fase 4 (Ruta: bases/trayectos/mapa/check-in real) — cerrada en `f6b3234` · Fase 5 (Reservas + Más) — cerrada en `7e8dca3` · Fase 5b (paridad de campos + ficha de detalle + filtro Reservas + auditoría de comidas) — cerrada en `2a3397f`/`387a4b6` · **Fase 6 (login + sync Firebase) — código en `a3dc65e`, DESPLEGADA y sembrada por el usuario el 2026-09-17 (reglas publicadas, 349 items, v2.1 sigue funcionando), pendiente confirmar la prueba con 2 dispositivos.**

**URLs:**
- GitHub Pages (producción, v2.1): `https://amenedorubn.github.io/japon/`
- v3 en Pages (mismo dominio, en construcción): `https://amenedorubn.github.io/japon/v3/`
- Repo: `https://github.com/amenedorubn/japon`

**Servidor local:**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1        # solo localhost:8734
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve-lan.ps1    # + accesible desde el móvil (misma Wi-Fi)
```
`serve-lan.ps1` escucha en `0.0.0.0:8734`. Si falla al arrancar, hace falta UNA VEZ como Administrador:
```powershell
netsh http add urlacl url=http://+:8734/ user=$env:USERDOMAIN\$env:USERNAME
New-NetFirewallRule -DisplayName 'Japon v3 dev server' -Direction Inbound -LocalPort 8734 -Protocol TCP -Action Allow -Profile Private
```
Imprime la IP de Wi-Fi al arrancar; desde el móvil: `http://<esa-ip>:8734/v3/index.html`.

**Antes de cualquier commit:** `node tests/run-all.js` en verde (obligatorio) + smoke HTTP (`.claude/serve.ps1`, verificar `index.html`/`sw.js`/PDF en 200). `node tests/run-all.js live.json` añade el gate 8c (necesita un volcado real, ver más abajo).

**Volcado real (`live.json`, nunca versionado):** desde Fase 12.75 el `curl` anónimo da 401. Se exporta A MANO desde la consola de Firebase (Realtime Database → nodo `proyectos/viaje-japon` → ⋮ → Export JSON) y se guarda como `live.json` en la raíz. Puede traer el árbol completo (`proyectos.viaje-japon` anidado) — `tools/v3-migrate-import.js` y `tests/test-8c-gate.js` ya aceptan las dos formas.

## 2. Reglas de colaboración vigentes (no negociables)

- **Push siempre pasando por el usuario.** Nunca empujar sin OK explícito en el chat, ni siquiera "para ir más rápido". Confirmar con el resumen del cambio antes de cada `git push`.
- **Nunca uses agentes/forks en background con permiso de escritura o push.** Si hace falta investigación paralela, que devuelvan solo texto; los cambios de código y el push los hace siempre el asistente principal en la conversación con el usuario.
- **Nunca añadas el trailer `Co-Authored-By` a ningún commit** (regla explícita del usuario, repetida varias veces esta sesión). Verificar el mensaje del commit antes de hacer push si hay dudas.
- **v2.1 (`index.html` y `sw.js` de la raíz del repo) es intocable salvo autorización explícita**, y aun así "cambio mínimo": el único tocado hasta ahora fue el Bloque 1 (URL de tiles del mapa, CARTO→Esri, porque CARTO empezó a exigir API key en producción). Verificar siempre con `git diff --stat -- index.html sw.js` que sigue vacío antes de cada commit de v3.
- **El repo es PÚBLICO (GitHub Pages).** Nunca versionar datos reales de la reserva/viaje: `live.json`, `import/v3-migrated-preview.json` e `import/v3-duplicates-report.json` están en `.gitignore` a propósito. `import/v3-manual-merges.json` SÍ se versiona (son solo decisiones de fusión, no datos privados).
- **`database.rules.json`**: cualquier cambio se muestra como diff y NO se despliega sin OK explícito. El diff de la Fase 6 (`viaje-japon-v3`, en `V3-DESIGN.md` §H) ya está publicado en Firebase desde el 2026-09-17 — si hiciera falta TOCARLO de nuevo (no solo repetirlo), sigue la misma regla: mostrar el diff nuevo y esperar OK antes de desplegar.
- **Tests + smoke HTTP obligatorios antes de cada commit** (ver arriba). Si algo toca plantillas/lógica compartida, actualizar los tests en el MISMO commit.
- Localstorage de v3 SIEMPRE con prefijo `jp27v3:` (nunca tocar `localStorage` directo fuera de `v3/lib/storage.js` — hay un test estático, `test-v3-storage-guard.js`, que lo vigila).
- No inventar horas, duraciones, tramos ni datos de reserva que no estén documentados: si falta el dato, se deja "sin hora"/"sin definir" explícitamente en vez de aproximar sin decirlo.
- **NUNCA repitas el bloque de siembra cruda de la Fase 6** (`fbDbM.set(..., '/state/items', datos.items)` a pelo, sobrescribiendo el array entero) contra un `proyectos/viaje-japon-v3` que ya tenga uso real (hecho/reservado marcado por los 3 viajeros). Esa siembra fue correcta la primera vez porque el nodo estaba vacío; repetirla después borraría de un plumazo todo lo que la gente haya marcado desde entonces, aunque `hechoOverrides`/`estadoOverrides` en sí no se toquen (quedarían huérfanos, apuntando a ids que ya no existen). Para cualquier actualización del catálogo después de la primera siembra, usa el camino seguro de abajo.

**Camino seguro para actualizar el catálogo tras la primera siembra** (reimportar desde un `live.json` nuevo sin perder hecho/notas/estadoManual/ítems-solo-v3):
1. Exporta el estado actual de v3 desde la consola del navegador (con sesión iniciada en v3, ver la variable `V3_PATH` ya cargada en la página):
   ```js
   const actual = {
     items: (await fbDbM.get(fbDbM.ref(fbDb, V3_PATH + '/state/items'))).val(),
     hechoOverrides: (await fbDbM.get(fbDbM.ref(fbDb, V3_PATH + '/state/hechoOverrides'))).val(),
     estadoOverrides: (await fbDbM.get(fbDbM.ref(fbDb, V3_PATH + '/state/estadoOverrides'))).val()
   };
   copy(JSON.stringify(actual)); // Chrome: lo deja en el portapapeles
   ```
   Pega el resultado en un fichero `v3-actual.json` en la raíz del repo (gitignored, nunca se comitea).
2. `node tools/v3-migrate-import.js live.json v3-actual.json` — fusiona (Decisión B, `v3/lib/merge.js`: el importador manda en lo derivado de v2, `v3-actual.json` manda en notas/hecho/estadoManual, nunca borra un ítem solo-en-v3) y **detecta overrides huérfanos** (una marca de hecho/reservado cuyo item ya no existiría) — nunca escribe en Firebase, solo `import/v3-migrated-preview.json`.
3. **Revisa antes de subir nada:** lee los contadores impresos (nuevos/actualizados/conservados-solo-en-v3) y, sobre todo, la lista de "Overrides que quedarían HUÉRFANOS" si la hay — si aparece alguno, decide a mano (¿el sitio cambió de id de verdad, o es un fallo del dedup que hay que corregir en `import/v3-manual-merges.json` primero?) antes de seguir.
4. Solo entonces, sube el resultado ya fusionado (nunca el import crudo) — y **solo `state/items`** (y `dias`/`guia` si de verdad cambiaron; nunca toques `hechoOverrides`/`estadoOverrides` en este paso, el merge ya los tuvo en cuenta):
   ```js
   const datos = await (await fetch('../import/v3-migrated-preview.json')).json();
   await fbDbM.set(fbDbM.ref(fbDb, V3_PATH + '/state/items'), datos.items);
   ```

## 3. Check-in real de los 9 días con cambio de hotel — CERRADO (commit `f6b3234`)

Las franjas reales (9 hoteles, 3 "sin confirmar 100%": Louis House, Kyoto Guesthouse, Twilight
Osaka) y la reordenación por llegada estimada real (bug: el bloque salía a la hora de APERTURA
de la franja, no de llegada) están implementadas, con tests en verde y probadas en el móvil real
(hueco de maletas 16-abr, check-in 19-abr después de Himeji). Detalle completo en el mensaje de
commit `f6b3234` y en §1 arriba. Los 3 casos abiertos que dejó la sesión anterior ya están
resueltos: 16-abr usa el bloque "Hueco + maletas" (no la opción B), el aviso ⚠️ es una regla
unificada (franja sin confirmar / llegada antes de apertura / margen al cierre <1h — Nikkō no lo
lleva), y los huecos locales (Nikkō→Kinugawa, Fukuoka) cuentan como "desplazamiento sin definir".

## 4. Tarea en curso: plan de la Fase 7 (pulido visual + oscuro + offline + PWA)

**Fase 6 CERRADA DEL TODO** (código, reglas, siembra, y la prueba con 2 dispositivos OK — ver
§1). Reversión si algo fallara más adelante: Firebase Console → Realtime Database → Reglas →
pestaña Historial → Restaurar la versión anterior; también hay una copia exacta de las reglas de
antes en el `reglas-publicadas.json` local del usuario (gitignored, no en el repo).

**Nota sin cerrar del todo:** el usuario reportó DOS VECES el mismo error de `v3/sw.js`
("chrome-extension"...) — la segunda vez, DESPUÉS de que el fix ya estuviera pusheado
(`0a785ff`). El código actual (ver el propio `v3/sw.js`) ya filtra correctamente ese caso
(verificado a mano con casos de prueba). Lo más probable es que la segunda vez viniera de un
service worker viejo todavía activo (no se actualizó solo, o el dispositivo de prueba no había
recargado tras el deploy) — pero si vuelve a pasar CON el commit `0a785ff` o posterior ya
desplegado y confirmado, es un bug real distinto que hay que investigar de cero, no dar por
resuelto a ciegas.

**Siguiente paso literal cuando retomes:** el plan de la Fase 7 en 5 líneas (visual vs. v2.1,
modo oscuro, offline completo, instalación PWA, estimación) ya se mandó — esperar el OK del
usuario punto por punto antes de tocar código. Si esta es una sesión nueva sin esa respuesta
visible, hay que regenerar el plan (no asumir que sigue vigente).

## 5. Pendiente después (backlog de fases, sin empezar)

- **Fase 7** — Pulido visual: modo oscuro real (hoy el mapa sale claro en dark mode, aceptado "por ahora" en el Bloque 1), soporte offline completo (cache strategy de `v3/sw.js` sigue en modo dev network-first, pensado para cuando v3 esté más maduro pasar a algo más parecido al cache-first de v2.1).
- **Fase 8** — Corte: el día que v3 sustituya a v2.1 como app principal (decisión del usuario, no automática). Incluye ya (añadido 2026-09-17, ver `V3-DESIGN.md`) sacar de los ficheros versionados de v2.1 raíz los precios de hoteles, bookingRef, direcciones, teléfonos y el enlace de Drive de confirmaciones, moviéndolos a Firebase — sin reescribir historial de git.

---
*Generado como traspaso de sesión — sin cuota para seguir en esta conversación. El siguiente chat debe leer este archivo primero.*
