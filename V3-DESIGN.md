# V3-DESIGN.md — Propuesta de diseño (Fase 0, sin implementar)

## Decisiones tomadas (2026-09-16, respuesta a §I)

1. **5 pestañas aprobadas.** La 5ª pasa a llamarse **"Más"** = Ideas (catálogo Exploración) +
   contenido editorial de Guía que no encajaba en ninguna otra pestaña.
2. **`estado` de 3 valores aprobado** (`confirmado`/`propuesta`/`idea`). `procedencia`
   (`ours`/`dani`/`maria`/`instagram`/`ai`) se mantiene como campo **secundario**, histórico e
   inmutable — nunca se trata como estado.
3. **`Intl` sin librería, también en los tests** (nada de dependencia dev-time para timezone).
4. **Una pasada más de verificación** (máx. 30 min, solo fuentes oficiales) sobre lo que quedó
   `horaConfirmada: false`. Lo que siga dudoso tras esa pasada: se queda en `horaConfirmada: false`
   y gana un **pendiente automático "vigilar apertura"** unos días antes de la fecha estimada (ver
   §C, nueva regla 7).
5. **Sin `/v2.1/` en el corte final.** El backup es el tag `v2.1` + rama `archive/v2.1`; no se sirve
   una copia viva de v2.1 en una subruta de Pages.
6. **Fase 1 arranca al cerrar el punto 4** (modelo de datos + zonas horarias, con tests).

Cambio adicional decidido en la misma respuesta: el prefijo de caché de `/v3/sw.js` pasa de
`japon27-v3-dev` a **`jp27v3-dev`** (no empieza por `japon27-`), para que el filtro de limpieza
del SW raíz de v2.1 no pueda alcanzarlo nunca, ni aunque el raíz se reactive algún día. Aplicado
solo en `v3/sw.js`, cero cambios en `sw.js` raíz.

> Documento de PROPUESTA. Nada de lo descrito aquí está implementado todavía (salvo el
> placeholder de `/v3/` y el nodo Firebase vacío `proyectos/viaje-japon-v3`, que no se ha escrito
> aún — se crea solo/a al primer `fb.set` de un futuro importador). Espera aprobación explícita,
> punto por punto, antes de tocar código de producto.
>
> Congelado antes de escribir esto: tag `v2.1` + rama `archive/v2.1` (push hecho), placeholder
> `/v3/` con su propio SW aislado (ver commit `20b2b6c`). v2.1 sigue intacta en la URL de Pages.

## 0. Nota sobre precedente: por qué este 5-tabs NO es el rechazado de 2026-07-19

PROJECT.md §8/§12 registra que la propuesta "IA de 5 pestañas Hoy/Plan/Ideas/Mapa/Guía" fue
**RECHAZADA** el 19-jul-2026 y no debe re-proponerse sin decisión del usuario. El reparto de
pestañas de este documento (**Pendientes · Ruta · Mapa · Reservas · Ideas**) es distinto en
número de pestañas iguales (2 de 5 coinciden de nombre: Mapa e Ideas, con alcance distinto) y en
intención — no es una reaparición silenciosa de aquella propuesta, es una decisión NUEVA que el
propio usuario está pidiendo en el encargo de esta sesión (Fase 0 de v3). Lo dejo escrito aquí
para que quede trazable en el historial de decisiones, no como objeción: es una pregunta que
respondes tú explícitamente en la lista de decisiones al final (§I).

---

## A. Las 5 pestañas

| Pestaña | Es la capa de PRODUCT.md | Contenido |
|---|---|---|
| **Pendientes** (inicio) | Vista derivada, cruza Confirmado + Planificación | Qué reservar/hacer AHORA, generado desde los datos de reserva. No se escribe a mano (ver §C). |
| **Ruta** | Planificación (una sola, ya no Realidad/Ruta/Dani/María separadas) | Itinerario agrupado por noche/hotel, no por "día 1..21" suelto. |
| **Mapa** | Transversal | Igual que hoy: pines por categoría, filtro por día/noche. |
| **Reservas** | Confirmado | Hoteles (9) + vuelos Finnair + cualquier otra reserva ya cerrada. Sustituye a la pestaña "Hoteles" de v2.1, ampliada a todo lo confirmado. |
| **Más** | Exploración + editorial | Catálogo antiguo María/Dani/Instagram/IA fuera de la ruta (antes "Ideas") + el contenido de Guía que no es accionable (consejos, referencias, lo que no encaja en Pendientes). |

