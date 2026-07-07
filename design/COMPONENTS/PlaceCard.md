# Place Card

## Purpose
A place in Ideas (Exploration). The unit of the idea feed. Refactor of `DESIGN.md §5.9`.

## Anatomy
Washi card, editorial (varied heights: hero 220, standard 140, compact 100), image or category
glyph, name, one `secondary` line, faint source watermark (provenance whisper).

```
┌────────────────────┐   Washi (flat, no shadow, --card2)
│  [image / 🍵]       │
│  Uji                │   name --muted (provisional)
│  té · Kansai        │   secondary
│                de Dani ← faint provenance watermark
└────────────────────┘
```

## Component API
```
renderPlaceCard(place: Place, {
  size: 'hero'|'standard'|'compact',
  onTap(): void,               // Place detail (Context Sheet)
  onPlant(dayIndex): void,     // firm swipe right / drag
  onQuizas(): void             // swipe left → maybe
}) → element
```
`Place` = `{ id, pid, name, category, region, image?, provenance:'ours'|'dani'|'instagram'|'ai' }`.

## Required design tokens
`--card2`, `--muted`, `--hairline`, paper-grain overlay, `--radius`, `--space-3/4`,
`spring-plant`, `--dur-bloom`. (No `--accent` — Washi earns no red.)

## States
Idea (Washi) · Lifting (drag) · Planting (Ink Bloom out) · Quizás (exits left). Empty feed →
EmptyState "Todo clasificado".

## Spacing
Internal `--space-4`. Feed uses varied vertical gaps (`--space-3`/`--space-4`), never a uniform
grid. Optional ≤0.5° rotation on the card (Washi).

## Typography
Name `body 15/600` in `--muted` (provisional); source `caption --muted`.

## Interaction
Tap = Place detail. Firm swipe right = Plant (Sift-in-place). Swipe left = Quizás. Drag to edge =
Pluck-and-Place onto the Plan.

## Gestures
Tap; firm swipe-right (plant); swipe-left (quizás); drag-to-plan.

## Responsive behavior
Editorial masonry: varied heights, single column ≤520; on wider screens the feed stays one
column (no equal grid), heights still varied. Region rail scrolls horizontally above the feed.

## Keyboard behavior
Focusable; `Enter`/`Space` opens detail. Plant and Quizás available as an action menu
(context/`Shift+F10`): "Plantar en día…", "Quizás". Never swipe-only.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Card | `transform` lift | rest → lifted + `--shadow-drag` | — | `spring-receive` lag | drag |
| Card | material | Washi → Ink | `--dur-bloom` | `--ease` | Plant (Ink Bloom) |
| Card | `transform` exit | rest → off-left + fade | 200ms | `--ease` (momentum) | Quizás |
Reduced motion: Plant = instant material swap; Quizás = instant remove.

## Accessibility
"Uji, té, de Dani, sin planificar. Acciones: plantar, quizás." Swipes have button equivalents.
Provenance stated once, quietly.

## Accessibility checklist
- [ ] Name + category + provenance + "sin planificar" announced.
- [ ] Plant / Quizás reachable by keyboard and AT.
- [ ] No accent color anywhere on the card.
- [ ] Provenance is `--muted`, never a colored badge.

## Acceptance criteria
- **Given** the Ideas feed, **then** cards are Washi, varied-height, grey, with no accent.
- **Given** a plant, **then** the card plays Ink Bloom and moves to the chosen day.
- **Given** a Quizás, **then** the card exits left with momentum and is retained as "maybe".
- **Given** reduced motion, **then** plant/quizás are instant.

## Do
Keep the whole feed quiet and grey (nothing here is the trip).
## Don't
Use equal-size cards. Add accent color. Show a permanent provenance badge.
