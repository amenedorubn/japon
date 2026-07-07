# Context Sheet

## Purpose
Place detail and other focused overlays that have an origin. Refactor of `DESIGN.md §5.11`.

## Anatomy
A sheet with `--radius-sheet` top corners, `--shadow-overlay`, over a `--scrim`. On phone it
rises from the bottom edge; on desktop it scales from its trigger.

```
        (scrim)
┌────────────────────────────┐  ← --radius-sheet top corners
│ ▁▁▁  (grab affordance)      │
│ Fushimi Inari              │  title
│ templo · Kioto             │
│ 1h · gratis · abierto      │  essence row (tabular)
│ … progressive detail …     │
│                            │
│        [ Plantar ]         │  ← primary action, thumb zone
└────────────────────────────┘
```

## Component API
```
openContextSheet(content, {
  origin: Rect|null,           // null → center modal
  onDismiss(): void,
  primaryAction?: { label, onAct }
}) → handle
```

## Required design tokens
`--card`, `--radius-sheet`, `--shadow-overlay`, `--scrim`, `--space-3/5`, `--dur-drawer`,
`--ease-drawer`, `--ease`, `--z-sheet`.

## States
Entering · Resting · Dismissing. Loading: skeleton lines within the sheet.

## Spacing
Grab affordance 36×5 at top, `--space-3` above content; body gutter `--space-5`. Primary action
pinned to the bottom thumb zone.

## Typography
Per content (Place detail uses `title`, `data`, `body`).

## Interaction
Pull down to dismiss (velocity + threshold). Backdrop tap dismisses. Primary action lives at the
bottom.

## Gestures
Pull-down dismiss; backdrop tap.

## Responsive behavior
- `phone`: bottom sheet, full-width, rises from the edge.
- `desktop`: origin-aware panel that scales from the trigger; backdrop dims; max-width 520.
- A modal with no origin scales from center in both.

## Keyboard behavior
Focus trap on open; focus returns to the trigger on close; `Esc`/back dismisses; `Tab` cycles
within. Primary action is the default focus target when appropriate.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Sheet (phone) | `transform: translateY` | 100% → 0 | `--dur-drawer` | `--ease-drawer` | open |
| Sheet (desktop) | `transform: scale`+`opacity` | .97/0 → 1/1 | `--dur-base` | `--ease` | open (origin) |
| Sheet | dismiss | rest → off / fade | 200ms | `--ease` | dismiss (faster than open) |
| Scrim | `opacity` | 0 → 1 | `--dur-drawer` | `--ease` | open |
Reduced motion: crossfade in/out; no translate/scale.

## Accessibility
Dialog with a name; focus trap; focus return; `Esc` closes. Grab affordance has an accessible
close button equivalent.

## Accessibility checklist
- [ ] `role="dialog"`, labelled, focus trapped and returned.
- [ ] `Esc`/back dismiss.
- [ ] Primary action reachable in the thumb zone and by keyboard.
- [ ] Origin-aware on desktop; center only when no origin.

## Acceptance criteria
- **Given** a trigger with a rect, **then** the sheet grows from that origin (desktop) or rises
  from the edge (phone).
- **Given** a pull-down past threshold or velocity, **then** it dismisses and focus returns.
- **Given** reduced motion, **then** it crossfades with no translate/scale.

## Do
Grow from the thing that opened it.
## Don't
Center-scale a sheet that has a clear origin.