*(Decisión 2026-09-16: la 5ª pestaña se llama "Más", no "Ideas" — mismo contenido de Exploración
más lo que sobra de Guía, ver Decisión 1 arriba.)*

Pestañas que desaparecen respecto a v2.1: **Itinerarios** (con sus 4 sub-vistas Realidad/Ruta/
Dani/María) se consolida en una sola **Ruta**; **Confirmado** y **Hoteles** se fusionan en
**Reservas**; **Guía** se reparte entre **Pendientes** (lo accionable) y **Más** (lo editorial).

---

## B. Modelo de datos (nodo nuevo `proyectos/viaje-japon-v3`, de solo escritura para v3)

Un único array de **elementos de ruta** (`ROUTE_ITEMS` en desarrollo, `state.items` en Firebase),
sustituye a `days` + `places` + `bookedHotels` + `FLIGHTS` como fuentes separadas. Cada elemento:

```js
{
  id: 'usj' | 'id_sunshine_kinugawa' | ...,   // reutiliza ids canónicos de v2 cuando existan
  tipo: 'lugar' | 'trayecto' | 'alojamiento' | 'vuelo',
  nombre: 'USJ + Nintendo World',

  // Eje de HISTORIA, igual que v2 (§12.13 de PROJECT.md): inmutable, nunca se reescribe.
  procedencia: 'ours' | 'dani' | 'maria' | 'instagram' | 'ai',

  // Eje de ESTADO — CAMBIA DE FORMA respecto a v2 (ver nota más abajo).
  estado: 'confirmado' | 'propuesta' | 'idea',

  noche: 'noche-2027-04-15' | null,   // agrupa Ruta por noche/hotel; null = sin asignar
  fechaHora: {                         // null si aún no tiene hora fija
    inicio: '2027-04-15T09:00',        // hora LOCAL de Japón, SIN offset (ver §D: nunca offset fijo)
    zona: 'Asia/Tokyo',
    fin: null
  },
  ubicacion: {lat: 36.56, lng: 137.19} | null,  // zona derivada en runtime, igual que v2 (nunca persistida)

  reserva: null | {
    necesaria: true,
    dondeReservar: 'https://www.usj.co.jp/web/en/us',
    abreEn: {fecha: '2027-01-23', hora: '10:00', zona: 'Asia/Tokyo'} | null,  // null = sin regla conocida
    reglaApertura: '1 mes antes a las 10:00 JST',
    horaConfirmada: true,               // false si la fuente no da hora exacta o hay contradicción
    fuente: 'https://www.usj.co.jp/...',
    verificadoEl: '2026-09-16',
    recomendacion: 'Reservar el mismo día que abre; el Express Pass vuela.',
    hecho: false                        // true = ya reservado, sale de Pendientes
  }
}
```

**Cambio de forma respecto a v2, APROBADO 2026-09-16 (Decisión 2):** v2 tiene DOS ejes
independientes — `provenance` (historia) y un estado binario `planificado`/`confirmado` (implícito:
"está en `state.days`" y `confirmed` explícito). v3 consolida ese binario en un **`estado` de tres
valores que mapea 1:1 con las tres capas de PRODUCT.md** (`confirmado` = Confirmado, `propuesta` =
Planificación tal y como hoy se vive en la Ruta/Realidad, `idea` = Exploración). `procedencia` se
mantiene como campo **secundario**, separado, histórico e inmutable — nunca se trata como estado;
no se toca el invariante §12.13.

Hoteles (9) y vuelos Finnair entran con `tipo: 'alojamiento'|'vuelo'` y `estado: 'confirmado'`
siempre, por encargo explícito de este documento.

---

## C. Pendientes: vista derivada, no editable a mano

`pendientesView(items, ahora)`:

1. Filtra `items` con `reserva && reserva.necesaria && !reserva.hecho`.
2. Para cada uno, si `reserva.abreEn` existe: calcula el instante JST real (ver §D) y lo muestra en
   **Europe/Madrid** y **Asia/Tokyo** simultáneamente, más cuenta atrás (`Intl.RelativeTimeFormat`
   o cálculo propio en ms).
