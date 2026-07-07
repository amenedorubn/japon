# Accessibility

Non-negotiable. Verified in both themes and both input modes before ship. Refactor of
`DESIGN.md §8`, rules unchanged. Component-specific checklists live in each component doc.

## 1. Touch targets

- **≥ 44 × 44** for every interactive element. Command Dot 52; scrubber ticks and day-chips
  ≥44; Foil Pass tap area full-width.
- Spacing ensures no two 44px targets overlap. Where visuals are smaller (6px dots, 10–12px
  nodes), the *hit area* is padded to ≥44 while the visual stays small.

## 2. Dynamic Type

- Text scales with the OS setting; layouts reflow (single column + editorial rhythm absorb it).
- Tabular alignment preserved. No essential text truncates. Cord/Day rows grow in height rather
  than clip. Test at the largest standard step.

## 3. VoiceOver / screen readers

- Every interactive element has a **concrete accessible name that names its object** ("Sellar
  hotel APA", never "Sellar").
- Reading order follows visual order, top → bottom.
- Materials, threads, and The Rail are **decorative** to AT when their state is already carried
  by a text label; otherwise they carry the label.
- Sheets are dialogs: focus trap, focus returns to the trigger on close, `Esc`/back dismisses.
- Live regions announce day changes and the daily countdown, **not** every render.

## 4. Reduce Motion

- Full behavior in MOTION.md §9. The app is completely usable and fully legible with motion off.
- **No state is motion-only.** Certainty, "now", done, and every transition are also carried by
  material, color, position, or text.

## 5. Color blindness

Color never carries meaning alone:
- Certainty = material + elevation (not just red).
- "today"/"now" = position + Now-Line + label (not just accent).
- done = green node **+** check **+** muted text.
- transport mode = label (not just dot color).
- Red is backed by the Seal/Foil **form** and by action **labels**.

## 6. One-handed reach

- Primary actions live in the bottom thumb zone (below ~500px on the 390 frame): Command Dot,
  sheet primary actions, day-scrubber.
- The top holds titles and read-only context, never the only path to a primary action.

## 7. Offline behavior

Offline-first. On no connection:
- Cached content renders normally.
- Unresolved data shows **Skeletons** that resolve when possible — never an error wall.
- Route/geocode features degrade quietly (inline "sin conexión", not a blocking modal).
- Edits are accepted locally and reconcile later.
- Nothing about being offline feels broken.

## 8. Keyboard (desktop)

- Logical tab order matches visual order. Visible `:focus-visible` ring (`--ring`) on every
  focusable element; ring follows the element's radius.
- `Enter`/`Space` activate; `Esc`/back dismiss overlays.
- Component-specific keys (arrow scrub, reorder, region switch) are defined in each component's
  *Keyboard behavior* section.
- Every drag/swipe interaction has a keyboard path.
