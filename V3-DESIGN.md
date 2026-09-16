# V3-DESIGN.md — Propuesta de diseño (Fase 0, sin implementar)

## Decisiones tomadas (2026-09-16, respuesta a §I)

1. **5 pestañas aprobadas.** La 5ª pasa a llamarse **"Más"** = Ideas (catálogo Exploración) +
   contenido editorial de Guía que no encajaba en ninguna otra pestaña.
2. **`estado` de 3 valores aprobado** (`confirmado`/`propuesta`/`idea`). `procedencia`
   (`ours`/`dani`/`maria`/`instagram`/`ai`) se mantiene como campo **secundario**, histórico e
   inmutable — nunca se trata como estado.
3. **`Intl` sin librería, también en los tests** (nada de dependencia dev-time para timezone).
4. **Segunda pasada de verificación HECHA** (máx. 30 min, solo fuentes oficiales, ver §E). Corrigió
   un dato erróneo (USJ era "3 meses", no "2") y confirmó reglas de día exacto para Nouhi/Tobu/JR
   East 3 meses/USJ+Express Pass (faltaba solo la hora, ya no la regla). Lo que siguió sin ninguna
   fecha verificable (Tōshōgū, teamLab): queda en `horaConfirmada: false` con el aviso automático
   **"vigilar apertura"** (§C regla 7).
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

  notas: null | 'texto libre que escribe un usuario',  // editable a mano, el importador nunca lo pisa
  estadoManual: false,  // true si un usuario cambió `estado` a mano (§G: el importador ya no lo toca)

  // Decisión C (2026-09-16): `reserva` (singular) se generaliza a `acciones[]`.
  // Un mismo ítem puede tener MÁS de una acción pendiente sin ser dos ítems
  // (p.ej. un vuelo con su propio check-in). Cada acción lleva un `id` propio
  // y estable ('reserva', 'checkin'...) para poder marcarla como hecha sin
  // ambigüedad y para que la fusión del importador (§G) empareje por id, no
  // por posición.
  acciones: [
    {
      id: 'reserva',                        // o 'checkin', o el que corresponda
      necesaria: true,
      dondeReservar: 'https://www.usj.co.jp/web/en/us',
      abreEn: {fecha: '2027-01-23', hora: '10:00', zona: 'Asia/Tokyo'} | null,  // null = sin regla conocida
      reglaApertura: '1 mes antes a las 10:00 JST',
      horaConfirmada: true,               // false si la fuente no da hora exacta o hay contradicción
      fuente: 'https://www.usj.co.jp/...',
      verificadoEl: '2026-09-16',
      recomendacion: 'Reservar el mismo día que abre; el Express Pass vuela.',
      hecho: false                        // true = ya reservado/hecho, sale de Pendientes
    }
  ]
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
siempre, por encargo explícito de este documento. El check-in de un vuelo NO es un ítem aparte ni un
campo suelto (Decisión C, 2026-09-16): es una `acción` más dentro del propio ítem `vuelo` — ver §E
para la regla real de Finnair (36h antes, por billete/reserva, no por tramo) y §G para cómo se
reparte entre los 4 tramos de FLIGHTS.

**Precedencia única por id (Decisión A, 2026-09-16):** un mismo sitio nunca genera dos `RouteItem`.
Si aparece en más de una fuente, gana la más avanzada: `confirmado` (hoteles/vuelos) > `propuesta`
(está en `RUTA_DAYS`, con `noche`/`fechaHora` de ahí) > `idea` (resto del catálogo, incluida
procedencia `'ours'` de `Itinerario.docx` que no llegó a la Ruta — es una lista de deseos, no todo
entra). `procedencia` viaja aparte y nunca se pisa, esté el ítem en el estado que esté.

---

## C. Pendientes: vista derivada, no editable a mano

`pendientesView(items, ahora)`:

1. Hace `flatMap` de `item.acciones` de TODOS los ítems (Decisión C, 2026-09-16: ya no es un
   `reserva` singular por ítem) y filtra las que tienen `necesaria && !hecho`. Un ítem con dos
   acciones pendientes (p.ej. un vuelo con check-in y equipaje) aparece **dos veces**, nunca
   fusionado; cada entrada de salida referencia `{itemId, accionId}` para poder marcar esa acción
   concreta como hecha sin ambigüedad.
