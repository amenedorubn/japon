# Foil Pass

## Purpose
A single confirmed fact: a flight, a booked hotel, or a trip document. The Wallet's unit and the
inline proof of certainty. Refactor of `DESIGN.md §5.6`.

## Anatomy
Full-width, 200px tall (mini variant 88px inline). Left category glyph; main line (route/name)
`Inter 17/600`; a tabular data row (gate / room / confirmation); a Seal mark with the sealer's
embossed monogram (The Mark); Foil edge (red, or gold for flights); one specular sweep.

```
┌──────────────────────────────────────────┐  Foil (--shadow-lg)
│ ✈  Madrid → Tokio                    ◈ R │  ◈=Seal  R=The Mark
│    AY3200 · 08 abr · 12:05                │  foil edge (gold: flight)
└──────────────────────────────────────────┘
```

## Component API
```
renderFoilPass(pass: Pass, {
  variant: 'full'|'mini',
  relevantToday: boolean,        // auto-raise in Wallet stack
  onExpand(): void,              // origin-aware detail
  onCancel(): void               // guarded reverse press
}) → element
```
`Pass` = `{ id, kind:'flight'|'hotel'|'doc', title, dataRow[], sealedBy, confirmationRef, address?, geo? }`.

## Required design tokens
`--card`, `--ink`, `--muted`, `--shadow-lg`, `--foil-edge-red`, `--foil-edge-gold` (flights),
`--radius`, `--space-4`, `--dur-line`, `spring-settle`, `--dur-hold`, `--z-sheet` (expanded).

## States
Sealed (default Foil) · Relevant-today (raised to stack top) · Expanded (full detail: address,
confirmation, "cómo llegar", map) · Unsealed placeholder (Washi, dashed edge, no Seal,
invitation "sella tu primer hotel"). Loading: emboss skeleton, Seal fades in last.

## Spacing
Internal padding `--space-4`. In the Wallet stack, **28px peek** between passes. Mini variant
88px tall inline.

## Typography
Name `Inter 17/600`; data `data 12 tabular`; The Mark = monogram glyph in `--muted`.

## Interaction
Tap = expand (shared element, origin-aware, grows from itself). Swipe down = collapse. In the
stack, first tap fans the stack (`stagger` 60ms). Sealing happens via CommandDot/PlaceCard hold,
not here; this component *receives* the sealed pass.

## Gestures
Tap-expand; swipe-down collapse; (stack) tap-to-fan.

## Responsive behavior
Full width within the ≤520 column. Expanded detail is a Context Sheet on phone, an origin-aware
panel on desktop. Under Dynamic Type the pass grows in height; the data row wraps before hiding.

## Keyboard behavior
Focusable; `Enter`/`Space` expands; `Esc` collapses; focus returns to the pass on close. Cancel
is an explicit action inside the expanded view (guarded confirm), never a swipe-only.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Pass | material + shadow | Ink → Foil, deboss | 200ms | `--ease` | Foil Press completion |
| Foil edge | line draw | undrawn → drawn | `--dur-line` | `--ease` | Foil Press completion |
| Specular | `transform: translateX` | one sweep | 500ms | `--ease` | Foil Press completion |
| Pass | shared element expand | rect → detail | `--dur-zoom` | `--ease` | tap |
| Stack | `stagger` fan | stacked → fanned | 60ms/step | `--ease` | first open |
Never scales from screen center (anchored). Reduced motion: material swaps to Foil instantly, no
sweep/draw; expand crossfades.

## Accessibility
"Vuelo Madrid a Tokio, 8 abril, confirmado por Rubén." The Mark has a text equivalent. Expanded
detail is a focus-trapped dialog with a clear close.

## Accessibility checklist
- [ ] Announces kind + title + date + "confirmado por {name}".
- [ ] The Mark and Seal have text equivalents.
- [ ] Expanded view traps focus and returns it on close.
- [ ] Foil edge/specular are decorative to AT.

## Acceptance criteria
- **Given** a Foil Press completes, **then** the object becomes Foil with edge draw + one
  specular sweep and migrates into the Wallet.
- **Given** `relevantToday`, **then** the pass auto-raises to the stack top during the trip.
- **Given** an unsealed hotel, **then** a Washi dashed placeholder invites sealing.
- **Given** reduced motion, **then** the material swaps instantly with no sweep or draw.

## Do
Reserve Foil and Seal for genuinely confirmed facts.
## Don't
Use a Foil Pass for a plan or an idea. Add a second accent hue.
