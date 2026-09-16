# HANDOFF v3 — Japón 2027

Traspaso de sesión (poca cuota restante, se abre chat nuevo). Léelo entero antes de tocar nada.

## 1. Estado actual

**Último commit:** `def3ecf` — "tests: 8c-gate desenvuelve el export nuevo de consola y refresca conteos" (pusheado a `origin/main`).

Historial reciente relevante (más nuevo primero):
- `def3ecf` — fix de `tests/test-8c-gate.js` (desenvuelve el export nuevo de consola de Firebase, conteos refrescados a 476).
- `48c8319` — v3: el día empieza en el hotel de anoche y acaba en el de esta noche (bloques "Salida"/llegada, `ordenarDia` ya no manda el check-in sin hora al principio) + horas de check-in "estándar del hotel" investigadas para 7 reservas + fix CSS de Pendientes a 360px.
- `d2f4b6c` — hora real de check-in de Kyoto Guesthouse (16:00–19:00, de la propia reserva).
- `c1bb9b0` — **Bloque 3**: SPA unificada de v3 (menú 🇯🇵 + Pendientes + 21 días de Ruta reales, sustituye la maqueta estática).
- `45c8bb0` — **Bloque 2**: mapa solo vive dentro de la pantalla de un día, menú siempre por encima (z-index).
- `3abd3b8` — **Bloque 1**: fix de v2.1 (único cambio autorizado en `index.html` raíz — CARTO exigía API key, cambio a Esri).

**Fases completadas:** Fase 0 (freeze v2.1, `/v3/` placeholder) · Fase 1 (modelo de datos/timezone) · Fase 2 (importador + dedupe 3 niveles) · Fase 3 (Pendientes) · Fase 4 (Ruta: bases/trayectos/mapa) · Bloques 1-2-3 de la ronda de bugfixing post-móvil.

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

## 3. Tarea en curso: horas de check-in reales de los 9 días con cambio de hotel

El usuario dio las franjas de check-in REALES de la reserva (sustituyen a las "estándar del hotel" que se habían buscado por web en el commit `48c8319`):

- Louis House Otsuka Nishi (Tokio 1): 15:00–00:00 (sin confirmar 100%)
- Sunshine Kinugawa (Nikkō): 15:00–18:00
- INOVA Kanazawa: 15:00–21:00
- Kuwataniya (Takayama): 14:00–22:00
- Kyoto Guesthouse: 16:00–19:00 (sin confirmar 100%)
- Vessel Hotel Hiroshima: 14:00–23:00
- Hakata Nakasu Inn (Fukuoka): 15:00–00:00
- Twilight Osaka Inn: 15:00–00:00 (sin confirmar 100%)
- APA Asakusabashi (Tokio 2): 15:00–00:00

Van guardadas como franja de ESTA reserva (no "estándar del hotel"). Las 3 marcadas "sin confirmar 100%" llevan aviso ⚠️ "franja por confirmar".

Además se detectó un **bug de lógica**: el bloque de check-in se colocaba a la hora de APERTURA de la franja, no a la hora real de llegada al hotel (ej.: 19-abr aparecía a las 14:00, antes del Castillo de Himeji, que está de camino desde Kioto; 25-abr a las 15:00 en pleno Kamakura). Reglas acordadas para el fix (**todavía sin implementar**):

1. El bloque hotel va cuando realmente se llega: tras la última actividad FUERA de la ciudad del hotel y tras el trayecto de llegada.
2. El hotel NO siempre va al final: si el día sigue con actividades en la misma ciudad (ej. 9-abr: aeropuerto → hotel → resto; o llegar, dejar maletas y salir a cenar), el bloque va en medio y el día termina volviendo al hotel.
3. Si la llegada es antes de la apertura de la franja: bloque "Dejar maletas" + nota "check-in desde X".
4. Aviso ⚠️ si la llegada estimada es DESPUÉS del cierre de la franja (Nikkō 18:00 y Kioto 19:00 son las más ajustadas, según el propio usuario).
5. Mapa: sigue el orden real (salida → … → hotel → … → hotel si se vuelve).

Se preparó (y se pegó al usuario, **pendiente de su OK, NO IMPLEMENTAR SIN CONFIRMAR**) esta tabla con el orden propuesto para los 9 días:

