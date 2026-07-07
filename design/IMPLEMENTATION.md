# Implementation Blueprint

Transition from design specification to an executable plan. Framework-agnostic and consistent
with the project's constraints (single-file vanilla app, no build, `renderX()` + `addEventListener`
pattern, DOM-hook test contract). This document defines **how** the system is built; it changes
**no** product vision and touches **no** data/sync policy (those remain owned by `PROJECT.md`).

Scope note: "Component API" and "state machines" below are UI-layer contracts. They do not
prescribe a framework and do not alter the Firebase write policy, the 21-fixed-days model, or any
invariant in `PROJECT.md`.

---

## 1. Component architecture

**A component is a stateless view + a bind step.** This matches the existing app's `renderX()`
pattern and the DOM-hook test contract (`PROJECT.md §12.4`), which must be preserved.

```
component = {
  render(data, config) -> HTMLString | Element   // pure; no app-state reads
  bind(root, handlers)                            // attach listeners after render
}
```

Rules:
- **Views are pure.** They receive everything as arguments; they never read global app state
  directly. App state is assembled by the screen, passed down.
- **Handlers are injected.** Every interaction is a callback in `config`/`handlers`
  (`onTap`, `onPlant`, `onSeal`…). Components emit intent; the screen/app performs it.
- **Transient interaction state is local.** Drag position, hold progress, sheet open/close live
  in the component's controller, not in app state, and are torn down on unbind.
- **DOM-hook contract preserved.** Existing ids, hook-classes, `data-pid`, and template strings
  the tests depend on are retained; new components expose the same contract where they replace
  old ones. Any template change updates `tests/` in the same commit (`PROJECT.md §12.4`).
- **One component owns one file** (`COMPONENTS/*.md` → one render module each).

Layering (bottom → top):
```
tokens (CSS vars)
  └ material + motion primitives (CSS utilities, controllers)
      └ leaf components (Stop, PlaceCard, FoilPass, …)
          └ composite components (DayNode, Cord, Wallet stack)
              └ screens (Plan, Ideas, Wallet) + Axis/Zoom orchestration
                  └ seasons (phase adaptation)
```

---

## 2. Design token structure

Three layers of CSS custom properties. **Token names are an API: never rename, only add**
(`PROJECT.md §12.3`).

```
:root {
  /* 1. PRIMITIVES — private, never referenced by components */
  --_accent-500: #bf3823;  --_sumi-900: #0f0e13;  … (underscore-prefixed)

  /* 2. SEMANTIC — the build surface (COLORS.md / FOUNDATIONS.md / TYPOGRAPHY.md / MOTION.md) */
  --bg; --card; --card2; --ink; --muted; --accent; --accent-text; --gold; --indigo;
  --green; --teal; --hairline; --border; --ring; --scrim;
  --space-0…--space-16; --radius; --radius-s; --radius-sheet; --radius-pill;
  --shadow; --shadow-lg; --shadow-overlay; --shadow-drag;
  --z-chip; --z-bar; --z-sheet; --z-toast; --z-drag;
  --dur-instant…--dur-hold; --ease; --ease-io; --ease-drawer;
}
[data-theme="dark"] { /* Sumi Night overrides of the SAME semantic names */ }

/* 3. COMPONENT-LOCAL — map to semantic only, scoped to the component */
.cord { --cord-thread: var(--muted); }
.hotel-thread { --stay-1: …; --stay-2: …; --stay-3: …; --stay-4: … }
```

Theming:
- `data-theme` on the root is set by the pre-paint head script (avoids flash) and the theme
  toggle. Both themes are complete; no component hard-codes a hex.
- Spring values (`spring-plant`, etc.) are documented in `MOTION.md`; expressed in JS controllers
  (WAAPI) since CSS has no spring. Duration/easing tokens cover all CSS transitions.

Naming conventions:
- Semantic: role name (`--muted`, `--shadow-lg`). No component or hex in the name.
- Component-local: `--{component}-{role}`.
- Primitive: `--_{ramp}-{step}` (underscore = private).

---

## 3. Animation primitives

A small reusable set. Everything animates `transform`, `opacity`, or `clip-path` only. A global
reduced-motion gate neutralizes movement while preserving state legibility.

| Primitive | Form | Used by |
|---|---|---|
| **press** | global `:active { transform: scale(.97) }`, `--dur-press` `--ease` | every pressable |
| **shared-element (FLIP)** | measure source rect → animate to target rect via `transform` | The Zoom, FoilPass expand |
| **ink-bloom** | material class swap (Washi→Ink) + `--shadow` fade over `--dur-bloom` | Plant |
| **foil-press** | hold controller: `clip-path` fill (`--dur-hold` linear) → deboss + edge line-draw + specular | Seal |
| **drag-controller** | pointer capture, velocity (`>0.11 px/ms` commits), boundary damping, `spring-*` settle | Stop reorder, Pluck-and-Place |
| **reveal/stagger** | `whileInView`-style opacity+`translateY`, 40–60ms stagger | lists, Wallet fan |
| **line-draw** | `stroke-dashoffset` / `clip-path` reveal, `--dur-line` | Cord thread, foil edge |
| **number-ticker** | tabular digit roll | Countdown, Recap |
| **reduced-motion gate** | `@media (prefers-reduced-motion: reduce)` collapses movement to crossfade | global |

