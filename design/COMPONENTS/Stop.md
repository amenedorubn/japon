# Stop

## Purpose
One place within a day, on the day's thread. Refactor of `DESIGN.md §5.3`.

## Anatomy
A 12px node on the day spine (`x=32`); a tabular time at `x=0`; stop name; a `secondary`
sub-line (category · duration). Confirmed stops render as inline mini-Foil.

```
09:30 ●  Senso-ji
         templo · 1h
      │  ┌───────────────┐   ← transport segment (sunken)
      │  │ 🚶 12 min      │
11:00 ●  Nakamise
         compras · 45m
```

## Component API
```
renderStop(stop: Stop, {
  isNext: boolean,             // during trip: elevate
  onTap(): void,               // Zoom to Place detail
  onReorder(fromIndex, toIndex): void,
  onMoveToDay(dayIndex): void,
  onRemove(): void
}) → element
```
`Stop` = `{ id, pid, time, dur, name, category, note, done, confirmed }`.

## Required design tokens
`--card` (Ink), `--ink`, `--muted`, `--green` (done), `--accent` (next), `--shadow`,
`--shadow-drag`, `--space-2`, `spring-plant`, `--dur-press`.

## States
Planned (Ink) · Next (during trip: elevated, larger time) · Done (node `--green`, text
`--muted`) · Dragging (lifted, `--shadow-drag`) · Confirmed (inline mini-Foil).

## Spacing
Min-height 72. Node→time `--space-2`. Time column fixed width (≈40px) for tabular alignment.

## Typography
Time `data 12 tabular`; name `body 15/500`; sub `secondary`.

## Interaction
Tap = Zoom to Place detail. Long-press = drag-to-reorder (times re-infer, neighbors slide).
Drag to header ribbon-strip = move to another day. Swipe left = quick actions (edit time / move
/ remove); remove exits leftward, snappy.

## Gestures
Tap; long-press drag-reorder; horizontal drag to day-strip; swipe-left quick actions.

## Responsive behavior
Name wraps to 2 lines max then truncates; time column never collapses. Under Dynamic Type the
row height grows; the sunken transport segment stays below the upper stop.

## Keyboard behavior
- `Enter`/`Space` = open Place detail.
- Reorder via keyboard: focus stop → `Alt+↑`/`Alt+↓` move within day; a "Mover a día…" action in
  the context menu for cross-day. Never drag-only.
- Swipe actions available as a focusable action menu.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Stop | `transform: scale` | 1 → .97 | `--dur-press` | `--ease` | press |
| Stop | `transform` + shadow | rest → lifted (`--shadow-drag`) | — | `spring-receive` lag | drag |
| Neighbors | `transform: translateY` (layout) | shift | 240ms | `--ease` | reorder |
| Time | text change | old → new | 150ms | `--ease` | re-infer (`text morph`) |
| Stop | exit | rest → off-left + fade | 200ms | `--ease` | remove |
Never enters from `scale(0)`. Reduced motion: no lift/scale; reorder is instant; time swaps hard.

## Accessibility
`button`; name "09:30, Senso-ji, templo, 1 hora, planificado". Reorder exposed as accessible
actions. `done` announced.

## Accessibility checklist
- [ ] Name includes time + place + category + duration + state.
- [ ] Reorder + move + remove reachable by keyboard and AT.
- [ ] "done" conveyed by node + muted text, not color alone.
- [ ] Transport segment announced as related, quieter context.

## Acceptance criteria
- **Given** a reorder, **then** times auto-infer, neighbors animate, and the new time morphs.
- **Given** a confirmed stop, **then** it renders as inline mini-Foil with a seal.
- **Given** "next" during the trip, **then** it is elevated with a larger time and announced.
- **Given** reduced motion, **then** reorder and removal are instant with no travel.

## Do
Keep transport quieter than stops.
## Don't
Animate a stop appearing from `scale(0)`. Give a planned stop a foil edge.