3. Si `reserva.abreEn` es `null` (sin regla de apertura conocida, como el ryokan de Takayama o el
   templo ninja de Kanazawa en el `BOOKINGS` actual): va en un bloque separado **"Reservar ya, sin
   fecha de apertura"**, sin inventar una cuenta atrás.
4. Si `reserva.horaConfirmada === false`: badge ⚠️ "hora sin confirmar — revisar antes de la
   fecha", visible con icono, no solo color (regla F de accesibilidad).
5. Estado pendiente/hecho es el único campo editable a mano de este bloque (marcar "ya reservado" ⇒
   `reserva.hecho = true`); todo lo demás (fecha, texto, cuenta atrás) es 100% derivado.
6. Orden: primero lo que abre antes (cuenta atrás ascendente), luego "reservar ya sin fecha", luego
   lo ya hecho (colapsado, prueba de que hay progreso — regla 7 del modo ADHD: hacer visible el
   trabajo terminado).
7. **Regla nueva (Decisión 4, 2026-09-16) — "vigilar apertura".** Para una reserva con
   `horaConfirmada: false` pero con una estimación aproximada conocida (p.ej. "~2 meses antes", sin
   día/hora exacto verificable oficialmente): en vez de omitirla o inventar una fecha exacta,
   `pendientesView` genera un aviso **"👀 Vigilar apertura"** que aparece unos días antes de la
   fecha estimada (la propia estimación menos un margen, p.ej. 5–7 días, configurable por ítem vía
   `reserva.vigilarDesde`), con el texto literal de `reglaApertura` y el link a `fuente`/
   `dondeReservar` — nunca una cuenta atrás con hora, porque no hay hora que contar. Distinto
   visualmente del bloque con cuenta atrás exacta (§F, boceto 1): mismo icono de alerta que el
   badge ⚠️ de horaConfirmada=false, pero como su propia entrada, no un aviso pegado a una fecha
   falsa.

---

## D. Zonas horarias: prohibido offset fijo

Falla real que esto evita: Madrid cambia de hora el 28-mar-2027 (CET → CEST) y Japón NO tiene
horario de verano. Un offset fijo tipo `+9`/`+2` se rompe en cuanto la fecha de reserva cae al otro
lado del cambio de hora español.

**Mecanismo (sin dependencias de runtime, coherente con la política del proyecto §13):**
`Intl.DateTimeFormat(locale, {timeZone, ...}).formatToParts()` sobre un instante UTC conocido para
leer la hora de pared en cualquier zona IANA, y el truco inverso (formatear el mismo instante en
`'Asia/Tokyo'` y en la zona objetivo, comparar) para obtener el offset real de esa zona EN ESA
FECHA — nunca una tabla de offsets a mano. `Intl` con `timeZone` está soportado en todos los
navegadores objetivo del proyecto (sin polyfill).

**Tests obligatorios antes de implementar nada de UI** (`tests/test-v3-timezone.js`, mismo patrón
que el resto: funciones puras, sin DOM):

1. `10:00 JST del 2027-03-11` (antes del cambio de hora español) `=== 02:00 Europe/Madrid` (CET,
   UTC+1).
2. `10:00 JST del 2027-04-08` (después del cambio) `=== 03:00 Europe/Madrid` (CEST, UTC+2).
3. Frontera exacta: una regla de apertura que cae la madrugada del propio 2027-03-28 (el domingo
   del cambio, 01:00 UTC) — verificar que el lado JST (sin DST) y el lado Madrid usan cada uno su
   offset correcto sin desfase de una hora.
4. "1 mes antes a las 10:00 JST" de una fecha de viaje se calcula PRIMERO en calendario JST y
   DESPUÉS se convierte a Madrid — nunca al revés (restar 30 días en hora española daría un día
   distinto en Japón por el desfase horario).
5. Sanity check: un instante en JST puro (sin DST nunca) da SIEMPRE UTC+9 sin importar la fecha,
   para confirmar que el helper no está leyendo la zona horaria de la máquina que ejecuta el test.

Si algún test de estos falla con la implementación de `Intl` elegida, no se aproxima con un offset
fijo: se para y se avisa.

---

## E. Inventario de reservas anticipadas (Ruta v2, real, no inventado)

Ya verificado dentro del código (`BOOKINGS`, `TRANSPORT` de `index.html`, no re-verificado aquí):

