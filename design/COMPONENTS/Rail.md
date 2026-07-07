# Rail (vertical Japanese label)

## Purpose
Name a real place beautifully, in the margin, as the signature Japanese device. Refactor of
`DESIGN.md §5.14`.

## Anatomy
A single tategaki column (Noto Serif JP, `writing-mode: vertical-rl; text-orientation: upright`)
in the right margin, `--muted` low contrast (or `--ink` on the Countdown Face).

```
 content column                    margin
 …………………………………………………           東
 …………………………………………………           京
 …………………………………………………           （Tokio）
```

## Component API
```
renderRail(placeName: { kanji: string, romaji: string } | null, {
  emphasis: 'muted'|'ink'          // 'ink' only on Countdown Face
}) → element | null   // null when no real place in context
```

## Required design tokens
`--muted` (default), `--ink` (Countdown Face only), Noto Serif JP `city` role, right-margin
offset from `--space-5`/`--space-8`.

## States
Present (a real place is in context: destination pre-trip, current city during trip, day city in
Day view) · Absent (no real place → renders nothing).

## Spacing
Right margin, clear of all interactive content; never inside the content column. On `tablet`/
`desktop` it sits in the right ground.

## Typography
`city`-size Noto Serif JP, vertical (`vertical-rl`, `upright`). Japanese script only.

## Interaction
Non-interactive (a label, not a control).

## Gestures
None.

## Responsive behavior
Hidden below 360px width if it would overlap content. Widens into the right ground on larger
screens. Never overlaps a tap target.

## Keyboard behavior
Not focusable.

## Animation specification
Fades with its screen; no independent motion.
Reduced motion: no change (it has no motion).

## Accessibility
Marked `aria-hidden` when the place is already named elsewhere on screen (usual case); otherwise
it carries the place name as its label. Never the sole source of essential text.

## Accessibility checklist
- [ ] `aria-hidden` when the name is duplicated elsewhere (default).
- [ ] Only ever renders a real place name.
- [ ] Never overlaps interactive content or tap targets.
- [ ] No rotated Latin (Japanese script only).

## Acceptance criteria
- **Given** a real place in context, **then** the Rail renders its kanji vertically in the margin.
- **Given** no real place, **then** the Rail renders nothing.
- **Given** the name appears elsewhere on screen, **then** the Rail is `aria-hidden`.

## Do
Only ever render a true place name.
## Don't
Rotate Latin text. Use it as texture without meaning. Let it touch tap targets.
