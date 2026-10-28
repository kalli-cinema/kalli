---
name: kalli
description: A festival catalogue screened in a dark room, driven from the couch with a gamepad.
colors:
  ground: "#13110e"
  ground-deep: "#0c0b09"
  ground-raised: "#1f1c17"
  ink: "#efe7d6"
  ink-2: "rgb(239 231 214 / 0.7)"
  ink-3: "rgb(239 231 214 / 0.52)"
  edition: "#f2b705"
  on-edition: "#13110e"
  alert: "#ff9a7a"
  boost: "#ff4d4d"
  shadow: "rgb(0 0 0 / 0.6)"
  art-outline: "oklch(1 0 0 / 0.1)"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "5.75rem"
    fontWeight: 800
    lineHeight: 0.9
    fontVariation: "'wdth' 64"
  title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 66"
  title-s:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 800
    lineHeight: 0.95
    fontVariation: "'wdth' 66"
  lead:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.85rem"
    fontWeight: 650
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 400
    lineHeight: 1.4
  meta:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 400
  hint:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 400
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    letterSpacing: "0.16em"
rounded:
  art: "0.35rem"
  key: "0.45rem"
  panel: "0.5rem"
  chip: "1.5rem"
  pill: "2.3rem"
spacing:
  hint-gap: "0.45rem"
  key-gap: "0.5rem"
  track: "1.25rem"
  stack: "2rem"
  head: "2.6rem"
  baseline: "2.75rem"
  gutter: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.edition}"
    textColor: "{colors.on-edition}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    height: "4.6rem"
    padding: "0 1.9rem 0 1.2rem"
  button-secondary:
    backgroundColor: "rgb(239 231 214 / 0.12)"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    height: "4.6rem"
    padding: "0 1.9rem 0 1.2rem"
  text-action:
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
  key:
    backgroundColor: "rgb(239 231 214 / 0.07)"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.key}"
    height: "4rem"
  key-focused:
    backgroundColor: "{colors.edition}"
    textColor: "{colors.on-edition}"
  keycap:
    backgroundColor: "color-mix(in oklab, currentColor 16%, transparent)"
    textColor: "{colors.ink-2}"
    typography: "{typography.hint}"
    rounded: "0.3em"
    height: "1.45em"
    padding: "0 0.4em"
  tab-season:
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
  tab-season-current:
    textColor: "{colors.edition}"
    typography: "{typography.label}"
  chip:
    backgroundColor: "rgb(239 231 214 / 0.08)"
    textColor: "{colors.ink-2}"
    typography: "{typography.hint}"
    rounded: "{rounded.chip}"
    padding: "0.6rem 1.2rem"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-edition}"
  list-row-focused:
    backgroundColor: "rgb(239 231 214 / 0.08)"
    rounded: "{rounded.panel}"
    padding: "1.1rem 1.25rem"
  copy-row-focused:
    backgroundColor: "{colors.edition}"
    textColor: "{colors.on-edition}"
    rounded: "{rounded.panel}"
    height: "5.5rem"
    padding: "0 1.25rem"
  input-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.panel}"
    height: "3.8rem"
    padding: "0 1.1rem"
  sheet:
    backgroundColor: "{colors.ground-deep}"
    width: "56rem"
    padding: "4rem 3.5rem 8rem"
  notice:
    backgroundColor: "{colors.ground-raised}"
    typography: "{typography.meta}"
    padding: "1.1rem 1.7rem"
---

# Design System: Kalli

## Overview

**Creative North Star: "Programa da Mostra"**

The library is a festival catalogue screened in a dark room. A warm, near-black ground stands in for the screening room, catalogue-ivory ink stands in for the printed page, and one edition yellow is printed flat for whatever the remote is touching. The posters bring every other colour, and when focus rests on a cover its colours bleed into the room as ambilight (a 48×27 canvas upscaled to the whole screen, with grain and a vignette over it).

The density is set for ten feet. The root size is one 120th of the screen width (`html { font-size: calc(100vw / 120) }`), so the composition is the same at 1080p and at 4K, and nothing that carries meaning is set under about 20px at 1080p. Hierarchy comes from brightness and scale, not chrome. Covers that aren't focused sit behind a dark veil, the focused one scales forward with a deeper shadow, and the text ranks itself through three ink strengths. Titles are set in Archivo condensed to about two thirds of normal width, at weight 800, in uppercase, like a catalogue's entry heads. Body text stays regular weight at normal width.

