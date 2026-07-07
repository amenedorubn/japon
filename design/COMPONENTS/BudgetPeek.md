# Budget Peek

## Purpose
Summon cost on demand; never let money sit on screen. Refactor of `DESIGN.md §5.10`.

## Anatomy
A pull-down panel revealing per-person totals (trip or day), tabular, grouped simply
(alojamiento / transporte / entradas). Rubber-bands away on release.

```
 ╿ (pull down)
┌────────────────────────────┐
│ Por persona                │
│ Alojamiento        291,00 €│
│ Transporte          84,50 €│
│ Entradas            22,00 €│
│ ─────────────────          │
│ Total              397,50 €│
└────────────────────────────┘
```

## Component API
```
renderBudgetPeek(scope: 'trip'|'day', budget: Budget, {
  onReveal(): void,
  onDismiss(): void
}) → element
```
`Budget` = `{ perPerson: { alojamiento, transporte, entradas, total } }`.

## Required design tokens
`--card`, `--ink`, `--muted`, `--shadow-overlay`, `--radius-sheet`, `--space-4`, `--ease`.

## States
Hidden (default) · Peeking (follows the pull) · Released (springs closed).

## Spacing
Panel padding `--space-4`; figures right-aligned tabular; total separated by a hairline.

## Typography
Labels `secondary`; amounts `data 12 tabular`; total `body 15/600` tabular.

## Interaction
Pull down from the top of a Day or the Trip; release to dismiss. **Never** a persistent tab or a
visible number in the resting layout.

## Gestures
Pull-down reveal; release-to-dismiss. Plus a non-gesture "ver presupuesto" affordance.

## Responsive behavior
Full column width ≤520. On `desktop`, the "ver presupuesto" affordance (a text button in the
header overflow) is the primary path; pull-down still works on touch.

## Keyboard behavior
Reachable via an explicit "ver presupuesto" button; `Enter` opens, `Esc` closes. Amounts read in
order with currency and "por persona".

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Panel | `transform: translateY` | tracks pointer | — | — | pull |
| Panel | `transform: translateY` | current → closed | 240ms | `--ease` (spring) | release |
Reduced motion: instant show/hide via the button (no tracking).

## Accessibility
Also reachable via "ver presupuesto" for non-gesture users. Amounts announced with currency and
"por persona". Panel is a dialog with focus management.

## Accessibility checklist
- [ ] Non-gesture path ("ver presupuesto") exists.
- [ ] Amounts announced with currency + "por persona".
- [ ] No resting price anywhere else on the screen.
- [ ] Focus trapped while open, returned on close.

## Acceptance criteria
- **Given** a Day or Trip, **then** no cost is visible until summoned.
- **Given** a pull-down (or button), **then** per-person totals appear grouped, and release
  dismisses.
- **Given** reduced motion, **then** the panel shows/hides instantly via the button.

## Do
Keep prices summoned.
## Don't
Show a cost row, a running total badge, or per-card prices.
