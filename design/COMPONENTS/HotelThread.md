# Hotel Thread

## Purpose
Show where you sleep as an unbroken part of the Cord, holding the trip together. Refactor of
`DESIGN.md §5.5`.

## Anatomy
A 4px colored segment of the Cord's left rail, running continuously through consecutive nights
in the same city; breaks at city changes; absent on flight-night gaps. At Day altitude, the
night's hotel appears as a mini-Foil Pass pinned at the thread foot.

```
 rail
  ┃    Tokio  (nights 1–5)  ← one unbroken segment, tone A
  ┃
  ╎    ← break at city change
  ┃    Kioto  (nights 6–9)  ← unbroken, tone B
      ┌───────────────┐
      │ 🛏 APA · sellado│  ← foot mini-Foil Pass (Day altitude)
      └───────────────┘
```

## Component API
```
renderHotelThread(stays: Stay[]) → railSegments
renderNightPass(stay: Stay, { onTap(): void }) → element   // Day altitude foot
```
`Stay` = `{ id, cityKey, firstNight, lastNight, confirmed, hotelName, provenance }`.

## Required design tokens
`--muted` (base), the **Hotel Thread neutral ramp** (see *Ambiguity*), `--foil-edge-red`
(confirmed foot pass), `--card` (foot pass), `--shadow-lg` (confirmed foot pass).

## States
Planned stay (neutral ramp tone) · Confirmed stay (foot mini-pass is Foil, sealed) ·
Gap/travel night (thread breaks).

## Spacing
Runs inside the Cord rail (4px); no independent gutter. Foot pass uses Foil Pass spacing.

## Typography
None on the thread. Foot mini-pass uses Foil Pass type (`FoilPass.md`).

## Interaction
Tap the foot mini-pass = Zoom to the pass (Wallet detail). The rail segment itself is not
interactive.

## Gestures
Tap (foot pass only).

## Responsive behavior
Segment scales with Cord height under Dynamic Type. On `tablet`/`desktop` the rail keeps its
4px width; the foot pass follows Foil Pass responsive rules.

## Keyboard behavior
The foot pass is focusable (`Enter`/`Space` opens it). The rail graphic is not focusable.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Segment | draw (with Cord) | hidden → drawn | `--dur-line` | `--ease` | first paint |
| Segment | color | neutral → saturated | `--dur-bloom` | `--ease` | stay sealed |
Reduced motion: appears instantly; saturation is a hard swap.

## Accessibility
Announced at the day level ("noche en Kioto, hotel confirmado"). The thread graphic is
decorative to AT. The foot pass carries the full pass name.

## Accessibility checklist
- [ ] Night/city and confirmed-state announced per day.
- [ ] Rail `aria-hidden`; foot pass fully labeled.
- [ ] City distinction not conveyed by color alone (see *Ambiguity* — break + label carry it).
- [ ] Neutral ramp tones ≥3:1 against `--bg` for the non-text rail (backup; not essential info).

## Acceptance criteria
- **Given** consecutive nights in one city, **then** the segment is unbroken across them.
- **Given** a city change, **then** the thread breaks; a travel night shows a gap.
- **Given** a sealed stay, **then** the segment saturates and the foot pass renders as Foil.

## Do
Keep it continuous across a multi-night stay.
## Don't
Restart the thread within one city. Color it with the accent.

## Ambiguity (flagged, resolved — smallest change)
`DESIGN.md` said "muted per-city hue" without defining the hues, which risks either a rainbow
(violating one-accent-per-screen) or undefined color. **Resolved:** a fixed **4-tone
low-chroma neutral ramp**, all desaturated (chroma well below any semantic hue, never near
`--accent` or `--gold`), assigned to cities **deterministically by stay order** and cycled:

| Ramp tone | Washi Day | Sumi Night | Note |
|---|---|---|---|
| `--stay-1` | `#8a8172` | `#6b6455` | warm grey |
| `--stay-2` | `#7c8580` | `#646d68` | cool grey |
| `--stay-3` | `#87807a` | `#6a6560` | neutral taupe |
| `--stay-4` | `#7f8288` | `#63666c` | slate grey |

Assignment: the trip's stays, in chronological order, take tones `1,2,3,4,1,2,…`. Because tones
are near-neutral, they are **not accents** and do not violate the one-accent rule; they only aid
distinguishing adjacent stays. **The break + the city label remain the primary distinction** (so
color-blind users lose nothing). No new concept introduced; this only fixes an undefined value.