The 2:3 poster is the module. The home wall, the search grid and the entry page all use it, and the same artwork morphs from the wall into the entry through a shared-layout transition. Overlays (the cópias sheet, the full-page Perfil menu, the first-run Bem-vindo, the error notice) are the only places where surfaces stack.

**Key Characteristics:**
- Warm screening-room ground with three tonal steps; no cool greys.
- One flat accent (edition yellow) that marks focus, progress, the primary action and the running head.
- Condensed uppercase heavy titles over regular-weight body; tabular figures for measured values.
- Brightness and scale carry hierarchy; covers that aren't focused are veiled, not outlined.
- Fluid rem tied to viewport width; one fixed edge gutter (3.5rem).
- Focus answers in 150ms; dwell, travel and room colour take their time; nothing loops.

## Colors

The palette is a warm dark room, ivory print, and one yellow ink. Every neutral leans warm (hue around 80 in OKLCH).

### Primary
- **Edition Yellow** (`edition`): printed flat, never as a gradient or a glow. A profile may swap it for its own accent (Perfil → Aparência: orange, rose, violet, sky or emerald, Tailwind's 400 steps, all light enough for `on-edition` text); the swap changes `--edition` itself, so every rule below holds for the accent too. It marks the focused cover's underline mark, focused rail and episode titles, the progress meter, the focused cópia row, the focused key, the one primary action, the running head's section name, the current season, the "Cópia" field label, the text caret, `::selection`, and the 0.2rem focus-visible outline. Text on it always uses `on-edition`.

### Tertiary
- **Alarm Coral** (`alert`): only for something that went wrong, such as invalid fields, error lines, the destructive-confirm line and the notice icon. It never marks focus or emphasis.

### Neutral
- **Screening Room** (`ground`): the base of the app, the search screen, the detail backdrop under images, and input fills. It also feeds every scrim, written as `rgb(var(--ground-rgb) / α)`.
- **Projection Booth** (`ground-deep`): the darkest step. Sheets and the Perfil menu's options column use it, and so does the veil laid over covers that aren't focused (0.45 to 0.68 opacity).
- **Raised Ground** (`ground-raised`): the placeholder behind artwork that hasn't loaded, the typeset fallback cover, and the notice panel.
- **Catalogue Ivory** (`ink`): primary text. It also fills selected keys and chips, and the download meter.
- **Ivory 70** (`ink-2`): facts, credits, statuses, verdicts and the action hints of the focused entry.
- **Ivory 52** (`ink-3`): navigation hints, Nº, placeholders and inactive seasons.
- **Ink tints**: translucent ivory as a fill, never as a stroke. The scale is 0.07 (keys), 0.08 (chips, focused Perfil row and section), 0.12 (secondary action), 0.16 (meter track) and 0.25 (input stroke only).
- **Art Outline** (`art-outline`): a 1px inset hairline on every artwork so dark posters don't dissolve into the room.

### Named Rules
**The One Ink Rule.** Edition yellow is the only chromatic UI colour. Posters, and the ambilight they cast, carry every other colour. Coral is reserved for failure.

**The Yellow Means Here Rule.** Yellow says where the remote is or what A will do. An element at rest that the remote isn't touching gets ivory, never yellow. The fixed exceptions are the running-head section name, the "Cópia" field label and the current-season mark.

## Typography

**Display Font:** Archivo Variable (with system-ui, sans-serif), loaded with its width axis from `@fontsource-variable/archivo/wdth.css`.
**Body Font:** the same family, at normal width.

**Character:** a single variable grotesque that does two jobs. Condensed to about 64–68% width at weight 800, it is the catalogue's entry head. At normal width and regular weight, it is the reading text. The running-head label pushes the other way, expanded to 110%.

### Hierarchy
- **Display** (800, 5.75rem, 0.9, wdth 64, uppercase, balanced wrap): the entry page title, used when the addon supplies no logo.
- **Title** (800, 4.5rem, 0.95, wdth 66, uppercase): the wall baseline's focused title (one line, ellipsized), the search query field, and the house-lights title card.
- **Title S** (800, 3.25rem, 0.95, wdth 66, uppercase): sheet titles (cópias) and Perfil section titles.
- **Lead** (650, 1.85rem): the cópia line, the one sentence that says what will play.
- **Body** (400, 1.6rem, 1.4–1.5): synopses (62ch max on the entry page, clamped to 3 lines on the wall), verdicts (64ch) and keys.
- **Meta** (400 or 650, 1.45rem): facts, credits, field names, action labels and rail titles. Names and controls step up to 650.
- **Hint** (400, 1.3rem): button-glyph hints, statuses, captions and episode titles.
- **Label** (700, 1.2rem, 0.12–0.16em tracking, uppercase): the running head (wdth 110), field labels, season tabs and cópia tags.

### Named Rules
**The Ten-Foot Floor Rule.** No meaningful text goes under the hint step (1.3rem). Label (1.2rem) is allowed only because it is tracked, bold and uppercase.

**The Tabular Rule.** Every measured value (Nº, year, duration, sizes, bitrates, counts, episode numbers) is set with `font-variant-numeric: tabular-nums`.

**The Condensed Head Rule.** Heavy condensed uppercase is for titles only. Body, facts and hints never use it.

## Layout

The layout is a fixed full-screen stage that never scrolls (`overflow: hidden` on html, body and #root, with scrollbars hidden). Everything is positioned absolutely against a 3.5rem edge gutter (`gutter`). The running head sits 2.6rem from the top (`head`), and the home baseline sits 2.75rem from the bottom (`baseline`). The rem is one 120th of the viewport width, so there are no breakpoints, and the layout scales as one piece from 1080p to 4K.

- **Home wall:** three rows of 2:3 covers bleed off both edges and wrap horizontally. They are positioned absolutely and slide as one sheet. The Continuar rail of 16:9 tiles, 18rem wide with 1.25rem gaps (`track`), sits above the wall. One fixed baseline grid holds the focused entry on the left (Nº, title, facts, actions) and a 46rem synopsis column on the right, with a 4rem gap between them.
- **Entry:** a full-bleed backdrop sits under a left and bottom scrim. The 19.5rem poster is anchored bottom-left. The info column starts at 27rem and holds the logo or title, facts, synopsis, credits, the cópia block, actions and episodes. The episode track slides left and is clipped only on its poster side.
- **Sheets:** a 56rem panel slides in from the right. Its hints are pinned 3rem from the bottom.
- **Perfil (game-style menu):** full screen. A 32rem `ground` column holds the avatar and name, then the sections, each a 4.4rem row with a lucide icon. The options column (`ground-deep`) holds the section title, its one-line scope, and the rows; groups get a tracked uppercase label. Hints are pinned 3rem from the bottom.
- **Bem-vindo (first run):** a 52rem left column (running label, display title, one sentence, the player's status and meter) beside the suggested addons and the Começar pill.
- **Quem vai assistir? (launch, two or more profiles):** on `ground`, the question at title size above a centred row of 11rem avatars with their names at lead size; the focused one unveils (others at 0.55), lifts to 1.08 and takes the yellow focus mark under its name.
- **Pré-estreia:** pure black like house lights; a running label and the film's title until a trailer truly plays, then the trailer full bleed with one line on a black fade at the bottom ("A seguir: …" and the A/B hints).
- **CIH:** the whole 16:9 composition scales to 0.7439 inside a 2.39:1 band, centred, with black around it; nothing else changes.
- **Search:** the query is set at title size across the top. A 33rem on-screen keyboard sits on the left, and a grid of 11.5rem covers (6 columns) starts at 40rem.
- **Rhythm:** hint strips gap 0.45rem (`hint-gap`) and 0.9rem between groups. Keys gap 0.5rem (`key-gap`). Lists and sections step 2rem apart (`stack`).

## Elevation & Depth

Depth is a hybrid of tonal layering and soft, low drop shadows, all pure black. Nothing glows. At rest, artwork sits just off the ground on a short, tight shadow. A focused piece of art lifts by scale (1.12 for a cover, 1.15 under dwell, 1.06 for a tile) and gains a longer, darker shadow. Covers that aren't focused recede under a `ground-deep` veil instead. The room itself has depth from the ambilight field, a radial vignette, top and bottom scrims, and a fine fractal-noise grain. House lights (the play handoff) is pure black.

### Shadow Vocabulary
- **Art at rest** (`box-shadow: 0 0.6rem 1.4rem -0.6rem var(--shadow)`): covers and rail tiles.
- **Focused cover** (`box-shadow: 0 1.6rem 3rem -0.8rem rgb(0 0 0 / 0.8)`).
- **Focused tile** (`box-shadow: 0 1.4rem 2.6rem -0.8rem rgb(0 0 0 / 0.8)`): rail and episode art.
- **Entry poster** (`box-shadow: 0 2rem 4rem -1rem rgb(0 0 0 / 0.85)`).
- **Sheet** (`box-shadow: -1.5rem 0 4rem var(--shadow)`).
- **Notice** (`box-shadow: 0 1rem 2.5rem -0.5rem var(--shadow)`).

### Named Rules
**The Veil Not Frame Rule.** Focus on artwork is shown by unveiling, scaling and the yellow underline mark. Covers never get a focus border or ring.

## Shapes

Corners are barely softened. Artwork uses 0.35rem (`art`), the entry poster, list rows and inputs use 0.5rem (`panel`), and keys use 0.45rem (`key`). Interactive pills are fully round at half their height: actions use 2.3rem (`pill`) and choice chips use 1.5rem (`chip`). Thin bars (the focus mark at 0.26rem and the meter at 0.22rem) have round ends. The circles are the episode watched-check, profile avatars, accent swatches and the Bem-vindo checks. Strokes are rare. Artwork carries a 1px inset hairline, the Perfil input has a 0.12rem ivory-25% stroke that turns yellow on focus, and the current season has a 0.2rem underline. Icons share one look on a 24-unit grid with a 1.75 stroke and round caps: the app's own glyphs and lucide (Perfil sections, addon placeholders) at `strokeWidth={1.75}`. Gamepad glyphs mirror the pad: face buttons are a ring with the letter, and shoulders and centre buttons are pills.

## Components

### Buttons
Pill buttons are the entry page's two actions. The secondary choices beside them are text only.
- **Shape:** fully round pill (`pill`), 4.6rem tall, with the pad glyph leading at 1.6em.
- **Primary:** edition yellow with `on-edition` text. Only one primary per screen: the action A performs.
- **Secondary:** a 12% ivory fill with ivory text.
- **Hover / Focus:** 150ms ease-out. Hover scales to 1.04 only on `(hover: hover)` devices, press scales to 0.96, and focus-visible shows a 0.2rem yellow outline offset by 0.3rem. Disabled drops to 0.35 opacity.
- **Text action:** ivory-70 at meta size with a glyph, no fill at rest; under a pointer it takes the 8% ivory pill and ivory text. Use it for secondary choices next to the pills.
- **Implementation:** all three are coss `Button` (`default`, `secondary`, `ghost`) restyled at the call site: pill, flat (no inset highlight, no tinted shadow), icons at full opacity.

### Chips
- **Style:** a 0.08 ivory fill with ivory-70 hint text, as Perfil choice sets. Accent chips lead with a 1em swatch ringed in 35% black, so it reads even on a chip of its own colour.
- **State:** the selected chip is solid ivory with dark text at 650. When its row has focus, the selected chip turns yellow.

### Cards / Containers
- **Covers (signature):** a 2:3 shape with `art` corners, a `ground-raised` placeholder, an inset hairline and the rest shadow. When the addon has no artwork, the entry's own title is set in condensed uppercase at the bottom of a typeset cover.
- **Rail and episode tiles:** 16:9 at 18rem wide, veiled until focused. The title or status sits below. Rail tiles have a meter (yellow for watch progress, ivory for download progress). A watched episode dims its image to 0.6 and gets a round check.
- **Sheets:** a `ground-deep` panel, 56rem wide, attached to the right edge, with the sheet shadow.
- **Notice:** a `ground-raised` panel (0.6rem corners), centred near the bottom, with a coral alert icon.
- **End card (a film's credits, player corner):** the next-up panel's surface, with tracked ivory-70 kickers over a 19rem 16:9 still ("Próximo da coleção") and three 8.6rem covers ("Porque você viu …"); tiles are veiled until focused, then unveil, lift to 1.06 and take the focus mark. A footer holds "Gostou?" with two round player controls (thumbs, filled once chosen) and the A/B hints.

### Inputs / Fields
- **Search query:** no box. The field is set at title size, condensed uppercase, with a yellow caret and an ivory-52 placeholder.
- **Perfil field:** a `ground` fill with a 0.12rem ivory-25% stroke, `panel` corners and 3.8rem height. On focus the stroke turns yellow, with no outline. When invalid the stroke turns coral, with a coral error line below.

### Navigation
- **Running head:** the top-left section name in label style (expanded, yellow). The button-glyph hints sit top-right in ivory-52 at hint size.
- **Hints:** a key and its words, 0.45rem apart, 1.35rem between hints. The key (pad glyph or keycap) is one ink step brighter than its words: ivory-70 keys beside ivory-52 navigation hints, ivory keys beside ivory-70 action hints. Pad glyph and keycap share one height (1.45em), so a device switch never moves a hint. A keycap is a 16% fill of its own ink with a soft dark lower lip, like a real key; arrows are drawn, words keep their case.
- **Seasons:** coss tabs in tracked uppercase label style, ivory-52. The current one is yellow and carries a 0.2rem underline that slides to it on LB/RB (200ms), so colour isn't the only signal. When the seasons outrun the column, the strip slides so the previous season stays beside the current one.
- **Lists (cópias, Perfil):** rows with `panel` corners. A focused Perfil row takes an 8% ivory fill, and its name turns yellow. The current Perfil section is filled solid yellow while the section column has focus, and takes the 8% ivory fill once focus moves to its options.
- **Avatar:** a circle in the profile's own accent with its initial in `on-edition`, 800 weight. A focused cópia row is filled solid yellow, with its facts and tag in ground at 75%. Uncached or unplayable rows sit at 0.5 opacity.

### On-screen Keyboard
Keys are 4rem tall tiles with a 7% ivory fill and `key` corners. On the search keyboard they show capitals, and on the URL keyboard they show true case. The focused key is solid yellow and scales to 1.08. A latched key (shift, for example) is solid ivory. Wide keys use label style.

### Ambilight and Dwell (signature)
When focus rests on a cover for 140ms, its poster is painted into one of two 48×27 canvases, which cross-fade over 1.2s while the field fades in over 1.4s. Under dwell, the covers that aren't focused darken to 0.68, focus transitions stretch to 600ms, and the focused cover grows to 1.15. Motion uses one ease, `cubic-bezier(0.16, 1, 0.3, 1)`, for every CSS transition. Spatial travel (wall, rail, grid, sheets and the cover-to-entry morph) uses one shared spring, animated as a compositor `transform`. Exits answer a press and are faster than entrances (150ms). The focus mark grows from 40% width as it fades in; nothing grows from zero. Reduced motion keeps fades and colour changes but drops travel and scaling.

## Brand Mark

The mark is a kaleidoscope seen down its tube: six kites turning around an open hexagonal eyepiece. It is drawn only by `scripts/brand.py`.

- Two flat tones: edition `#f2b705` and edition in shadow `#a67c02` (OKLCH lightness 0.2 lower on the same hue, computed in the script). The shade is a mirror's dark side, not a bevel: no third highlight tone, no gradient.
- The eyepiece is real negative space, never a filled lens or a ring; no lines between petals.
- Brand surfaces sit on AMOLED black `#000000`, not `ground`: on OLED screens the canvas switches off and only the mark lights up. The interface keeps `ground`.
- The app icon is the mark on a flat black tile (rounded only because operating systems expect it). No glow, halo, spotlight gradient or inner stroke. The tray uses the same tile, because bare yellow measures 1.8:1 on a light taskbar.
- The social kit (`brand/social/`) is full-bleed and square-cornered: networks apply their own crop. Three layouts only: the mark alone (profile picture, kept inside the circle crop), stacked mark, wordmark and line (square and tall), and mark beside the wordmark with the line under it (wide). Nothing else on the canvas.
- The wordmark is Archivo 800 at width 64, uppercase, outlined to paths; caps sit on the mark's centre line.
- Preset avatars are two tones on the profile's accent: `ground` shapes and `ink` details, with no opacity steps. Where a second tone is needed, cut the shape out so the accent shows through.

## Do's and Don'ts

### Do:
- **Do** put text on yellow only in `on-edition`, and keep yellow flat.
- **Do** show focus with unveiling, scale (1.06–1.15) and the yellow mark or fill, answering within 150ms.
- **Do** keep every measurement in tabular figures and every title in condensed 800 uppercase.
- **Do** size everything in rem so the 1/120-viewport root keeps 1080p and 4K identical.
- **Do** pair a colour signal with a second cue (underline, fill, glyph) for state.
- **Do** give every artwork the 1px `art-outline` hairline and a `ground-raised` placeholder.

### Don't:
- **Don't** use glows or coloured shadows, and keep gradients to ground-coloured scrims and fades. Shadows are black and fall below the object.
- **Don't** frame covers or text blocks in cards or bordered boxes on the wall or the entry page. Panels exist only for overlays (sheets, notice) and focusable rows and keys.
- **Don't** use yellow for decoration or coral for anything but failure.
- **Don't** set meaningful text below 1.3rem, or rely on hover. The remote has no hover.
- **Don't** loop any animation.