2. Cuatro niveles de precisión, de más a menos exacto (§E ya tiene ejemplos reales de cada uno):
   1. **Día + hora + zona confirmados** (`abreEn.fecha` + `abreEn.hora` + `abreEn.zona`, todo
      `horaConfirmada: true` — ej. smartEX, Kagayaki, check-in Finnair): cuenta atrás exacta al
      minuto (`Intl.RelativeTimeFormat` o cálculo propio en ms), en Europe/Madrid y Asia/Tokyo
      simultáneas (ver §D).
   2. **Día exacto confirmado, hora/zona sin confirmar** (`abreEn.fecha` existe, `abreEn.hora` o
      `abreEn.zona` es `null`, `horaConfirmada: false` — ej. Nouhi, Tobu, JR East 3 meses, USJ +
      Express Pass): cuenta atrás **al día** (sin hora), con badge ⚠️ "hora exacta sin confirmar —
      revisa esa mañana", icono+texto, nunca solo color.
   3. **Sin fecha exacta pero con ventana de venta que se sabe que existirá** (ninguna fuente da
      un día/mes concreto, pero el ítem SÍ se vende con antelación tarde o temprano — ej. Tōshōgū,
      teamLab): aviso **"👀 Vigilar apertura"** (regla 7, más abajo) en vez de cuenta atrás o "reservar ya".
   4. **Sin ventana de venta programada, disponibilidad simplemente decreciente** (ryokan de
      Takayama, templo ninja por teléfono): bloque separado **"📌 Reservar ya, sin fecha de
      apertura"**, sin cuenta atrás ni aviso de vigilancia — aquí antes vale más que después, no hay
      "apertura" que esperar.
3. (fusionado con el nivel 4 anterior.)
4. El badge ⚠️ de horaConfirmada=false (nivel 2) es siempre icono+texto, nunca solo color (regla F
   de accesibilidad).
5. Estado pendiente/hecho es el único campo editable a mano de este bloque (marcar "ya reservado" ⇒
   esa `accion.hecho = true`, emparejada por `accion.id`); todo lo demás (fecha, texto, cuenta
   atrás) es 100% derivado.
6. Orden: nivel 1 y 2 juntos por cuenta atrás ascendente, luego nivel 3 ("vigilar"), luego nivel 4
   ("reservar ya"), luego lo ya hecho (colapsado, prueba de que hay progreso — regla 7 del modo
   ADHD: hacer visible el trabajo terminado).
7. **Regla "vigilar apertura" (Decisión 4, 2026-09-16), nivel 3 de arriba.** Para una acción SIN
   día/mes exacto verificable oficialmente pero que sí tendrá una ventana de venta (Tōshōgū,
   teamLab): `pendientesView` genera el aviso **"👀 Vigilar apertura"** que aparece unos días antes
   de una fecha estimada a mano si la hay (`accion.vigilarDesde`, opcional, nunca inventada sin que
   alguien la ponga a mano tras investigar más), con el texto literal de `reglaApertura` y el link a
   `fuente`/`dondeReservar` — nunca una cuenta atrás con hora, porque no hay ni día que contar. Si
   no hay `vigilarDesde`, el aviso aparece siempre, sin cuenta atrás de ningún tipo.

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

**Primera pasada, verificada el 2026-09-16** (investigación dedicada, sin inventar plazos):

