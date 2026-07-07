# Empty State

## Purpose
Present emptiness as intention: breathing room or invitation, never a gap. Refactor of
`DESIGN.md §5.12`.

## Anatomy
A short line of copy, optional 1–2 contextual suggestions, no illustration, no mascot. Tone
matches the surface.

```
        Día libre en Kioto            (breathes, sub-perceptible)
   cerca:  [ Uji ]   [ Nara ]         ← one-tap plant
```

## Component API
```
renderEmptyState(kind: 'empty-day'|'cleared-ideas'|'unsealed-wallet', {
  suggestions?: Place[],       // nearby ideas for empty-day
  onSuggestionTap(id): void
}) → element
```

## Required design tokens
`--muted`, `--ink`, `--green` (cleared check), `--card2` (suggestion chips = Washi),
`--space-8`, `--dur-*` for float. No accent (except a single `--green` check on cleared).

## States
- **empty-day** — invitation + nearby ideas; breathes.
- **cleared-ideas** — "Todo clasificado", one green check; still.
- **unsealed-wallet** — placeholder pass, invitation (see FoilPass unsealed state).

## Spacing
Centered in available space, generous negative space; `--space-8` vertical.

## Typography
Line = `body`; suggestions = `secondary`. Never a heading larger than the surface warrants.

## Interaction
Suggestions are one-tap (plant a nearby idea). The state itself is not a control.

## Gestures
Tap on suggestions only.

## Responsive behavior
Centered block scales with the container; suggestions wrap. No layout dependence on viewport
width beyond centering.

## Keyboard behavior
Suggestions focusable with concrete names ("Plantar Uji en el día 4"); `Enter` plants.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| empty-day | `transform: translateY` float | ±1px | ~3s loop | `--ease-io` | idle (sub-perceptible) |
| cleared | — | static | — | — | — |
Reduced motion: no float; fully static.

## Accessibility
Copy is a real sentence, announced. Suggestions are buttons with concrete names. The float is
decorative and removed under reduced motion.

## Accessibility checklist
- [ ] Copy announced as text.
- [ ] Suggestions have concrete, plant-specific names.
- [ ] No error color on a free day.
- [ ] Float removed under reduced motion.

## Acceptance criteria
- **Given** an empty day, **then** the state invites with nearby ideas and breathes.
- **Given** a fully sorted Ideas feed, **then** "Todo clasificado" shows with a single green
  check and no motion.
- **Given** reduced motion, **then** the empty-day float is disabled.

## Do
Make empty feel like permission or invitation.
## Don't
Fill it with decoration. Use an error color for a free day.
