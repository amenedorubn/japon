# CREATIVE DIRECTION
### The canonical design vision for the Japan companion

*Creative Director's document. Every design and engineering decision defers to this. When a
future choice contradicts this document, this document wins until it is deliberately amended.*
Enforceable specifics live in `DESIGN.md` and the modular system under `design/`.

**Thesis:** *This is not a planner. It is a certainty instrument for three friends, and the
whole trip is a single object you carry from possibility to memory.*

---

## 1. Product Identity
- **Is:** a shared companion for three friends taking one 21-day trip to Japan. Its organizing
  truth is **certainty**: every place lives on a line from *possibility* to *fact*, and the
  product's job is to help the three move things along that line, together, then live in the result.
- **Is not:** an itinerary app, productivity tool, dashboard, booking engine, social network, or
  guidebook. No metric, no growth loop, no upsell.
- **Feels:** calm, certain, quietly premium. A beautifully made physical object that is alive.
  Held, not operated. Dense yet unhurried.
- **Described after use:** "It doesn't feel like an app. It feels like *our* trip has a place to live."
- **Emotions:** *before* — anticipation you can see accumulating. *during* — presence. *after* —
  pride and memory. The identity is the arc **anticipation → presence → memory**; any feature
  must serve one of the three.

## 2. Visual Identity
Governing idea: **materiality equals certainty.** The more real a thing is, the more it materializes.
- **Materials:** *Washi* (Exploration): flat, no shadow, paper grain, muted, provisional. *Ink*
  (Planning): placed, resting shadow, full ink, accent only when "today". *Foil* (Confirmed):
  pressed, deepest elevation, foil edge, one specular sweep, carries the Seal. Shadow depth is a
  statement of certainty; nothing casts weight it hasn't earned.
- **Type:** Inter for all working UI; Noto Serif JP only for emotional/Japanese moments
  (countdown, city names, Threshold, memory). Its rarity is its power. Tategaki names only real places.
- **Space/composition:** 8px grid, editorial (not gridded) composition, negative space as material,
  one focal point per screen chosen by current need.
- **Light/depth/contrast:** single soft top light; tinted (never pure-black) shadows; shallow honest
  depth (page/placed/pressed); contrast matches certainty; AA floor verified both themes.
- **Themes:** *Sumi Night* (near-black, bone ink, vermilion, gold foil) is the signature/face.
  *Washi Day* (warm paper, sumi ink, vermilion) is the first-class working face.
- **Japan as material, never motif:** washi, sumi, one vermilion, serif and tategaki where they carry
  meaning. No cherry blossoms, rising suns, torii clip-art, faux-brush "zen".

## 3. Interaction Identity
One family, grammar = the certainty **Axis** (left looser, right more real, meaning travels rightward).
- Appear from themselves (origin-aware); never from `scale(0)`. Disappear faster, toward their meaning
  (demotion exits left). Move along the Axis with spatial consistency (nothing teleports). Strong
  ease-out for user-responsive motion; spring for the two transformations; linear for deliberate holds.
- Touch: everything pressable yields `scale(.97)` under 160ms. Drag: lift + receive (anticipation) +
  momentum, always with a tap equivalent. Confirmation: slow deliberate hold, instant on completion.
  Cancellation: guarded, reversible, exits left. Reduced motion collapses movement, keeps state legibility.

## 4. The Emotional Journey — the Seasons
The app evolves with the traveler; transitions between seasons are designed moments.
- **Planning** (months out): the whole trip visible; the work is allocation.
- **Countdown** (weeks out): the countdown grows, gains the serif and a daily pulse; gaps surface.
- **Threshold** (day 0): a one-time transformation from planner to companion. The emotional peak.
- **Companion** (during): opens on today; now-line, next stop, how to get there; end-of-day recap.
- **Memory** (after): the trip becomes a sealed, complete keepsake.
The app is never the same shape twice across the arc, but always the same object.

## 5. Iconic Moments (identity; non-negotiable)
1. The Cord (whole trip as one object). 2. Ink Bloom (idea becoming plan). 3. The Foil Press
(certainty you feel). 4. The Threshold. 5. The Countdown Face (serif + tategaki). 6. A friend's mark
in the Seal. 7. An idea arriving live. 8. The Zoom (continuous altitude). 9. The end-of-day recap.
10. The Memory object.

## 6. Design Rules (absolute)
1. Certainty always feels heavier. 2. Red is earned (action/selection/now/seal only; never on Washi).
3. Exploration never feels finished. 4. Rightward means more real. 5. Every animation communicates a
state change. 6. Motion is spent by frequency; one ceremony (Foil Press). 7. Negative space is
intentional. 8. One focal point per screen. 9. The serif is rare. 10. Japan is material, never motif.
11. Provenance is a whisper. 12. Prices never sit on screen. 13. Every gesture has a one-handed tap
equivalent. 14. The app is a keepsake, not a service. 15. Three, always.

## 7. We Never Do This
KPI dashboards / stat rows · equal card grids · permanent badges · feature-first (tabs of nouns)
navigation · a Home tab · information walls · loud prices · Material-Design defaults · skeuomorphic
kitsch · spinners · confetti/mascots · onboarding tours · notification bait · novelty that becomes friction.

## 8. Design Vocabulary
**Structures:** The Cord · The Axis (Ideas ← Plan → Wallet) · Ideas · The Plan · The Wallet · The
Altitudes (Trip/Day/Stop). **Interactions:** The Zoom · Plant · Pluck-and-Place · Ink Bloom · The Seal ·
Foil Press · The Mark · Quizás · The Budget Peek · Sift. **Moments:** The Threshold · The Countdown Face ·
The Now-Line · The Recap · The Keepsake · The Seasons. **Materials:** Washi · Ink · Foil · Sumi Night ·
Washi Day · The Rail.

## 9. Final Critique — what survives Ive, Rams, Linear, Flighty, Arc
Kept after all five: (1) certainty is the product (the Axis, rightward = more real); (2) materiality =
certainty (Washi→Ink→Foil); (3) red is earned; (4) the Cord reduced to its honest function (trip as one
object, unbroken hotel thread, density-as-thickness; expressive flourishes cut); (5) the two
transformations + one ceremony (Ink Bloom, Foil Press, machined not staged); (6) the Seasons trimmed to
truth (countdown/Threshold amplified but only on real information); (7) **Confirmed is a state, not a
place** (surfaces contextually; the Wallet is a summon) — the one structural change resolved under
critique; (8) co-authored certainty and per-traveler warmth; (9) the fast, quiet loop (add/time/reorder
must be fast and keyboard-capable; the metaphor never slows the work; zero modes); (10) Japan as material,
restraint as taste, longevity as the test. Everything on this list is the identity and is defended for
years; everything else is negotiable.