| Reserva | Regla de apertura | Fuente | verificadoEl | horaConfirmada |
|---|---|---|---|---|
| Shinkansen Tōkaidō/Sanyō/Kyūshū (smartEX) — Nagoya→Kioto, Kioto→Himeji→Hiroshima→Hakata→Shin-Osaka, Shin-Osaka→Tokio (25-abr) | Desde las 10:00 JST de 1 mes antes (mismo día del mes), hasta 4 min antes de salida | [smart-ex.jp FAQ](https://smart-ex.jp/en/faq/category/detail/?id=459) | 2026-09-16 | **true** — ⚠️ contradicción descartada: un resultado de búsqueda decía "hasta 1 año antes"; la FAQ oficial lo desmiente, es 1 mes. No usar la cifra de 1 año. |
| Shinkansen JR East — **Kagayaki** (Ōmiya→Kanazawa) | Regla estándar únicamente: 1 mes antes, hasta 23:40 JST de 3 días antes. Kagayaki **NO** está en la lista de líneas con reserva a 3 meses (verificado explícitamente para no asumir que aplica) | [JR East FAQ](https://www.jreast.co.jp/en/multi/faq/) + [lista de líneas](https://en.traicy.com/posts/2025092528252/) | 2026-09-16 | **true** |
| Check-in online Finnair (Helsinki–Haneda/Narita) | Abre 36 horas antes de la salida (la ventana de 24h es solo para vuelos hacia/desde EE.UU., no aplica aquí) | [finnair.com — check-in](https://www.finnair.com/en/check-in-for-finnair-flights) | 2026-09-16 | **true** |

**Segunda pasada (Decisión 4, máx. 30 min, solo fuentes oficiales), 2026-09-16.** Corrige un dato
de la primera pasada — **la cifra de USJ era incorrecta (2 meses → en realidad 3)** — y confirma
reglas de día exacto que antes eran solo aproximaciones del propio código, aunque siga faltando la
hora/zona en varias:

| Reserva | Regla de apertura | Fuente | verificadoEl | horaConfirmada |
|---|---|---|---|---|
| Shinkansen JR East — servicio de reserva a 3 meses (**Yamabiko** sí, **Kagayaki** no) | Desde 31-oct-2025, apertura confirmada a las **14:00** del día correspondiente (dato oficial, no de blog); zona horaria SIGUE sin decirse explícita en ningún texto oficial hallado (asumible JST, no confirmado) | anuncio oficial JR East/eki-net (sep-2025); páginas jreast.co.jp/eki-net.com devuelven 403 a fetch directo, dato tomado de resumen de búsqueda sobre esas mismas fuentes | 2026-09-16 | **false** — falta solo la zona explícita, la hora ya está confirmada |
| Bus Nouhi (Kanazawa–Shirakawa-gō–Takayama) | Confirmado LITERAL en la fuente oficial: "1ヶ月前より予約可能" (reservable desde 1 mes antes). Sin hora del día. | [nouhibus.co.jp/highwaybus/](https://www.nouhibus.co.jp/highwaybus/) | 2026-09-16 | **false** — regla de día ya no es aproximación nuestra, es texto oficial; falta solo la hora |
| Tobu Limited Express (SPACIA/Revaty) Asakusa→Tōbu-Nikkō | Confirmado LITERAL: "9:00 am... one month prior to the travel date" (mismo día del mes). La página NUNCA dice JST/Japan Standard Time explícitamente pese a revisarla a propósito para esto. | [tobu.co.jp — purchase info](https://www.tobu.co.jp/en/express_info/purchase/) | 2026-09-16 | **false** — hora (9:00) y regla (1 mes, mismo día) confirmadas; falta solo la zona explícita |
| **USJ — entrada con fecha (USJ + Nintendo World) — CORRECCIÓN** | El press release oficial dice LITERAL: venta desde **3 meses antes** de la visita (no 2, como decía la primera pasada — dato descartado). Sin hora exacta del día. | [usj.co.jp — anuncio oficial](https://www.usj.co.jp/company/company_e/news/2025/0421/) | 2026-09-16 | **false** — regla de 3 meses confirmada oficial; falta la hora |
| **USJ — Universal Express Pass — CORRECCIÓN** | El mismo press release dice explícitamente que el Express Pass sigue la MISMA regla de 3 meses que la entrada general (antes se creía sin regla oficial: era un error de la primera pasada, no de esta) | mismo [press release](https://www.usj.co.jp/company/company_e/news/2025/0421/) | 2026-09-16 | **false** — regla confirmada; falta la hora |
| Santuario Tōshōgū (Nikko) | Sin regla de antelación tipo "X días/meses antes" en ninguna fuente oficial encontrada (toshogu.jp ni el sistema de venta anticipada); parece compra anticipada sin ventana estricta, no venta programada | toshogu.jp (sin página con la regla) | 2026-09-16 | **false** — sin regla, no solo sin hora |
| teamLab Biovortex (Kioto) | Sin regla de antelación en la FAQ oficial ([teamlab.art/faq/kyoto/](https://www.teamlab.art/faq/kyoto/)) | teamlab.art | 2026-09-16 | **false** — sin regla |
| Myōryū-ji "templo ninja" (Kanazawa) | No investigado en esta pasada (baja prioridad explícita del encargo); sigue como estaba: solo teléfono, sin web en inglés | — | — | **false**, sin cambios |
| Super Nintendo World / Mario Kart — timed entry | Sin cambios respecto a la primera pasada: Area Timed Entry Ticket desde 5-ene-2026, sin regla de antelación fija (depende de disponibilidad diaria) | [usj.co.jp — Super Nintendo World](https://www.usj.co.jp/web/en/us/areas/super-nintendo-world) | 2026-09-16 | **false** |
| Bus Shinjuku↔Kawaguchiko | No investigado, sin cambios | highway-buses.jp | — | **false** |

**Cómo se traduce esto al modelo de §C:** las reglas con `horaConfirmada: true` de extremo a
extremo (regla + hora + zona) son solo **Tōkaidō/Sanyō smartEX**, **Kagayaki** y **check-in
Finnair** → cuenta atrás exacta. Las que tienen DÍA exacto confirmado pero falta hora o zona
(JR East 3 meses, Nouhi, Tobu, USJ + Express Pass) → cuenta atrás **al día**, con el badge ⚠️ de
§C.4 avisando de que la hora exacta no está confirmada, NO el aviso "vigilar apertura" de §C.7 (ese
queda reservado para Tōshōgū, teamLab y todo lo que siga sin ni siquiera un día/mes exacto
conocido).

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

**Migración (mientras v2.1 sigue siendo LA app), implementada en Fase 2 (2026-09-16):**
1. `tools/v3-migrate-import.js` — **de solo lectura de v2**: lee un volcado local de
   `proyectos/viaje-japon` (`live.json`, el mismo que ya usa `tests/run-all.js live.json`; nunca
   escribe ahí) y las constantes horneadas de `index.html` (`RUTA_DAYS`, `FLIGHTS`,
   `canonicalPid`/`provenanceOf`/`isBookedHotel`, extraídas con el mismo mecanismo que los tests,
   para no duplicar esas reglas en v3). Transforma todo a `RouteItem` (esquema §B) con la
   precedencia de estado de la Decisión A (confirmado > propuesta > idea, un id nunca sale dos veces).
2. **Informe de duplicados (Decisión 2, `v3/lib/dedupe.js`), nunca fusión automática**: candidatos
   por nombre normalizado o coordenadas a <150 m se listan en `import/v3-duplicates-report.json`
   para que decidas caso a caso — el importador nunca los fusiona por su cuenta.
3. **Fusión segura, no `fb.set` a ciegas (Decisión B, `v3/lib/merge.js`)**: si el nodo v3 está
   vacío, siembra entero; si ya tiene datos (pasados como `[v3-actual.json]` opcional en esta fase,
   sin red todavía — ver punto 5), fusiona por id: el importador manda en lo derivado de v2, el
   nodo v3 manda en `notas`, `hecho` de cada acción y `estado` si el ítem tiene `estadoManual: true`.
   Un ítem que solo existe en v3 (creado por un usuario) **nunca se borra** (Decisión 3). Probado en
   `tests/test-v3-merge.js`: sembrar → simular edición → reimportar → la edición sigue.
4. Ids canónicos se preservan literalmente (mismo invariante que v2, §12.2 de PROJECT.md): un
   `id_sunshine_kinugawa` sigue siendo el mismo string en v3. Migración repetible e idempotente
   (como `foldCurated` en v2): correrla dos veces da el mismo resultado, nunca duplica.
5. **Alcance deliberado de esta fase, para que lo confirmes**: el importador escribe SIEMPRE a
   ficheros locales (`import/v3-migrated-preview.json` + el informe de duplicados), **nunca hace un
   `fb.set` real todavía**. Motivo: las reglas de `proyectos/viaje-japon-v3` no están desplegadas
   (deny por defecto hoy), y el patrón ya establecido en v2 es que el `fb.set` real lo hace la APP
   en el navegador con sesión autenticada (p.ej. `ensureHotelFixes()`), no un script de dev-time.
   El seed/fusión en vivo se conecta cuando exista el runtime de v3 con auth (Fase 6): su arranque
   leería este mismo JSON de vista previa y haría el `fb.set` real desde el navegador.
6. `/v3/` se desarrolla y se prueba en su propia URL (`https://amenedorubn.github.io/japon/v3/`)
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

> **Orden confirmado 2026-09-16** (UI antes que Auth, tal como ya estaba aquí desde el principio):
> una respuesta mía anterior en la sesión dijo "Fase 3 = Auth" — fue un error mío al resumir "qué
> sigue" sin mirar esta lista; el orden real siempre fue UI (3-4-5) y LUEGO Auth (6). Las Fases 3-5
> se construyen y prueban enteras en `/v3/` leyendo `import/v3-migrated-preview.json` como JSON
> estático (sin Firebase, sin login); las ediciones ("marcar como hecho") viven en `localStorage`
> con prefijo `jp27v3:` como puente temporal hasta que la Fase 6 conecte Firebase de verdad.

0. **Fase 0 — Congelar + placeholder + este documento.** HECHO (2026-09-16).
1. **Modelo de datos + helpers de zona horaria + sus tests.** Sin UI. HECHO (2026-09-16).
2. **Importador de migración v2→v3** (solo lectura de v2.1) + inventario E + dedup en 3 niveles
   (agrupación automática + revisión manual versionada en `import/v3-manual-merges.json`). HECHO
   (2026-09-16) — creció más de lo previsto por el dedup, pero cerrado con 0 candidatos pendientes.
3. **UI Pendientes** (el mayor valor nuevo, y la más simple: solo lee, casi no edita). EN CURSO
   (2026-09-16). ~2–3 días.
4. **UI Ruta** (agrupada por noche/hotel) **+ Mapa**. ~3–4 días, la pieza más grande.
5. **UI Reservas + Ideas.** ~2 días.
6. **Auth**: reutilizar el patrón Google Sign-In + aprobación de admin de v2.1 (§16 de PROJECT.md).
   Decisión 2026-09-16: **sin nodo `access` propio de v3** — las reglas de `viaje-japon-v3`
   comprueban directamente `proyectos/viaje-japon/access/users/{uid}` (mismo adminEmail, mismas
   cuentas de Google, sin segunda aprobación). Diff de reglas ya escrito más abajo, **sin
   desplegar** hasta que esta fase arranque de verdad. ~1 día.
7. **Modo oscuro real + offline (SW de producción, no el de desarrollo actual) + pulido visual**
   con las Skills de diseño del proyecto. ~2–3 días.
8. **Gate de paridad con datos reales + pruebas de los 3 móviles + corte final.** ~1–2 días.

Total aproximado: 2–3 semanas de trabajo efectivo, sin contar el tiempo de tu revisión entre fases
(cada fase termina en su propio commit y espera luz verde, igual que en v2).

### Diff de reglas de la Fase 6 (escrito 2026-09-16, GUARDADO — no aplicado a `database.rules.json`
### ni desplegado hasta que la Fase 6 arranque de verdad)

100% aditivo: cero líneas tocadas en `viaje-japon` ni en `japon27-app-v2`; un nodo hermano nuevo
que reutiliza LITERALMENTE la misma condición de aprobación de v2.1 (sin nodo `access` propio de
v3, sin segunda aprobación — decisión explícita del usuario).

```diff
       "japon27-app-v2": {
         ".read": "auth != null && root.child('proyectos/viaje-japon/access/users/' + auth.uid + '/status').val() === 'approved'",
         ".write": "auth != null && root.child('proyectos/viaje-japon/access/users/' + auth.uid + '/status').val() === 'approved'"
+      },
+
+      "viaje-japon-v3": {
+        ".read": "auth != null && root.child('proyectos/viaje-japon/access/users/' + auth.uid + '/status').val() === 'approved'",
+        ".write": false,
+
+        "state": {
+          ".write": "auth != null && root.child('proyectos/viaje-japon/access/users/' + auth.uid + '/status').val() === 'approved'"
+        }
       }
     }
   }
 }
```

**Nota de seguridad (respuesta a "si hay un motivo para no hacerlo así, dímelo"):** referenciar
`proyectos/viaje-japon/access/users/{uid}` desde las reglas de v3 es el mismo mecanismo que v2.1 ya
usa consigo misma (`root.child(...)`, una lectura del MOTOR de reglas al autorizar, no una lectura
de datos ni una escritura) — no toca el invariante "v3 nunca escribe en el nodo de v2.1". Única
consecuencia real, aceptada a propósito: si el admin revoca a alguien en v2.1, pierde acceso a v3
en el mismo instante, automáticamente. Dado que sois las mismas 3 personas para el mismo viaje, es
el comportamiento deseado, no un efecto secundario indeseado.

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
