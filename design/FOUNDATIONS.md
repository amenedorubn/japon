# Foundations

Grid, spacing, layout, breakpoints, safe areas, radii, borders, shadows, elevation, z-index.
Source of truth for all non-color, non-type, non-motion tokens. Derives from `DIRECTION.md`;
refactor of `DESIGN.md §1` with rules unchanged.

## 1. Grid

- Base unit: **8px**. All spacing, sizing, positioning are multiples of 8, with a **4px
  half-step** permitted for dense inline rhythm (icon↔label, node↔time) only.
- **Optical alignment overrides mathematical alignment.** When the 8px grid and optical
  balance disagree, choose optical and record the offset in the component doc.

## 2. Spacing scale

| Token | px | Primary use |
|---|---|---|
| `--space-0` | 0 | reset |
| `--space-1` | 4 | icon↔label, hairline insets |
| `--space-2` | 8 | intra-component padding |
| `--space-3` | 12 | list-row internal, chip padding |
| `--space-4` | 16 | card padding, group gaps |
| `--space-5` | 20 | **page gutter** (screen left/right margin) |
| `--space-6` | 24 | section separation |
| `--space-8` | 32 | major section separation |
| `--space-10` | 40 | screen-top breathing room |
| `--space-12` | 48 | hero separation |
| `--space-16` | 64 | launch / memory hero spacing |

### Editorial rhythm rules (objectifies "intentional spacing")

The principle (rhythm is uneven by design) is preserved; these make it testable:

- Section gaps are chosen from `{--space-6, --space-8, --space-12, --space-16}` by hierarchy,
  never a single uniform value applied to all sections.
- **No more than 2 consecutive sections may share the same vertical gap.** A 3rd consecutive
  equal gap is a QA failure (introduce a hierarchy break).
- Hero/emotional separations (Countdown, Threshold, Memory) use `--space-12` or `--space-16`.
- Intra-group spacing stays `≤ --space-4`; inter-group spacing starts at `--space-6`. The jump
  between the two is what signals grouping (space groups, not boxes).
- Every empty region must map to a named intent: *breathing room* (hero separations) or
  *invitation* (EmptyState). An unclassified gap is a defect.

## 3. Layout system

- **Single column, mobile-first.** One primary content column at every breakpoint. No
  multi-column content grids. Composition varies by weight and size, never by equal cells.
- **Content max-width:** `520px`. Above it, the column centers; surrounding space is the
  theme ground (never a second column or side panel).
- **The gutter is fixed:** `--space-5` (20px) left/right on phone. Full-bleed is allowed only
  for: images, the Cord ground, the Foil Pass specular sweep, and The Rail margin.
- Reference authoring size: **390 × 844**. Larger sizes are the same column with more ground,
  never a re-layout into panels.

```
 phone 390                 desktop ≥1024
┌───────────────┐        ┌───────────────────────────────┐
│20│  column   │20│      │      │  column (≤520)   │      │
│  │  (≤350)   │  │      │ground│   centered       │ground│
└───────────────┘        └───────────────────────────────┘
```

## 4. Breakpoints

| Name | Range (px) | Behavior |
|---|---|---|
| `phone` | 0–767 | base target (390). One column, bottom thumb zone. |
| `tablet` | 768–1023 | column centers at 520; gutter grows to 32 (`--space-8`); Rail may widen. |
| `desktop` | ≥1024 | column centers at 520; keyboard paths active; hover states unlocked. |

Media hooks: `hover` states only under `@media (hover:hover) and (pointer:fine)`.

## 5. Safe areas

- Respect `env(safe-area-inset-*)` on all four edges.
- Bottom inset is **added to**, not replaced by, thumb-zone padding:
  `bottom = max(env(safe-area-inset-bottom), --space-4)` then component height above it.
- Full-bleed visuals and The Rail may extend under the top inset, but never place interactive
  or essential content there.

## 6. Radii

| Token | px | Use |
|---|---|---|
| `--radius` | 16 | Foil Pass, Place Card, Context Sheet body, images |
| `--radius-s` | 10 | inputs, small controls, cornered chips |
| `--radius-sheet` | 20 | Context Sheet top corners, bottom sheets |
| `--radius-pill` | 999 | pills, region rail, Command Dot, scrubber ticks |

No radius outside this scale. Cards never exceed 16. Pills are fully round or not round.

## 7. Borders

| Token | Light | Dark | Use |
|---|---|---|---|
| `--hairline` | `rgba(38,34,26,.14)` | `rgba(236,231,219,.16)` | Washi edge, dividers, scrubber ticks |
| `--border` | `rgba(38,34,26,.10)` | `rgba(236,231,219,.12)` | input/control edge |
| `--foil-edge-red` | `var(--accent)` | `var(--accent)` | Foil Pass sealed edge |
| `--foil-edge-gold` | `var(--gold)` | `var(--gold)` | Foil Pass edge for flights |

Borders are structural, never decorative. **Colored side-stripe borders are forbidden.**
Washi carries a hairline; Ink carries shadow (no border); Foil carries a foil edge (no plain border).

## 8. Shadows

Shadow depth encodes certainty. Three resting depths plus overlay and drag.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| *(none)* | — | — | **Washi** (Exploration): flat |
| `--shadow` | `0 1px 2px rgba(38,34,26,.05), 0 6px 20px rgba(38,34,26,.05)` | `0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.36)` | **Ink** (Planning) |
| `--shadow-lg` | `0 2px 6px rgba(38,34,26,.08), 0 20px 48px rgba(38,34,26,.10), inset 0 1px 0 rgba(255,255,255,.6)` | `0 2px 8px rgba(0,0,0,.5), 0 24px 56px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)` | **Foil** (Confirmed) |
| `--shadow-overlay` | `0 8px 40px rgba(38,34,26,.16)` | `0 8px 44px rgba(0,0,0,.56)` | Context Sheet, bottom sheets |
| `--shadow-drag` | `0 12px 32px rgba(38,34,26,.22)` | `0 16px 40px rgba(0,0,0,.6)` | drag-ghost while lifting |

Shadows are tinted with the paper's ink, never pure black in light mode. Single soft top
light source; all shadows fall downward.

## 9. Elevation

Two systems. **Material planes** (resting shadow, encode certainty) and **overlay planes**
(z-index, encode temporary layering).

Material planes:
- **Plane 0 — Page / Washi:** no shadow.
- **Plane 1 — Ink:** `--shadow`.
- **Plane 2 — Foil:** `--shadow-lg`.

Overlay z-index scale (do not invent values):

| Token | z | Layer |
|---|---|---|
| `--z-chip` | 900 | sticky chips, region rail |
| `--z-bar` | 1200 | headers, Command Dot, bottom actions |
| `--z-sheet` | 2000 | Context Sheet, bottom sheets, modal |
| `--z-toast` | 3000 | recap, transient messages |
| `--z-drag` | 4000 | drag-ghost |

A component belongs to exactly one layer. No arbitrary z-index.
