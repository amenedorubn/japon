# Skeleton

## Purpose
Loading in the shape of the content. Never a spinner. Refactor of `DESIGN.md §5.13`.

## Anatomy
Material-shaped placeholders: Washi rectangles in Ideas, Cord thread + node skeletons on the
Plan, emboss silhouettes in the Wallet. A slow shimmer sweeps once per ~1.4s.

```
Ideas            Plan               Wallet
�(washi)▏         │ ●▁▁▁▁▁            ▉▉▉▉▉▉ (emboss)
▁▁▁▁▁▁           │ ●▁▁▁▁             ▉▉▉▉▉▉
▁▁▁▁             │ ●▁▁▁▁▁▁           (seal fades last)
```

## Component API
```
renderSkeleton(shape: 'ideas'|'plan'|'wallet'|'sheet', { count?: number }) → element
```

## Required design tokens
`--card2` (base), a shimmer gradient (~8% ink over base), `--radius`, `--dur-line` (Cord draw),
matching spacing tokens of the real content.

## States
Loading · Resolving (real content crossfades over the skeleton).

## Spacing / typography
**Matches the final layout exactly** so there is no layout shift on resolve (CLS ~0).

## Interaction
None.

## Gestures
None.

## Responsive behavior
Mirrors the real component's responsive rules (same column, same heights), so the resolved view
occupies the identical box.

## Keyboard behavior
Not focusable. The region is `aria-busy` while loading.

## Animation specification
| Element | Property | From → To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Shimmer | `transform: translateX` | sweep | ~1.4s loop | `linear` | loading |
| Cord skeleton | thread draw | top-down | `--dur-line` | `--ease` | loading |
| Content | `opacity` crossfade | skeleton → real | `--dur-base` | `--ease` | resolve |
Reduced motion: static skeleton, no shimmer; crossfade to content.

## Accessibility
`aria-busy="true"` on the region; announce "cargando" once, not per block. Respect reduced
motion (static). On resolve, `aria-busy="false"`.

## Accessibility checklist
- [ ] `aria-busy` set/cleared correctly.
- [ ] Single "cargando" announcement, not per-block.
- [ ] Shimmer removed under reduced motion.
- [ ] Shape matches final layout (no shift).

## Acceptance criteria
- **Given** a loading region, **then** a shape-matched skeleton renders (no spinner) and resolves
  with zero layout shift.
- **Given** the Plan, **then** the Cord skeleton draws its thread top-down.
- **Given** reduced motion, **then** the skeleton is static and crossfades to content.

## Do
Match the final shape precisely.
## Don't
Use a spinner or a blank flash.
