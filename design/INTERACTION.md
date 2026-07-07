# Interaction Grammar

The Axis, Zoom, Plant, Foil Press, contextual surfaces, edge-swipe. One grammar shared by the
whole app. Refactor of `DESIGN.md §7`, rules unchanged.

## 1. Right means more certain

The Axis runs **Ideas ← Plan → Confirmed**. Moving or swiping **right** always means "more
real." Sealed things live to the right (or surface contextually as Confirmed). Holds at every
scale: app navigation, an object migrating on Seal, the edge-glow color.

## 2. Left means less certain

**Left** means "less real": demotion, unplacing, Quizás, cancellation. Leftward motion is
quick and clean; cancelling certainty is guarded by confirmation.

## 3. The Zoom

Altitude changes (Trip ↔ Day ↔ Stop) are shared-element transitions (MOTION.md §5). The user
always sees where they came from; nothing teleports. Zoom in grows from the tapped element;
zoom out returns it to its place.

## 4. Plant (Exploration → Planning)

Tap-path (choose a day from the ribbon-strip) or Pluck-and-Place (drag). Either input yields
the same reward: **Ink Bloom** (Washi→Ink, `spring-plant`). Provenance never changes; only
material and position on the Axis change.

## 5. Foil Press (Planning → Confirmed)

A deliberate **hold** (MOTION.md §8). Slow while the user commits, instant on completion. The
object gains Foil, a Seal, and The Mark, then migrates right / surfaces as Confirmed. The
single ceremony.

## 6. Contextual surfaces

Confirmed is a **state, not a destination** (`DIRECTION.md §9` resolution). Sealed passes
surface **on their day** in the Plan (flight at the top of the flight day; hotel at the
night's foot). The Wallet vault is a **summon** (swipe right / pull) to see everything certain
at once, not a tab the user must live in. The two lived-in regions are **Ideas** and **Plan**.

## 7. Edge-swipe behavior

- Horizontal edge-swipe switches Axis position (Ideas ← Plan → Confirmed vault), `--dur-fast`,
  lateral slide (`opacity` + 24px `translate`).
- A **2px edge glow** appears only mid-drag: pencil-grey on the left (toward Ideas), `--accent`
  on the right (toward Confirmed) — the color teaches the certainty direction.
- Edge-swipe **yields** to in-content horizontal gestures (carousel, slider): if content claims
  the horizontal axis, region-swipe is suppressed for that element.
- Velocity commits (a flick is enough); an incomplete drag springs back.

## 8. Grammar invariants (do not break)

- Direction is meaning. Rightward = more certain, at every scale, always.
- Every transformation has a named reward (Ink Bloom, Foil Press) and a guarded reverse.
- Every gesture has a non-gesture equivalent (tap/keyboard).
- Nothing teleports; continuity (shared element) is preserved across altitude and region.
