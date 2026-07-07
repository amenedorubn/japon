# Materials

Washi, Ink, Foil: the visible form of certainty. Recipes, allowed transitions, forbidden
combinations. Refactor of `DESIGN.md §4`, rules unchanged.

An object is in exactly one material state at a time. Material is never mixed within a single
object. This is the foundation of the product (`DIRECTION.md §6`).

## 1. Washi (Exploration)

**Recipe**
- background: `var(--card2)`
- overlay: 3% paper-grain texture, static (non-scrolling), `pointer-events: none`
- edge: `0.5px solid var(--hairline)`
- text: `var(--muted)`
- shadow: **none**
- radius: `var(--radius)`
- optional rotation: ≤ 0.5° on free-floating idea cards only; never on list items

**Feel:** loose, flat, provisional, slightly imperfect. Reads as *not yet the trip*.
**Accent:** none. Washi never carries `--accent` or any semantic hue.

## 2. Ink (Planning)

**Recipe**
- background: `var(--card)`
- shadow: `var(--shadow)` (Plane 1)
- text: `var(--ink)`
- radius: `var(--radius)`
- border: none
- accent: only when the object is "today" → 1px `var(--accent)` left edge + now dot

**Feel:** committed to the page, placed, has weight but not permanence.

## 3. Foil (Confirmed)

**Recipe**
- background: `var(--card)`
- shadow: `var(--shadow-lg)` (Plane 2, includes inset top highlight)
- foil edge: 1px inner stroke, `var(--foil-edge-red)` (or `var(--foil-edge-gold)` for flights)
- specular sweep: static ~8% white linear-gradient, top-left origin, across the surface
- seal: carries the Seal mark + The Mark (sealer monogram)
- radius: `var(--radius)`

**Feel:** milled into the surface, precise, permanent. Only material that carries a Seal.

## 4. Allowed transitions

| From | To | Transition | Trigger | Spec |
|---|---|---|---|---|
| Washi | Ink | **Ink Bloom** | Plant | MOTION.md §Ink Bloom |
| Ink | Foil | **Foil Press** | Seal (hold) | MOTION.md §Hold |
| Ink | Washi | reverse bloom (desaturate) | unplace (guarded) | instant material swap + exit left |
| Foil | Ink | reverse press (lift out) | cancel booking (guarded, confirmed) | MOTION.md §Hold reverse |

Upward transitions (toward certainty) are rewarding and animated. Downward transitions are
guarded, quick, and exit leftward (see INTERACTION.md).

## 5. Forbidden combinations

- **No shadow on Washi.** Provisional things cast no weight.
- **No accent or semantic hue on Washi.** Red is earned; Washi has earned nothing.
- **No Foil edge or Seal on anything not Confirmed.**
- **No mixed materials in one object.** A card is Washi *or* Ink *or* Foil.
- **No nested materials.** A material surface never contains another material surface as a
  child. Materials sit as siblings.
- **No border + wide shadow on the same element** (ghost-card defect). One treatment per material.

## 6. Material decision table (implementation)

| Object certainty | Material | Shadow | Text | Accent allowed? |
|---|---|---|---|---|
| Exploration (idea, seed) | Washi | none | `--muted` | no |
| Planning (planned stop/day) | Ink | `--shadow` | `--ink` | only "today" edge/dot |
| Confirmed (flight, booked hotel, doc) | Foil | `--shadow-lg` | `--ink` | seal + foil edge |
