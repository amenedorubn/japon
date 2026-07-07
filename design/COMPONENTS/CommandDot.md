# Command Dot

## Purpose
The single persistent action. Its meaning is contextual. The app's only persistent chrome.
Refactor of `DESIGN.md §5.8`.

## Anatomy
A 52px circular accent button, bottom-right, `--z-bar`, at `max(safe-area-bottom, --space-4)`
inset. Icon/label reflect context.

```
                              ┌────┐
                              │ +  │  52px, --accent, bottom-right
                              └────┘
```

## Component API
```
renderCommandDot({
  context: 'day'|'place-idea'|'place-booking'|'ideas',
  onAction(): void,           // tap for add/plant
  onHoldComplete(): void       // 'place-booking' → Foil Press
}) → element
```
Context → action: `day`→"+ parada" · `place-idea`→"Plantar" · `place-booking`→"Sellar" (hold) ·
`ideas`→contextual add.

## Required design tokens
`--accent`, on-accent white text (per COLORS contrast), `--radius-pill`, `--space-4`,
`--dur-press`, `--dur-hold`, `--dur-line`, `spring-settle`, `--z-bar`.

## States
Day (+ parada) · Place-idea (Plantar) · Place-booking (Sellar — hold) · Ideas (add) · Absent
(when no action applies — removed, not greyed) · Pressing · Holding (Seal fill).

## Spacing
16px (`--space-4`) from right and bottom safe edges. 52×52 (≥44 target satisfied).

## Typography
Icon-first; optional `data`-size label on press or on wide screens.

## Interaction
Tap = perform the contextual action. In `place-booking` it is a **hold** target (Foil Press).
`scale(.97)` on press.

## Gestures
Tap; hold (Seal context only).

## Responsive behavior
Fixed 52px on `phone`. On `desktop`, may show a persistent label ("Plantar") beside the icon;
still one control. Never becomes a toolbar.

## Keyboard behavior
Focusable; `Enter`/`Space` = action. For Seal context, `Enter`/`Space` **hold**: press-and-hold
(or a confirm step for keyboard users who cannot hold) triggers the Foil Press; the accessible
name states "Mantén para sellar" and a keyboard confirm path exists.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Dot | `transform: scale` | 1 → .97 | `--dur-press` | `--ease` | press |
| Icon | `opacity` crossfade | old → new | 120ms | `--ease` | context change |
| Fill | `clip-path` | 0 → 100% | `--dur-hold` | `linear` | Seal hold |
| Fill | `clip-path` | current → 0 | 200ms | `--ease` | early release |
Reduced motion: no scale; hold shows a plain determinate progress; context icon swaps instantly.

## Accessibility
Accessible name states the concrete action ("Añadir parada al día 4"), never just "más".
Reachable in the thumb zone. Seal path has a non-hold keyboard alternative.

## Accessibility checklist
- [ ] Name states the concrete contextual action.
- [ ] Seal context offers a keyboard/AT confirm alternative to holding.
- [ ] Target ≥44 (52 actual).
- [ ] Absent (not greyed) when no action applies.

## Acceptance criteria
- **Given** the Day context, **then** the dot reads "+ parada" and adds a stop on tap.
- **Given** the place-booking context, **then** hold triggers a Foil Press with the fill sweep.
- **Given** no available action, **then** the dot is absent, not disabled-grey.
- **Given** reduced motion, **then** the hold uses determinate progress with no sweep.

## Do
Keep it the *only* persistent chrome.
## Don't
Grow it into a toolbar or add a second floating button.
