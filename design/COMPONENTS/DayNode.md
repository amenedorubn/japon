# Day Node

## Purpose
One day, as a notch on the Cord and the entry to Day view. Refactor of `DESIGN.md §5.2`.

## Anatomy
A node dot on the thread (10px), the day index beside it, a 20px city glyph (emoji, optically
sized), then to the right the city name + up to three stop names (or the empty-day invitation).
A right-aligned fill indicator (3 dots or a 2px bar) shows how inked the day is.

```
 ●10  4 🍵   Kioto                          ● ● ○
             Fushimi Inari · Gion · Kiyomizu   fill
```

## Component API
```
renderDayNode(day: Day, {
  isToday: boolean,
  onTap(): void,               // Zoom to Day
  onReceiveDrop(ideaId): void  // Plant target
}) → element
```

## Required design tokens
`--card`/`--card2` (Ink vs Washi content), `--ink`, `--muted`, `--accent` (today), `--green`
(completed), `--shadow` (Ink), `--space-3/4`, `spring-receive`, `spring-plant`, `--dur-press`.

## States
Empty (Washi, invitation) · Partial · Full (Ink) · Today (1px `--accent` left edge + now dot) ·
Completed (node fills `--green`, content tone → `--card2`) · Receiving (drop target, raised).

## Spacing
Node dot centered on the thread. `--space-3` thread→text. Row vertical padding `--space-4`.

## Typography
Index `Inter 20/600 tabular`; city `15/600`; stops `secondary --muted`.

## Interaction
Tap = Zoom to Day. As a Plant target: on hover/hold of a dragged idea, the node rises to receive.
Long-press = lift as a move source (rare).

## Gestures
Tap; drop-target receive; long-press lift.

## Responsive behavior
Row grows in height under Dynamic Type; stop names truncate to the available width with the
count preserved in the fill indicator's text equivalent. Glyph fixed at 20px optical.

## Keyboard behavior
Focusable as part of the Cord list. `Enter`/`Space` = Zoom. Move-to-day (when lifted) exposed as
an accessible action list (Move up / Move down / Move to day…), never drag-only.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Node | `transform: scale` | 1.0 → 1.04 → 1.0 | 250ms | `spring-receive` | receiving a plant |
| Content | material swap | Washi → Ink | `--dur-bloom` | `--ease` | Ink Bloom (plant lands) |
| Node | color | ink ring → `--green` | 120ms | `--ease` | completion (`pop`) |
Reduced motion: receive = static highlight; Ink Bloom = instant material swap.

## Accessibility
Name includes date, city, count, and a state word ("planificado"/"libre"/"completado"/"hoy").
Fill indicator has a text equivalent ("3 de 3 planificado").

## Accessibility checklist
- [ ] Announces date + city + count + state.
- [ ] "Today" conveyed by label + Now-Line, not color alone.
- [ ] Completed conveyed by check + muted text, not green alone.
- [ ] Hit area ≥44 though the node dot is 10px.

## Acceptance criteria
- **Given** an empty day, **then** it renders Washi with an invitation and nearby ideas.
- **Given** a plant onto the day, **then** the node plays receive → Ink Bloom and the content
  becomes Ink.
- **Given** completion, **then** the node turns green with a check and text mutes; the state is
  announced.
- **Given** reduced motion, **then** no scale/receive animation plays.

## Do
Make empty days feel open, not broken.
## Don't
Use red on an incomplete day. Use color as the only completeness signal.