| Reserva | Regla de apertura | Fuente | horaConfirmada |
|---|---|---|---|
| Shibuya Sky | Exactamente 14 días antes, medianoche JST | web oficial (ya verificada en el código) | true |
| Bus Nouhi (Kanazawa–Shirakawa-gō–Takayama) | ~1 mes antes | nouhibus.co.jp | false (el propio código dice "~", sin hora exacta) |
| Santuario Tōshōgū (Nikko) | Entrada online, con antelación, sin regla exacta documentada | — | false |
| Myōryū-ji "templo ninja" (Kanazawa) | Solo teléfono, sin web en inglés | — | false |
| teamLab Biovortex (Kioto) | Sin regla exacta, "se agota días antes" | — | false |
| USJ + Nintendo World | Sin regla documentada en el código actual | — | false |
| Bus Shinjuku↔Kawaguchiko | Sin regla documentada | highway-buses.jp | false |

**Verificado con fuente oficial el 2026-09-16** (investigación dedicada, sin inventar plazos):

| Reserva | Regla de apertura | Fuente | verificadoEl | horaConfirmada |
|---|---|---|---|---|
| Shinkansen Tōkaidō/Sanyō/Kyūshū (smartEX) — Nagoya→Kioto, Kioto→Himeji→Hiroshima→Hakata→Shin-Osaka, Shin-Osaka→Tokio (25-abr) | Desde las 10:00 JST de 1 mes antes (mismo día del mes), hasta 4 min antes de salida | [smart-ex.jp FAQ](https://smart-ex.jp/en/faq/category/detail/?id=459) | 2026-09-16 | **true** — ⚠️ contradicción descartada: un resultado de búsqueda decía "hasta 1 año antes"; la FAQ oficial lo desmiente, es 1 mes. No usar la cifra de 1 año. |
| Shinkansen JR East — **Yamabiko** (Utsunomiya→Ōmiya) | Regla estándar 1 mes antes hasta 23:40 JST de 3 días antes; DESDE el 31-oct-2025 admite además reserva anticipada a 3 meses vista (apertura ~14:00, zona no confirmada explícita en fuente) porque Yamabiko SÍ está en la lista de líneas con ese servicio nuevo | regla estándar: [JR East FAQ](https://www.jreast.co.jp/en/multi/faq/) · lista de líneas: [traicy.com](https://en.traicy.com/posts/2025092528252/) | 2026-09-16 | true para la regla y la inclusión de Yamabiko; **false** para la hora/zona exacta del servicio de 3 meses |
| Shinkansen JR East — **Kagayaki** (Ōmiya→Kanazawa) | Regla estándar únicamente: 1 mes antes, hasta 23:40 JST de 3 días antes. Kagayaki **NO** está en la lista de líneas con reserva a 3 meses (verificado explícitamente para no asumir que aplica) | mismas fuentes que arriba | 2026-09-16 | true |
| Tobu Limited Express (SPACIA/Revaty) Asakusa→Tōbu-Nikkō | Venta desde las 9:00 del mismo día del mes anterior (ej. viaje 12-abr → venta desde 12-mar); reserva sin comprar caduca a los 7 días | [tobu.co.jp — purchase info](https://www.tobu.co.jp/en/express_info/purchase/) | 2026-09-16 | true para la regla; **false** para la zona horaria exacta (la web no dice "JST" literal, se asume por ser hora local de Tobu) |
| USJ — entrada con fecha (USJ + Nintendo World) | Regla oficial vigente (post-Expo, aplica a abril 2027): venta "aproximadamente 2 meses antes" de la visita, sin hora exacta publicada | [usj.co.jp — anuncio oficial](https://www.usj.co.jp/company/company_e/news/2025/0421/) | 2026-09-16 | **false** — falta hora/zona exacta en la fuente oficial |
| USJ — Universal Express Pass | Ninguna fuente oficial publica un plazo fijo; fuentes de terceros dicen "~2 meses, normalmente a mitad del mes anterior" pero se contradicen en el día exacto | sin fuente oficial verificable | 2026-09-16 | **false** — no inventar cifra, mostrar como "vigilar la web ~2 meses antes" |
| Super Nintendo World / Mario Kart — timed entry | Desde el 5-ene-2026 exige "Area Timed Entry Ticket" (Advance Booking de pago, o Standby/Timed Entry gratis el mismo día por app), independiente de la entrada general; SIN regla de antelación fija — depende de disponibilidad diaria | [usj.co.jp — Super Nintendo World](https://www.usj.co.jp/web/en/us/areas/super-nintendo-world) | 2026-09-16 | **false** |
| Check-in online Finnair (Helsinki–Haneda/Narita) | Abre 36 horas antes de la salida (la ventana de 24h es solo para vuelos hacia/desde EE.UU., no aplica aquí) | [finnair.com — check-in](https://www.finnair.com/en/check-in-for-finnair-flights) | 2026-09-16 | **true** |

Con esto, de las reglas nuevas investigadas, solo **Tōkaidō/Sanyō smartEX**, **Kagayaki (regla
estándar)** y **check-in Finnair** tienen `horaConfirmada: true` de extremo a extremo (regla + hora
+ zona). El resto entra en Pendientes con el badge ⚠️ de §C punto 4, nunca con una cuenta atrás
inventada.

---

## F. UX: bocetos (texto, sin visual todavía)

Principios ya fijados en PRODUCT.md que este diseño hereda sin negociarlos: móvil primero (~390px,
una mano), acento único rojo torii, iconografía emoji deliberada, denso pero calmado, modo oscuro,
offline. Referencias del encargo: TripIt (línea de tiempo de reservas confirmadas) para
**Pendientes**, Wanderlog (planificación sobre mapa) para **Ruta**+**Mapa**.

### Boceto 1 — Pendientes (pantalla de inicio)

```
┌─────────────────────────────┐
│  Japón 2027          👥 🌙  │
│  ─────────────────────────  │
│  ⏳ Próximo a abrir          │
│                              │
│  🎫 USJ + Nintendo World     │
│     abre en 4 días           │
│     23 ene · 10:00 JST       │
│     23 ene · 02:00 Madrid    │
│     [Marcar como reservado]  │
│  ──────────────────────────  │
│  🚄 Shinkansen Nagoya→Kioto  │
│     abre en 11 días          │
│     ⚠️ hora sin confirmar    │
│  ──────────────────────────  │
│  📌 Reservar YA (sin fecha)  │
│  • Ryokan Takayama            │
│  • Templo ninja (tel.)        │
│  ──────────────────────────  │
│  ✅ Ya reservado (7)  ˅      │
└─────────────────────────────┘
```
2 toques al objetivo principal: abrir la app → tocar "Marcar como reservado". Nada intermedio.

### Boceto 2 — Ruta, un día dentro de una noche/hotel

```
┌─────────────────────────────┐
│  ← Noche 5 · Kuwataniya      │  <- agrupación por noche/hotel, no "Día 8"
│     15–16 abr · Takayama     │
│  ─────────────────────────  │
│  🟡 intensidad media         │
│                              │
│  09:00 Mercado matutino      │
│  11:30 Casco antiguo         │
│  🚌 14:50 Bus a Takayama 🎫  │  <- icono de reserva inline, no aparte
│  18:00 Check-in Kuwataniya   │
│  20:00 Cena en el casco      │
│                              │
│  🎁 2 extras si sobra tiempo │
│  ─────────────────────────  │
│  [Mapa de este día]          │
└─────────────────────────────┘
```

### Boceto 3 — Detalle de un sitio

```
┌─────────────────────────────┐
│  ← USJ + Nintendo World      │
│  🧭 Idea · IA                │  <- procedencia, separada del estado
│  📍 Osaka                    │
│  ─────────────────────────  │
│  [mapa mini]                 │
│                              │
│  🎫 Reserva necesaria        │
│  Abre: 23 ene · 10:00 JST    │
│        23 ene · 02:00 Madrid │
│  Recomendación: el mismo     │
│  día que abre                │
│  [Ir a reservar ↗]           │
│  ─────────────────────────  │
│  💰 ¥8.600 entrada           │
│  ℹ️ Notas...                 │
└─────────────────────────────┘
```

Estado con icono+texto siempre (nunca solo color, ya es requisito explícito): 🧭 Idea, 📝 Propuesta,
✅ Confirmado como badges de texto, no solo un borde de color.

---

## G. Migración y corte final

**Migración (mientras v2.1 sigue siendo LA app):**
1. Importador de solo lectura `tools/v3-migrate-import.js`: lee `proyectos/viaje-japon` (nunca
   escribe ahí), transforma `state.places` + `bookedHotels` + `FLIGHTS` + `BOOKINGS` al esquema de
   §B, escribe en `proyectos/viaje-japon-v3` (nodo nuevo, vacío hasta este primer `fb.set`).
2. Ids canónicos se preservan literalmente (mismo invariante que v2, §12.2 de PROJECT.md): un
   `id_sunshine_kinugawa` sigue siendo el mismo string en v3.
3. Migración repetible e idempotente (como `foldCurated` en v2): correrla dos veces da el mismo
   resultado, nunca duplica.
4. `/v3/` se desarrolla y se prueba en su propia URL (`https://amenedorubn.github.io/japon/v3/`)
   todo el tiempo que haga falta, sin tocar la experiencia real de los tres viajeros.

**Corte final (cuando v3 tenga paridad + tu aprobación explícita, no antes):**
1. `git mv v3/index.html index.html` + `git mv v3/sw.js sw.js` (o build equivalente) en un commit
   dedicado, DESPUÉS de mover el `index.html`/`sw.js` de v2.1 a una carpeta de backup servible,
   p.ej. `/v2.1/` (decisión pendiente en §I: ¿backup vivo en una subruta de Pages, o basta con el
   tag+rama `archive/v2.1` que ya no sirve HTML en vivo?).
2. Reglas RTDB: el nodo v3 pasa a ser el nodo principal solo cuando el punto 1 ya está desplegado;
   hasta entonces las reglas de v2 (`proyectos/viaje-japon`) no cambian en absoluto.
3. Ventana de gracia: mantener `/v3/` como alias funcionando un tiempo por si hace falta volver
   atrás sin re-desplegar.

---

## H. Fases de implementación (estimación en tiempo de trabajo, no calendario)

0. **Fase 0 — Congelar + placeholder + este documento.** HECHO hoy (2026-09-16).
1. **Modelo de datos + helpers de zona horaria + sus tests.** Sin UI. ~1 día.
2. **Importador de migración v2→v3** (solo lectura de v2.1) + inventario E completo con fuentes
   verificadas. ~1–2 días (depende de cuántas fuentes oficiales den problemas de idioma/contradicción).
3. **UI Pendientes** (el mayor valor nuevo, y la más simple: solo lee, no edita apenas). ~2–3 días.
4. **UI Ruta** (agrupada por noche/hotel) **+ Mapa**. ~3–4 días, la pieza más grande.
5. **UI Reservas + Ideas.** ~2 días.
6. **Auth**: reutilizar el patrón Google Sign-In + aprobación de admin de v2.1 (§16 de PROJECT.md),
   nodo `access` propio de v3, reglas RTDB aditivas (diff a tu aprobación antes de desplegar). ~1 día.
7. **Modo oscuro real + offline (SW de producción, no el de desarrollo actual) + pulido visual**
   con las Skills de diseño del proyecto. ~2–3 días.
8. **Gate de paridad con datos reales + pruebas de los 3 móviles + corte final.** ~1–2 días.

Total aproximado: 2–3 semanas de trabajo efectivo, sin contar el tiempo de tu revisión entre fases
(cada fase termina en su propio commit y espera luz verde, igual que en v2).

---

## I. Decisiones — CERRADAS (2026-09-16, ver arriba)

Las 6 preguntas de esta sección quedaron respondidas en el bloque "Decisiones tomadas" al inicio
del documento. Se deja el historial de las preguntas originales por trazabilidad:

1. ~~¿Apruebas el reparto de 5 pestañas de §A tal cual, o cambias algo?~~ → Aprobado, 5ª = "Más".
2. ~~¿Colapsar `provenance` + estado binario en `estado` de tres valores, o mantener los dos ejes?~~
   → Colapsado, `procedencia` queda como campo secundario.
3. ~~¿`Intl` sin librería, o dependencia dev-time para tests?~~ → `Intl` sin librería, en todo.
4. ~~¿Esperar la verificación completa del inventario, o cerrar el documento ya?~~ → Una pasada más
   acotada (máx. 30 min, solo fuentes oficiales), con regla "vigilar apertura" para lo que siga
   dudoso (§C.7).
5. ~~¿Backup vivo de v2.1 en `/v2.1/`?~~ → No, basta tag + rama `archive/v2.1`.
6. ~~¿Arrancar Fase 1 ya?~~ → Sí, en cuanto cierre el punto 4.
