# Transport Segment

## Purpose
How you move between two stops. Deliberately subordinate connective tissue. Refactor of
`DESIGN.md §5.4`.

## Anatomy
A sunken panel (`--card2`, inset shadow) indented to `x=32`, 44px tall: a 6px mode dot
(`--indigo` walk/train, `--teal` ferry), mode label, minutes.

```
      ┌────────────────────────────┐
 x=32 │ • 🚶 A pie · 12 min         │   sunken (--card2, inset)
      └────────────────────────────┘
```

## Component API
```
renderTransport(seg: Transport, {
  onSelectOption(optionId): void,   // choose among modes
  onExpand(): void                  // show alternatives
}) → element
```
`Transport` = `{ selected, options: [{ id, mode, minutes, distance }] }`.

## Required design tokens
`--card2`, `--muted`, `--ink`, `--indigo`, `--teal`, inset shadow (from `--shadow` recipe),
`--space-2`, `--radius-s`.

## States
Default · Selected option (chosen mode Ink-toned, others behind "otras opciones") ·
Calculating (minutes pulse) · Error/offline (inline "sin conexión", value hidden).

## Spacing
Vertical `--space-2` inside; sits between two Stops with no extra gap (it *is* the tissue).

## Typography
Mode `secondary`; minutes `data 12 tabular`.

## Interaction
Tap = expand alternative modes. Never a primary focus.

## Gestures
Tap to expand. No drag.

## Responsive behavior
Full column width minus the x=32 indent. Under Dynamic Type grows in height; label wraps before
the minutes value hides.

## Keyboard behavior
Focusable; `Enter`/`Space` expands options; options are a radio group (`↑/↓` to choose,
`Enter` to select).

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Minutes | `opacity` pulse | 1 ↔ .5 | 900ms loop | `linear` | calculating |
| Minutes | text change | placeholder → value | 150ms | `--ease` | resolve (`text morph`) |
| Options | height/opacity | collapsed → expanded | `--dur-base` | `--ease` | expand |
Reduced motion: no pulse (static "calculando…"); options toggle instantly.

## Accessibility
"A pie, 12 minutos" as one label. Selected option announced; alternatives in a disclosure/radio
group. The pulse has a text equivalent ("calculando ruta").

## Accessibility checklist
- [ ] Mode conveyed by label, not dot color alone.
- [ ] Selected vs alternatives distinguishable by AT.
- [ ] Calculating state announced as text.
- [ ] Contrast of mode dot ≥3:1 (backup only; label is primary).

## Acceptance criteria
- **Given** multiple modes, **then** the selected one shows Ink-toned and others collapse behind
  "otras opciones".
- **Given** a route calculation, **then** minutes pulse until resolved, then morph to the value.
- **Given** offline, **then** an inline "sin conexión" shows and no partial value is displayed.

## Do
Keep it visually below the stops it joins.
## Don't
Give transport an accent or promote it to card weight.
