# Color System

Token hierarchy, semantic colors, both themes, accessibility. Source of truth for all color
tokens. Refactor of `DESIGN.md §2`, rules unchanged.

## 1. Token hierarchy

Three tiers. Components reference **only semantic tokens**, never primitives.

1. **Primitive** — raw palette. Not used directly in components.
2. **Semantic** — role tokens (`--bg`, `--ink`, `--accent`, …). The build surface.
3. **Component** — a component may define a local token mapping to a semantic
   (e.g. `--cord-thread: var(--muted)`), never to a primitive.

## 2. Semantic tokens — Washi Day (light) / Sumi Night (dark)

| Token | Washi Day | Sumi Night | Role |
|---|---|---|---|
| `--bg` | `#f6f4ee` | `#131217` | page ground |
| `--card` | `#fffefb` | `#1c1b22` | Ink & Foil surface |
| `--card2` | `#f9f7f1` | `#232129` | Washi surface, sunken panels |
| `--ink` | `#26221a` | `#ece7db` | primary text, Ink material text |
| `--muted` | `#6d6557` | `#a49d8e` | secondary text, Washi text, provenance whisper |
| `--accent` | `#bf3823` | `#cf4530` | action, selection, "now", Seal (vermilion) |
| `--accent-text` | `#bf3823` | `#f08b72` | accent as small text on dark (elevated tone) |
| `--gold` | `#a8802f` | `#d8b567` | flights: Foil edge & Cord clasps |
| `--indigo` | `#4a5b8f` | `#8f9ed6` | transport segments |
| `--green` | `#3f7d4f` | `#7bbf88` | done / completed nodes |
| `--teal` | `#2f7d7d` | `#6fc0c0` | ferry transport |
| `--hairline` | `rgba(38,34,26,.14)` | `rgba(236,231,219,.16)` | edges, dividers |
| `--ring` | `--accent` @ 45% | `--accent` @ 55% | focus ring |
| `--scrim` | `rgba(19,18,23,.55)` | `rgba(0,0,0,.6)` | image scrim, sheet backdrop |

Primitive ramps (reference only, never in components):
accent `#8f2417 / #bf3823 / #cf4530 / #f08b72`; paper `#f6f4ee / #f9f7f1 / #fffefb`;
sumi `#0f0e13 / #131217 / #1c1b22 / #232129`.

## 3. Semantic color rules

- **Red is earned.** `--accent` only on: primary action, current selection, "today"/"now",
  a Seal (Foil edge, seal mark). **Never on Washi.**
- **Gold is flights only.** `--gold` marks flight Foil edges and Cord clasps. Nowhere else.
- **Semantic dots** (`--indigo`, `--green`, `--teal`) convey real state only, at 6px, always
  backed by a label or shape (never color-alone; see ACCESSIBILITY.md).
- **Provenance is `--muted`, always.** Never a semantic hue or the accent.
- **One accent per screen.** No screen introduces a second saturated hue. (The Hotel Thread
  neutral ramp in `COMPONENTS/HotelThread.md` is low-chroma and is *not* an accent.)

## 4. Accessibility & contrast requirements

| Content | Requirement |
|---|---|
| Body text (`--ink` on `--bg`/`--card`) | ≥ 4.5:1 |
| Secondary text (`--muted`) | ≥ 4.5:1 against its actual background |
| Large text (≥18px, or ≥14px bold) | ≥ 3:1 |
| Accent as small text | use `--accent-text` on dark; never `--accent` below 18px on dark |
| White on `--accent` (buttons) | ≥ 4.5:1 (calibrated 5.5:1 light / 4.6:1 dark) |
| Focus ring vs. background | ≥ 3:1 |
| Placeholder / helper text | ≥ 4.5:1 (never lighter than `--muted`) |
| Non-text UI (dividers, node rings, meaningful icons) | ≥ 3:1 |

- Both themes are first-class. Every requirement is verified by hand in **both** before ship.
- Highest-risk pair: `--muted` on `--card2` (Washi text on sunken panel). Verify explicitly;
  if it fails, darken toward `--ink`, never lighten for "elegance".
- Never encode meaning in hue alone (see ACCESSIBILITY.md → Color blindness).
