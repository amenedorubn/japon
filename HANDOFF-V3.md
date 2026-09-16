# HANDOFF v3 — Japón 2027

Traspaso de sesión (poca cuota restante, se abre chat nuevo). Léelo entero antes de tocar nada.

## 1. Estado actual

**Último commit:** `f6b3234` — "v3: check-in real (franja + llegada estimada) reordena el dia en su sitio" (pusheado a `origin/main`).

Historial reciente relevante (más nuevo primero):
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

**Fases completadas:** Fase 0 (freeze v2.1, `/v3/` placeholder) · Fase 1 (modelo de datos/timezone) · Fase 2 (importador + dedupe 3 niveles) · Fase 3 (Pendientes) · Fase 4 (Ruta: bases/trayectos/mapa/check-in real, incluida la ronda de bugfixing post-móvil) — **cerrada del todo en `f6b3234`**.

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
- **`database.rules.json`**: cualquier cambio se muestra como diff y NO se despliega sin OK explícito (hay uno documentado-pero-no-aplicado en `V3-DESIGN.md` para la futura Fase 6).
- **Tests + smoke HTTP obligatorios antes de cada commit** (ver arriba). Si algo toca plantillas/lógica compartida, actualizar los tests en el MISMO commit.
- Localstorage de v3 SIEMPRE con prefijo `jp27v3:` (nunca tocar `localStorage` directo fuera de `v3/lib/storage.js` — hay un test estático, `test-v3-storage-guard.js`, que lo vigila).
- No inventar horas, duraciones, tramos ni datos de reserva que no estén documentados: si falta el dato, se deja "sin hora"/"sin definir" explícitamente en vez de aproximar sin decirlo.

## 3. Check-in real de los 9 días con cambio de hotel — CERRADO (commit `f6b3234`)

Las franjas reales (9 hoteles, 3 "sin confirmar 100%": Louis House, Kyoto Guesthouse, Twilight
Osaka) y la reordenación por llegada estimada real (bug: el bloque salía a la hora de APERTURA
de la franja, no de llegada) están implementadas, con tests en verde y probadas en el móvil real
(hueco de maletas 16-abr, check-in 19-abr después de Himeji). Detalle completo en el mensaje de
commit `f6b3234` y en §1 arriba. Los 3 casos abiertos que dejó la sesión anterior ya están
resueltos: 16-abr usa el bloque "Hueco + maletas" (no la opción B), el aviso ⚠️ es una regla
unificada (franja sin confirmar / llegada antes de apertura / margen al cierre <1h — Nikkō no lo
lleva), y los huecos locales (Nikkō→Kinugawa, Fukuoka) cuentan como "desplazamiento sin definir".

## 4. Tarea en curso: Fase 5 — Reservas y Más

**Estado: en fase de PLAN, esperando el OK del usuario — no se ha tocado código todavía.**

El usuario pidió un resumen en 5 líneas antes de escribir nada:
1. Qué muestra Reservas (hoteles/vuelos/trenes/entradas, confirmado vs. pendiente, enlace a
   confirmación — recordar: el repo es público, ningún enlace/dato privado en archivos
   versionados, ver PROJECT.md y la nota de v2.1 sobre `confirmUrl`).
2. Qué muestra Más (las 205 `idea`, filtros, y si "pasar una idea a la Ruta" entra ya o se deja
   para después).
3. Qué contenido de la Guía de v2.1 migra a Más.
4. Qué es editable ya en local (`jp27v3:`) frente a lo que espera a la Fase 6 (Auth + Firebase).
5. Estimación de tiempo.

**Siguiente paso literal cuando retomes:** si el plan de 5 líneas ya se mandó en esta sesión y
sigue sin respuesta, esperar el OK del usuario punto por punto antes de tocar `v3/index.html`.
Si esta es una sesión nueva y el plan no está en el historial visible, hay que rehacerlo (no
asumir que sigue vigente sin releer la respuesta del usuario).

## 5. Pendiente después (backlog de fases, sin empezar)

- **Fase 6** — Auth (Google Sign-In + aprobación, como en v2.1) y aplicar el diff de `database.rules.json` ya documentado-pero-no-desplegado en `V3-DESIGN.md` (recordar: mostrar diff y pedir OK antes de tocar la consola de Firebase).
- **Fase 7** — Pulido visual: modo oscuro real (hoy el mapa sale claro en dark mode, aceptado "por ahora" en el Bloque 1), soporte offline completo (cache strategy de `v3/sw.js` sigue en modo dev network-first, pensado para cuando v3 esté más maduro pasar a algo más parecido al cache-first de v2.1).
- **Fase 8** — Corte: el día que v3 sustituya a v2.1 como app principal (decisión del usuario, no automática).

---
*Generado como traspaso de sesión — sin cuota para seguir en esta conversación. El siguiente chat debe leer este archivo primero.*
