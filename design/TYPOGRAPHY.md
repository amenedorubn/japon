# Typography

Families, type scale, tabular numbers, Japanese & tategaki rules. Source of truth for type
roles. Refactor of `DESIGN.md §3`, rules unchanged.

## 1. Families

- **Inter** — all working UI: titles, labels, body, data, controls. The invisible workhorse.
- **Noto Serif JP** — emotional & Japanese moments only: Countdown, city names, Threshold,
  Memory hero, The Rail. **Never** in a control, label, or list row.

The serif's rarity is its power. Serif in ordinary UI is a defect.

## 2. Type scale

| Role | Family | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | Noto Serif JP | 72 / 76 | 500 | −0.01em | Launch countdown, Memory hero number |
| `display` | Noto Serif JP | 64 / 68 | 500 | −0.01em | Countdown Face (pre-trip) |
| `city` | Noto Serif JP | 28 / 32 | 500 | 0 | Day view city name, Threshold |
| `title` | Inter | 22 / 28 | 600 | −0.01em | screen titles |
| `label` | Inter | 13 / 16 | 600 | +0.02em | section labels (sentence case, never all-caps) |
| `body` | Inter | 15 / 22 | 450 | 0 | reading text, stop names, tips |
| `secondary` | Inter | 13 / 18 | 400 | 0 | sub-lines, categories |
| `data` | Inter | 12 / 14 | 500 | +0.01em | times, dates, prices, counts (**tabular**) |
| `caption` | Inter | 11 / 14 | 500 | +0.01em | smallest permitted; meta only |

- **11px is the legible floor.** Nothing renders below it.
- `text-wrap: balance` on `title`, `city`, `display`, `display-xl`. `text-wrap: pretty` on `body`.
- Display tracking floor: **≥ −0.04em** (scale uses −0.01em). Never tighter.
- Weight and color carry hierarchy before size does.

## 3. Tabular numbers

`font-variant-numeric: tabular-nums` is **mandatory** for: the Countdown, all times, dates,
day indices, prices, counts, distances (km), and any value that updates in place. Numbers
must never shift horizontally as they change.

## 4. Japanese typography

- Japanese uses **Noto Serif JP** exclusively; never Inter.
- Japanese appears only as **real place names** (cities, districts) and the Threshold phrase.
  Never as UI labels, body copy, or decoration.
- Kanji for a place is always the correct real name. No invented/decorative kanji.

## 5. Tategaki (vertical Japanese)

Used by The Rail and the Countdown Face destination.

- `writing-mode: vertical-rl; text-orientation: upright;` for kanji/kana.
- **Only ever names a real place** (destination city, current city). If it names nothing true,
  it is deleted.
- Set in `--muted` at low contrast (informing texture), except the Countdown Face destination
  which may reach `--ink`.
- Placed in the right margin, clear of interactive content; never wraps to two columns.
- **Latin text is never rotated vertical.** Tategaki is Japanese script only.
- One place name per Rail. It is a column, not a paragraph.
