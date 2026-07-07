# Countdown

## Purpose
The pre-trip face of the product; anticipation made visible. Refactor of `DESIGN.md §5.7`.

## Anatomy
Days-remaining number in `Noto Serif JP display` (64; `display-xl` 72 at launch), a tabular
sub-line (route · date), and the destination in tategaki down the right margin (The Rail).

```
        274            東
        días           京      ← Rail (tategaki), destination
   Madrid → Tokio · 8 abr
```

## Component API
```
renderCountdown(trip: TripMeta, {
  daysRemaining: number,
  variant: 'far'|'near'|'launch',   // near ≤14 days; launch = first-ever open
  onOpenTrip(): void
}) → element
```

## Required design tokens
`--ink` (number), `--muted` (sub-line), `--accent` (daily pulse, subtle), Noto Serif JP roles
`display`/`display-xl`/`city`, `--space-8`/`--space-16`, `--dur-*` for the ticker.

## States
- **Far** (`>14` days) — small, calm, pinned above the Cord.
- **Near** (`≤14` days) — grows to display size, gains a once-daily pulse.
- **Launch** — `display-xl`; number tics up from 000 once on first-ever open.
- **Day 0** — transitions into the Threshold (see EmptyState/companion flows).
- Loading — number skeleton.

## Spacing
Centered block; `--space-16` top on launch, `--space-8` when pinned above the Cord.

## Typography
`display` / `display-xl` serif, tabular; sub-line `data`. Destination Rail = `city` serif vertical.

## Interaction
Non-interactive except tapping opens the trip overview (the Cord). It is a face, not a control.

## Gestures
Tap (open trip). No drag/swipe.

## Responsive behavior
Number scales down one step on `phone` if it would exceed the column; Rail hides below 360px
width if it would overlap content. On `tablet`/`desktop` the Rail sits comfortably in the right
ground.

## Keyboard behavior
Focusable as a single control; `Enter`/`Space` opens the trip. No internal navigation.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Number | `number ticker` | 000 → N | 900ms | `--ease` | first-ever open (once) |
| Number | `number ticker` | N → N−1 | 600ms | `--ease` | first open of a new day |
| Block | `opacity`/`transform` pulse | subtle | once | `--ease` | daily, `near` variant |
Reduced motion: no ticker (value shown directly); no pulse.

## Accessibility
Live-region announces "faltan 274 días" on daily change, not every render. The Rail is decorative
(the route text already names the destination).

## Accessibility checklist
- [ ] Daily change announced once via polite live region.
- [ ] Number is real text (tabular), not an image.
- [ ] Rail `aria-hidden` (destination already in the sub-line).
- [ ] Tap target ≥44.

## Acceptance criteria
- **Given** first-ever open, **then** the number tics up from 000 once.
- **Given** `daysRemaining ≤ 14`, **then** the Countdown is `near`: larger, with a once-daily pulse.
- **Given** a new calendar day's first open, **then** the number decrements with a ticker + pulse.
- **Given** reduced motion, **then** the value is shown directly with no ticker or pulse.

## Do
Let it own the pre-trip surface.
## Don't
Animate it continuously or dramatize beyond the daily beat.

## Ambiguity (flagged, resolved)
"Near (~2 weeks)" objectified to **`daysRemaining ≤ 14`** for the `near` variant. Day 0 hands off
to the Threshold. No new concept.