Primitive contracts are shared so every component's motion "belongs to the same family"
(`DIRECTION.md §3`). No component writes bespoke easing/timing; it composes these.

---

## 4. State machines (interactive components)

### 4.1 Certainty lifecycle (the core FSM, place-level)
```
        Plant (Ink Bloom)         Seal / Foil Press (hold)
EXPLORATION ───────────► PLANNING ───────────────────────► CONFIRMED
   (Washi)  ◄───────────  (Ink)   ◄───────────────────────  (Foil)
        unplace (guarded)         cancel booking (guarded confirm)
```
- Provenance is orthogonal and **immutable** across all transitions (`PROJECT.md §12.13`).
- Rightward transitions are rewarded + animated; leftward are guarded + quick + exit-left.

### 4.2 Foil Press (hold) FSM
```
idle ─press─► pressing ─120ms─► filling ─(release <100%)─► cancelling ─► idle
                                   │
                                   └─(fill 100%)─► sealing ─► sealed(Foil)
```
Guards: `sealing` is irreversible-feeling; reverse requires a separate confirm. Keyboard path:
`filling` may be satisfied by a hold or an explicit confirm (accessibility).

### 4.3 Drag / Plant FSM
```
idle ─longpress/grab─► lifted ─move─► dragging ─over valid day─► receiving
                                          │                          │
                                          └─release (no target)──────┘─drop─► planting(Ink Bloom) ─► placed
                                                   │
                                                   └─► returning ─► idle
```
Velocity flick from `dragging` commits to nearest valid target. `receiving` = target anticipation.

### 4.4 Zoom / altitude FSM
```
TRIP ◄──zoom out──► DAY ◄──zoom out──► STOP
   ──tap day──►        ──tap stop──►
```
Each edge is a shared-element transition; back always returns to the source rect.

### 4.5 Axis / region FSM
```
IDEAS ◄─swipe/←─► PLAN ◄─swipe/→─► CONFIRMED(vault)
```
`PLAN` is the default/home. Region switch is lateral slide; yields to in-content horizontal
gestures. Confirmed is a summon, not a required residence.

### 4.6 Context Sheet FSM
```
closed ─open(origin)─► entering ─► open ─dismiss(pull/backdrop/Esc)─► dismissing ─► closed
```
Focus trapped in `open`; returned to trigger on `closed`.

### 4.7 Load FSM (every async region)
```
loading(Skeleton) ─resolve─► ready
        │
        └─offline─► ready(cached) + inline notice   (never an error wall)
```

---

## 5. Implementation order (foundations → screens)

Strictly bottom-up; each stage is shippable and testable before the next.

**Stage 0 — Tokens & themes.** All semantic tokens in `:root` + `[data-theme="dark"]`; pre-paint
theme script; contrast verified both themes. *Exit:* every token resolves; no hard-coded hex.

**Stage 1 — Material & motion primitives.** Washi/Ink/Foil recipes as classes; the animation
primitives in §3; the global reduced-motion gate. *Exit:* a static swatch page shows all three
materials and each primitive in isolation, reduced-motion verified.

**Stage 2 — Leaf components.** Stop, Transport, PlaceCard, FoilPass, Rail, Skeleton, EmptyState,
CommandDot. Each with its full states, keyboard path, a11y checklist green. *Exit:* each renders
standalone and passes its Acceptance criteria.

**Stage 3 — Composite structures.** DayNode, HotelThread, Cord, Wallet stack. *Exit:* the Cord
renders 21 days with the unbroken Hotel Thread; The Zoom (Trip↔Day) works with shared elements.

**Stage 4 — Overlays.** ContextSheet (Place detail), BudgetPeek. *Exit:* Stop→Place detail Zoom;
budget summon/dismiss; focus management correct.

**Stage 5 — The three verbs.** Plant (Ink Bloom, tap + drag), Foil Press (hold ceremony),
guarded reverses. *Exit:* Certainty lifecycle FSM fully traversable both directions.

**Stage 6 — Axis & screens.** Ideas / Plan / Confirmed(vault) with edge-swipe; contextual
surfacing of Confirmed on its day. *Exit:* Axis FSM works; Confirmed surfaces contextually.

**Stage 7 — Seasons.** Countdown Face; phase adaptation (planning / countdown / threshold /
companion / memory); Now-Line; end-of-day Recap; the Threshold transition. *Exit:* the app
presents the correct season for a given trip date.

**Stage 8 — Polish & QA.** Full Dynamic Type, VoiceOver pass, offline behavior, one-handed reach,
the Design QA Checklist per screen. *Exit:* `DESIGN.md §9` checklist green on every screen, both
themes, reduced-motion and screen-reader verified.

Dependency rule: no stage begins until the prior stage's *Exit* holds. Each stage maps to its own
commit with the regression suite green (`PROJECT.md §10`).

---

## 6. What this blueprint deliberately does NOT decide

Out of scope here; owned elsewhere, unchanged:
- Data model, persistence, Firebase write policy, sync/merge → `PROJECT.md`.
- The 21-fixed-days model, provenance semantics, catalog fusion → `PROJECT.md`.
- Product vision, the three layers, the emotional arc → `DIRECTION.md`.

If building surfaces a genuine contradiction with those, stop and flag it (standing rule); do not
resolve it inside the design system.
