# Design

Sistema visual de la app (Fase 9). Fuente de verdad: los tokens de `:root` en `index.html`.
Lema: **papel washi, tinta sumi, un rojo torii.** Denso pero calmado; la herramienta desaparece en la tarea.

## Theme

- Doble tema de primera clase; `data-theme` lo fija el script pre-pintado del `<head>` y el botón 🌙.
- El `<meta name="theme-color">` y las teselas del mapa siguen al tema (`setTheme`).
- Claro: papel cálido `#f6f4ee`, superficie `#fffefb`. Oscuro: noche sumi `#131217`, superficie `#1c1b22`.

## Color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#f6f4ee` | `#131217` | fondo de página |
| `--card` / `--card2` | `#fffefb` / `#f9f7f1` | `#1c1b22` / `#232129` | superficies / paneles hundidos |
| `--ink` / `--muted` | `#26221a` / `#6d6557` | `#ece7db` / `#a49d8e` | texto / secundario (AA ≥4.5:1 verificado) |
| `--accent` | `#bf3823` | `#cf4530` | acción primaria, selección, "hoy". Calibrado: blanco sobre acento 5.5:1 / 4.6:1 |
| `--indigo` `--green` `--gold` `--teal` | — | — | semánticos: transporte, hecho/ok, vuelos, ferry |

Regla: **un acento**. El rojo marca acción/selección; nunca decoración. En oscuro, el acento
como TEXTO pequeño usa el tono elevado `#f08b72` (overrides de `.pill.red` y `.btn.danger`).

## Typography

- **Inter** para toda la UI (registro producto: una familia basta). Display con `letter-spacing:-.02em`, nunca más apretado.
- **Noto Serif JP** reservada: título del hero, kanji de marca, columna japonesa de frases. Jamás en controles.
- Números siempre `font-variant-numeric:tabular-nums` (contador, horas, precios).
- Mínimo legible 11px; `text-wrap:balance` en encabezados.

## Shape (bloqueo de radios)

`--radius:16px` tarjetas · `--radius-s:10px` controles/inputs · `--radius-sheet:20px` hero/hojas modales · `999px` píldoras/chips. No inventar radios fuera de la escala.

## Elevation

- `--shadow` (reposo, teñida de la tinta del papel, nunca negro puro) y `--shadow-lg` (modales, ghost de arrastre, hover de tarjeta).
- Escala z semántica: chips fijos 900 · barras 1200 · modal 2000 · toast 3000 · drag-ghost 4000.

## Motion

- Tokens: `--ease` (ease-out enérgico `cubic-bezier(.23,1,.32,1)`), `--ease-io`, duraciones 120/180/240 ms.
- **Todo lo pulsable responde**: `scale(.97)` en `:active` (global sobre `button`/`.btn`).
- Lo frecuente apenas se anima: cambio de pestaña 180 ms solo-opacidad(+3px); cerrar modal es instantáneo.
- Hoja modal móvil: entra desde su borde con curva de drawer iOS `cubic-bezier(.32,.72,0,1)` 320 ms; escritorio: `scale(.97)→1` + fundido (origen centrado: los modales no tienen trigger).
- Toast: sube 10px desde su posición (coherencia espacial). `#routeStatus`: pulso mientras calcula (estado, no adorno).
- Solo `transform`/`opacity`. `prefers-reduced-motion` colapsa todo a instantáneo (bloque global).
- Hover solo bajo `@media(hover:hover)`; en táctil no hay estados fantasma.

## Components

- **Botones**: primario acento/blanco; `ghost` superficie+borde; `danger` delineado; hover por `color-mix`, nunca `opacity`.
- **Chips** (`.fchip`/`.day-chip`/`.t-opt`): píldora, activo = tinta sobre papel invertido; day-chips con `scroll-snap` y ≥44px.
- **Timeline**: numeración en acento (verde al completar), trayectos como panel hundido más silencioso que las paradas.
- **Formularios**: etiqueta encima, foco = borde acento + anillo `--ring`; placeholder legible.
- **Tab bar**: blur + saturate, ≥50px, icono del activo se eleva 1px.
- El **emoji es el lenguaje icónico deliberado** de la app (cuaderno de viaje personal, categorías semánticas); decisión de marca, no descuido.

## Accesibilidad

`:focus-visible` universal con `--ring` (el anillo sigue el radio del elemento). Contrastes AA verificados en ambos temas (texto muted, acento-sobre-soft, blanco-sobre-acento). Objetivos táctiles ≥44px en tab bar y day-chips. Selección de texto tintada del acento.

## Invariantes

Los nombres de token son API interna (las plantillas JS los usan inline): no renombrar.
Nada visual puede tocar la lógica verificada (PARITY.md) ni la política de escritura Firebase.
