# Motion System

Timing, easing, springs, shared-element, drag, hold, reduced motion. Source of truth for all
motion tokens. Refactor of `DESIGN.md §6`, rules unchanged.

Motion is spent by frequency: the common is nearly still, the rare is memorable, there is
exactly one ceremony (the Foil Press). Only `transform`, `opacity`, and `clip-path` animate.

## 1. Timing tokens

| Token | ms | Use |
|---|---|---|
| `--dur-instant` | 0 | reduced-motion target; frequent keyboard actions |
| `--dur-press` | 120 | press feedback, context-icon crossfade |
| `--dur-fast` | 180 | region switch, tab-like changes |
| `--dur-base` | 240 | dropdowns, small reveals |
| `--dur-zoom` | 260 | The Zoom (altitude change) |
| `--dur-drawer` | 320 | bottom sheet entry |
| `--dur-bloom` | 400 | Ink Bloom saturation |
| `--dur-line` | 500 | line-drawing (Cord thread, foil edge) |
| `--dur-hold` | 1200 | Foil Press hold fill |

**Exit is always faster than entry** (typically 200ms `--ease`).

## 2. Easing curves

| Token | Curve | Use |
|---|---|---|
| `--ease` | `cubic-bezier(.23,1,.32,1)` | default; entering / responding to the user |
| `--ease-io` | `cubic-bezier(.77,0,.175,1)` | on-screen movement / morph between two states |
| `--ease-drawer` | `cubic-bezier(.32,.72,0,1)` | bottom sheet entry |
| `linear` | linear | hold fill, ambient pulse, shimmer |

`ease-in` is **never** used on UI. Built-in `ease` only for hover/color changes.

## 3. Spring values

For JS-driven / interruptible motion (Plant, Seal settle, drag). Apple-form and physics-form
are equivalent; use either.

| Spring | Apple form | Physics form | Use |
|---|---|---|---|
| `spring-plant` | duration .42, bounce .18 | stiffness 220, damping 24, mass 1 | idea settling into a day |
| `spring-settle` | duration .30, bounce .10 | stiffness 300, damping 30, mass 1 | Foil Press settle, node catch |
| `spring-receive` | duration .25, bounce 0 | stiffness 320, damping 34, mass 1 | drop-target anticipation |

Bounce ≤ 0.2. No elastic, no overshoot beyond these.

## 4. Primitive: Press feedback

Every pressable element: `transform: scale(.97)` on press, `--dur-press`, `--ease`. Applied
globally to `button`/`.btn`-class elements. Always the first response, before any action.

## 5. Shared element transitions (The Zoom, Foil expand)

- Duration `--dur-zoom`, `--ease`. The tapped element is the shared element: it scales and
  translates from source rect → destination rect. `transform` + `opacity` only.
- Non-shared siblings fade to `opacity: .5` during, back on return.
- **Origin-aware:** growth begins from the element's own rect, never screen center, except a
  true modal with no origin (scales from center).
- Return reverses exactly, landing the element in its source position.

## 6. Ink Bloom (Washi → Ink)

Trigger: Plant. Reward the placement.
- The card's Washi tone **saturates to Ink** (`--card2`+muted → `--card`+ink) over `--dur-bloom`, `--ease`.
- The card gains `--shadow` (Plane 0 → Plane 1) across the same window.
- It settles onto the day with `spring-plant`.
- If dragged, it travels visibly rightward (toward Plan) before settling.

## 7. Drag behavior

- Press → `scale(.97)` (`--dur-press`). On lift → `scale(1.03)` + `--shadow-drag`.
- Ghost follows pointer with slight spring lag (`spring-receive`), not rigid 1:1.
- Valid drop targets animate `spring-receive` (rise/scale to receive — anticipation).
- Boundaries apply damping (movement decreases past the edge); never a hard stop.
- Pointer capture on drag start; ignore additional touch points; a quick flick commits by
  **velocity** (`> 0.11 px/ms`), not distance.
- Drop → `spring-plant` settle; neighbors `layout`-animate to make room.
- **Every drag has a non-drag equivalent** (see ACCESSIBILITY.md).

## 8. Hold interactions (Foil Press)

The single ceremony. The only >300ms interaction in the product.
1. Press begins; after 120ms a `var(--accent)` `clip-path` fill sweeps the target `linear`
   over `--dur-hold` (1200ms).
2. Release before completion → fill snaps back 200ms `--ease`; nothing changes.
3. Completion → object **debosses** (inset shadow deepens, 200ms) + **foil edge** traces once
   (`line drawing`, `--dur-line`) + one specular sweep crosses → migrate toward Confirmed
   (`spring-settle`).

**Reverse press** (Foil → Ink, cancel booking): a confirm gate first, then the foil edge
un-draws and the object lifts to Plane 1 and exits left, quick (200ms).

## 9. Reduced motion (`prefers-reduced-motion: reduce`)

Collapse **movement**, keep **state legibility**:

- The Zoom, region slide, drag travel → 120ms crossfade; layout appears in place.
- Ink Bloom → instant Washi→Ink material swap (color changes; no travel).
- Foil Press → hold still required (accessibility, not motion), but a plain determinate
  progress; no sweep, no specular; material swaps to Foil instantly on completion.
- Countdown pulse, empty-day float, skeleton shimmer → removed (static).
- **No state change is motion-only.** Every one is also carried by material, color, or text.
