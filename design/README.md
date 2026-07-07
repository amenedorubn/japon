# Design System — Index

Modular design system for the Japan companion. This directory is the **canonical,
build-facing** form of the design system. It is a lossless refactor of the monolithic
`DESIGN.md` (root): every rule and every token name is preserved unchanged. Product
vision lives in `DIRECTION.md` (root); this system formalizes it into buildable specs.

**Authority order:** `DIRECTION.md` (why) → this system (what, exactly) → code.
When a module is silent, defer to `DIRECTION.md`. Token names are an API: never rename, only add.

## Modules

| Module | Owns |
|---|---|
| [FOUNDATIONS.md](FOUNDATIONS.md) | grid, spacing, layout, breakpoints, safe areas, radii, borders, shadows, elevation, z-index |
| [COLORS.md](COLORS.md) | token hierarchy, semantic colors, both themes, contrast rules |
| [TYPOGRAPHY.md](TYPOGRAPHY.md) | families, type scale, tabular numbers, Japanese & tategaki rules |
| [MATERIALS.md](MATERIALS.md) | Washi, Ink, Foil recipes, allowed/forbidden transitions |
| [MOTION.md](MOTION.md) | timing, easing, springs, shared-element, drag, hold, reduced motion |
| [INTERACTION.md](INTERACTION.md) | the Axis grammar, Zoom, Plant, Foil Press, contextual surfaces, edge-swipe |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | targets, Dynamic Type, VoiceOver, reduce motion, color blindness, one-handed, offline |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | architecture, token structure, animation primitives, state machines, build order |
| [COMPONENTS/](COMPONENTS/) | one file per component, implementation-ready |

## Components

Cord · DayNode · Stop · Transport · HotelThread · FoilPass · Countdown · CommandDot ·
PlaceCard · BudgetPeek · ContextSheet · EmptyState · Skeleton · Rail

## Token source of truth (no duplication)

Each token is defined in exactly one module and referenced elsewhere:

- **Color tokens** → `COLORS.md`
- **Spacing, radii, borders, shadows, z-index** → `FOUNDATIONS.md`
- **Type roles** → `TYPOGRAPHY.md`
- **Timing, easing, spring tokens** → `MOTION.md`

Component docs list the tokens they consume; they never redefine a token.

## Component doc contract

Every component file contains, in order: Purpose · Anatomy (+ASCII) · Component API ·
Required design tokens · States · Spacing · Typography · Interaction · Gestures ·
Responsive behavior · Keyboard behavior · Animation specification · Accessibility ·
Accessibility checklist · Acceptance criteria · Do · Don't.

## Ambiguities flagged during decomposition

Resolved per the standing rule (flag, propose the smallest change consistent with
`DIRECTION.md`, do not invent). None weakens the certainty model or the one-accent rule.

1. **Hotel Thread "per-city hue" was undefined.** See `COMPONENTS/HotelThread.md` →
   *Ambiguity*. Resolved with a fixed 4-tone **low-chroma neutral** ramp (never saturated,
   never near `--accent`), assigned deterministically, so city stays are distinguishable
   without introducing a second accent.
2. **Cord thread thickness "up to 4px where density is high" had no thresholds.** See
   `COMPONENTS/Cord.md` → *Ambiguity*. Resolved with objective stop-count bands.
3. **Countdown "near" threshold was qualitative (~2 weeks).** Objectified to `≤14 days`
   (`COMPONENTS/Countdown.md`).
4. **"Component API" for a no-framework, single-file app.** Specified as a framework-agnostic
   contract (inputs / state / events), not a framework prescription. See `IMPLEMENTATION.md`.
5. **"Editorial rhythm / intentional spacing" was subjective.** Objectified in
   `FOUNDATIONS.md` → *Editorial rhythm rules* while preserving the principle.

## Production reconciliation (authoritative token mapping)

During implementation the production `:root` in `index.html` (protected by `PROJECT.md §12.3`,
hand-calibrated for AA) is the ground truth for token **names and values**. Where a module here
drifted, production wins; the mapping of record:

- The hairline/border token is **`--line`** (`#e7e2d4` / `#2e2c37`). `--hairline`/`--border` exist
  as additive aliases of `--line`; no rename.
- Calibrated semantics: `--indigo #2b4a7a/#8aa8d8`, `--gold #a07310/#d3a53a`, `--green #38724f/#72b18e`,
  `--teal #26798d/#5db6c9`; soft variants `--accent-soft/--indigo-soft/--green-soft` exist and are kept.
- Base durations are `--dur-1/2/3` (120/180/240ms); `--dur-press/-fast/-base` are additive aliases;
  ceremony durations `--dur-zoom/-drawer/-bloom/-line/-hold` are new.
- `--accent-text` is the dark elevated accent-as-small-text tone (`#f08b72`), now a token.
- Phase 11.5 added: the `--space-*` scale, `--radius-pill`, the `--z-*` scale (names for existing
  literals), the Foil edge tokens, the `--stay-*` Hotel Thread ramp, and the `.m-*`/`.u-*` classes.

## Relationship to root `DESIGN.md`

Root `DESIGN.md` is retained as the historical monolith. This `design/` set supersedes it
for all build work. **Recommendation (pending owner decision): replace root `DESIGN.md`
with a one-line pointer to `design/README.md`, or archive it.** Not done automatically.
