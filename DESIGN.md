# Okwan design system: Paper, Ink & Stamp

**Direction.** Okwan's visual world is the visa process itself, and the aim is to look nothing like a generic AI landing page:
- the passport's security print (guilloche line patterns) and its machine-readable zone
- ink stamps and forms
- the queue ticket
- Ghana's Adinkra cloth, which is itself printed by hand with carved stamps

This is the same move Plaid made with paper-currency engraving: take the look from the product's own world.

**Never use:** dark gradient heroes, glassmorphism, neon glows, blue-to-purple anything, rows of identical rounded cards, pill buttons everywhere, or a fade-up on every section.

## Tokens (see `src/app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#F3F0E8` | `#12120E` | page background |
| `card` | `#FBFAF6` | `#1A1A15` | documents, cards |
| `ink` | `#14140F` | `#ECE8DD` | text, rules, primary buttons |
| `muted` | `#5B584F` | `#A29E92` | secondary text |
| `line` | ink at 14% | ink at 16% | hairlines |
| `stamp` (green) | `#0B7447` | `#3FB57C` | brand accent, "approved", focus |
| `refuse` (red) | `#B83220` | `#EE6A55` | refusals and errors only |
| `gold` | `#C9920E` | `#E0B03A` | tiny accents (kente thread), never large fills |

## Type
- **Display: Archivo**, a variable font with width 62–125. Headlines are set condensed (`wdth 68`) and heavy (`wght 800`), in uppercase only for short labels. Tight tracking.
- **Voice: Newsreader italic.** Used only for what the officer says, which keeps "print" and "speech" visibly different.
- **Form: IBM Plex Mono.** Used for field labels, section numbers, timers, the machine-readable lines, queue numbers and data tables.
- **Body: Archivo** at normal width, 16–18px, line-height 1.55.

## Shape and texture
- **Corners:** 2–6px. These are documents, not bubbles.
- **Rules:** 1px ink rules and dashed "perforation" edges on tickets.
- **Guilloche:** a generated SVG line pattern, used faintly behind hero documents only.
- **Stamps:** a rotated border and mono label, "pressed" with a short scale-and-settle animation. Stamps mark real state (approved, 221(g), refused, recommended) and are never decoration.
- **Layout:** a 12-column grid used asymmetrically. Sections are numbered like a form ("PART 02 / 05").

## Motion
Motion has a purpose or it doesn't exist:
- typing for speech
- the stamp press for decisions
- hover states on interactive items

All motion respects `prefers-reduced-motion`.
