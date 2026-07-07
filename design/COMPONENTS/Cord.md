# Cord

## Purpose
Render the entire 21-day trip as one continuous object. The trip's body, and the **Trip
altitude** of the Plan. Refactor of `DESIGN.md §5.1`, rules unchanged.

## Anatomy
A single vertical thread at `x = 64` (left third). Day Nodes hang as notches; the Hotel Thread
runs as unbroken colored segments through consecutive same-city nights; flight days are gold
clasps that bracket the trip. Day content hangs to the right with **no card container**. A bead
marks scroll position.

```
        x=64
         │
 ┌───────┼───────────────────────────────────┐
 │  1 ⛩  ┿━━━┓  Tokio                    ● ● ●│  ← Day Node (full, Ink)
 │       ┃   ┃  Senso-ji · Nakamise           │
 │  2 🏯 ┿━━━┫  Tokio                    ● ● ○│     Hotel Thread = unbroken ┃
 │  3 ✈  ◆   ┃  Tokio → Kioto  (gold clasp)   │
 │  4 🍵 ┿━━━┓  Kioto  (libre)          ○ ○ ○│  ← empty day (Washi, invitation)
 │  …    ┃   ┃                                │
 │[1][2][3][4]…[21]  ← day-scrubber (bottom)  │
 └────────────────────────────────────────────┘
```

## Component API
```
renderCord(days: Day[], {
  activeDay: number,            // index centered/highlighted (today during trip)
  phase: 'planning'|'countdown'|'companion'|'memory',
  onDayTap(index): void,        // → The Zoom into Day view
  onScrub(index): void,         // bead / scrubber travel
  onBudgetPeek(): void,         // pull-down at top
  onRegionSwipe(dir): void      // 'left'→Ideas, 'right'→Confirmed vault
}) → void
```
`Day` = `{ index, date, city, cityGlyph, cityKanji, stops[], hotelStayId?, isFlightDay, fill: 0..1, state: 'empty'|'partial'|'full'|'today'|'completed' }`.

## Required design tokens
`--bg`, `--card`, `--card2`, `--ink`, `--muted`, `--accent`, `--gold`, `--hairline`,
`--shadow` (Ink days), `--space-3/4/5`, `--radius`, `--dur-line`, `--ease`, `--z-chip` (scrubber).

## States
- **Planning** — most day-content Washi; Countdown pinned above.
- **Countdown** — Countdown Face grows above the Cord (≤14 days).
- **Companion** — bead auto-centers `activeDay` (today); Now-Line present in the focused day.
- **Memory** — every day inked/green; bands saturated; all clasps present.
- **Loading** — thread draws top-down (`line drawing`, `--dur-line`); nodes fade staggered.
- **Empty** — never blank; Washi rows + a single non-modal coach card at top.

## Spacing
Thread stroke **2–4px** (see *Ambiguity*). Day row min-height **96**. Content left margin
`--space-3` from thread. Right side uses the page gutter `--space-5`. Scrubber row height 28.

## Typography
Day index `Inter 20/600 tabular`; city `body 15/600`; sub-stops `secondary --muted`. (Countdown
uses its own doc.)

## Interaction
Vertical scroll = travel the trip. Tap a Day Node = **The Zoom** into Day view. Drag the bead =
scrub. Swipe left/right = the Axis. Pull down at top = **Budget Peek** (whole trip).

## Gestures
Vertical pan (scroll), horizontal edge-swipe (region), bead drag (scrub), pull-down (budget).
Edge-swipe yields to the scrubber's horizontal drag when the touch starts on the scrubber.

## Responsive behavior
- `phone`: as drawn; thread at x=64 within the ≤350 column.
- `tablet`/`desktop`: column centers at 520; thread stays at the column's left third; The Rail
  (destination) may appear in the right ground. Scrubber persists.
- Dynamic Type: day rows grow in height; the thread/bands stretch to match; nothing clips.

## Keyboard behavior
- `Tab` moves through Day Nodes in order; `:focus-visible` ring on each.
- `↑/↓` move focus between days; `Enter`/`Space` = Zoom into the focused day.
- `←/→` = region switch (Ideas / Confirmed vault).
- `Home`/`End` jump to day 1 / day 21. Scrubber mirrors focus.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Thread | `clip-path`/stroke-dashoffset | hidden → drawn (top-down) | `--dur-line` | `--ease` | first paint |
| Cord (whole) | `transform: translateY` | +2px → 0 | 400ms | `--ease` | after draw (one settle) |
| Day Node | shared element | notch → Day view | `--dur-zoom` | `--ease` | tap |
| Bead | `transform` | tracks scroll | — | — | scroll/scrub |
Reduced motion: thread appears instantly; no settle; Zoom → crossfade.

## Accessibility
Role `list`; each Day Node a `listitem` with a full name (date, city, count, state word). Thread
and bands are decorative to AT (state is in labels). Density-thickness is never the sole carrier
of meaning.

## Accessibility checklist
- [ ] Each day announces date + city + stop count + state.
- [ ] Keyboard: focus, ↑/↓ navigate, Enter zooms, ←/→ switch region.
- [ ] Thread/bands `aria-hidden`.
- [ ] Contrast of node rings and index ≥3:1 both themes.
- [ ] Reduced-motion path verified.

## Acceptance criteria
- **Given** 21 days, **when** the Cord renders, **then** it is one continuous thread with the
  Hotel Thread unbroken across consecutive same-city nights and broken at city changes.
- **Given** a tap on day N, **then** day N zooms into Day view via shared element and back
  returns it to its notch.
- **Given** `phase='companion'`, **then** the bead and view center today with a Now-Line.
- **Given** an empty trip, **then** rows are Washi and a coach card shows; never blank.
- **Given** reduced motion, **then** no thread-draw or settle animation plays and Zoom crossfades.

## Do
Keep it one continuous object; let space and the thread order the days.
## Don't
Turn day rows into cards. Add thickness for mood. Break the thread except at real city changes.

## Ambiguity (flagged, resolved — smallest change)
`DESIGN.md` said thread thickness goes "up to 4px where density is high" without thresholds.
**Resolved (objective, deterministic):**
| Stops planned that day | Thread stroke |
|---|---|
| 0–1 | 2px |
| 2–3 | 3px |
| 4+ | 4px |
Thickness encodes density only, never mood. No new concept introduced.