| Fecha | Hotel | Orden propuesto del día | Llegada estimada al hotel | Franja (nuestra reserva) | ⚠️ |
|---|---|---|---|---|---|
| 09-abr | Louis House Otsuka Nishi | Narita → **🏨** → Sensō-ji → Nakamise → P. Sumida → Skytree → Hoppy St. | ~16:00 (Narita→Ōtsuka, ~90 min) | 15:00–00:00 ⚠️ franja por confirmar | — |
| 12-abr | Sunshine Kinugawa | Tōshōgū → Futarasan → Rinnō-ji → Kanmangafuchi → **🏨** (fin del día) | ~15:45–16:00 | 15:00–18:00 | Justo, no tarde — margen ~2h |
| 13-abr | INOVA Kanazawa | Mercado Ōmichō → Castillo Kanazawa → **🏨** → Kenroku-en → Higashi Chaya | ~15:25 | 15:00–21:00 | — |
| 15-abr | Minshuku Kuwataniya | Shirakawa-go → Puente Ogimachi → trayecto→Takayama → **🏨** → Casco antiguo → P. Nakabashi | ~14:50–15:00 (llegada del tren) | 14:00–22:00 | — |
| 16-abr | Kyoto Guesthouse | Miyagawa (Takayama) → trayecto→Kioto (llega 14:20) → *(hueco 14:20–16:00)* → **🏨** → Gion → Yasaka → Pontochō | ~16:00 | 16:00–19:00 ⚠️ franja por confirmar | Llega ANTES de apertura (14:20) — ver caso abierto abajo |
| 19-abr | Vessel Hotel Hiroshima | Fushimi Inari → Uji → trayecto→Himeji → Castillo Himeji → trayecto→Hiroshima → **🏨** → Okonomimura | ~18:30 | 14:00–23:00 | — |
| 20-abr | Hakata Nakasu Inn | Parque Paz → Miyajima/Itsukushima → Daishō-in → trayecto→Hakata → **🏨** → Yatai de Nakasu | ~19:00 | 15:00–00:00 | — |
| 21-abr | Twilight Osaka Inn | Santuario Kushida → Ōhori/castillo → trayecto→Osaka → **🏨** → Dōtonbori → Hozen-ji | ~18:20 | 15:00–00:00 ⚠️ franja por confirmar | — |
| 25-abr | APA Asakusabashi | Tokio Est. → Kamakura (4 paradas) → B. Chino Yokohama → Minato Mirai → **🏨** (fin del día) | ~21:00 | 15:00–00:00 | — |

**Casos abiertos, sin decidir todavía (esperando respuesta del usuario):**

1. **16-abr (Kioto):** llegan a las 14:20, el check-in no abre hasta las 16:00 — hueco de 1h40 sin actividad. ¿Se aplica la regla 3 ("Dejar maletas" + nota) o el bloque de check-in simplemente aparece a las 16:00 sin más (maletas en consigna de la estación, sin bloque aparte)?
2. **12-abr (Nikkō) y 16-abr (Kioto)** son los dos días "ajustados" que señaló el usuario. Con las estimaciones de la tabla ninguno llega tarde, pero el margen es corto — ¿llevan ⚠️ igualmente como aviso preventivo aunque no incumplan la franja, o solo aviso si de verdad se pasa de hora?
3. El salto **Nikko → Kinugawa Onsen** (12-abr) y **Fukuoka morning → Fukuoka centro** (20-abr, parada genérica "Fukuoka") no tienen un `trayecto` propio en los datos de v2 — son huecos locales sin tramo formal horneado. ¿Se dejan implícitos (como ahora) o se marcan de algún modo en la UI?

Todas las horas estimadas de llegada son cálculos del asistente (no vienen de la reserva ni de `RUTA_DAYS`) — el usuario tiene que confirmar que no chocan con lo que sabe del itinerario real antes de implementar nada.

**Siguiente paso literal cuando retomes:** esperar el OK del usuario sobre la tabla y los 3 casos abiertos, y SOLO ENTONCES tocar código (`v3/lib/bases.js` para el reordenamiento real por ciudad-del-hotel-vs-actividad, y `v3/index.html` para el bloque "Dejar maletas" si aplica). No se ha escrito ni una línea de este fix todavía.

## 4. Pendiente después (backlog de fases, sin empezar)

- **Fase 5** — Reservas y Más (hoy son placeholders "próximamente" en el menú de `v3/index.html`).
- **Fase 6** — Auth (Google Sign-In + aprobación, como en v2.1) y aplicar el diff de `database.rules.json` ya documentado-pero-no-desplegado en `V3-DESIGN.md` (recordar: mostrar diff y pedir OK antes de tocar la consola de Firebase).
- **Fase 7** — Pulido visual: modo oscuro real (hoy el mapa sale claro en dark mode, aceptado "por ahora" en el Bloque 1), soporte offline completo (cache strategy de `v3/sw.js` sigue en modo dev network-first, pensado para cuando v3 esté más maduro pasar a algo más parecido al cache-first de v2.1).
- **Fase 8** — Corte: el día que v3 sustituya a v2.1 como app principal (decisión del usuario, no automática).

---
*Generado como traspaso de sesión — sin cuota para seguir en esta conversación. El siguiente chat debe leer este archivo primero.*
