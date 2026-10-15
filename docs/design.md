# Tarn design system

How Tarn looks, moves and speaks, in one place: the tokens, the components,
light and dark, the words, and how to bring a design to the owner. It is
written for AI agents and the owner doing any visual, naming, icon,
store-listing or UI work.

`docs/brand/BRAND.md` stays the source of truth for the name, the wordmark,
the `ta` mark, brand colors and store art. This document links to it and
does not repeat its specs. Where the two disagree on a brand asset, BRAND.md
wins; where this document and the code disagree, the code is what ships, and
this document should be fixed.

## Read this before…

| You are about to…                                 | Read first                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Add or change anything visible                    | This document, then the component's source file listed in [Files](#9-files-map) |
| Touch the name, wordmark, mark, icons, store art  | `docs/brand/BRAND.md` (and its decision log)                                    |
| Add a feature                                     | `docs/research/2026-10-new-tab-research.md` (the five promises)                 |
| Change the settings panel                         | `docs/settings.md`                                                              |
| Change widget sizes, the grid or the clock's size | `docs/widgets.md`                                                               |
| Change or add a background scene                  | `docs/wallpapers.md`                                                            |
| Change arrival, motion or idle pace               | `docs/architecture.md` ("Arrival in detail"), `docs/wallpapers.md`              |
| Add a word to the UI                              | `AGENTS.md` ("Words"), `src/i18n/messages/en.ts`                                |

## 1. Summary

- **The page belongs to the user.** No logo, no wordmark, no greeting on the
  new tab. The living background is the signature; everything else is quiet
  frosted glass over it.
- **Calm by default, power out of sight.** The first screen shows little.
  Options that most people never touch sit one level down ("Show All",
  "Advanced", "More").
- **Black and white chrome, color only in the scene.** UI is ink on frost
  (new tab) or black on white with a dark twin (settings). Scene colors never
  leak into controls.
- **Fixed sizes on every screen.** 136px cells, 24px gap, 112px clock. No
  viewport scaling.
- **Native feel.** Settings read like macOS System Settings; the search box
  looks like the browser's own.
- **Show, don't tell.** Design proposals are rendered at real size with a
  one-line verdict each, not argued in long text.

## 2. Principles

### The five product promises

From `docs/research/2026-10-new-tab-research.md` ("What this means for
Tarn"). Every design decision should keep all five.

| Promise                        | What it means for design                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Calm by default, forever    | No feeds, ads, AI, greetings or tips by default (one exception: the first-run tip by the gear). Never switch anything on for the user. Nothing says "Soon" (`docs/settings.md`, rule 8). |
| 2. Never lose anything         | Destructive actions ask once or offer Undo (toast, widget remove, reset). Removing a widget keeps its content.                                                                           |
| 3. Respect the browser         | Its search engine, its new-tab colors at first paint, its look for the search box, its side panel for settings. No close button where the browser has one.                               |
| 4. Beautiful, measurably light | Animate only `transform` and `opacity`. Blur with the scene's shader glass, not CSS `backdrop-filter`, on the live page. Show measured cost (load gauge).                                |
| 5. Power kept out of sight     | Advanced last, "Show All" pages, "More" in editors, keyboard shortcuts that exist but aren't advertised on the page.                                                                     |

Default page (research doc): the living background, a large clock and date,
and a few widgets. A new install shows the start setup (`START_WIDGETS` in
`src/settings/schema.ts`: Bookmarks L, Notes M, Weather S, Timer S) with
example content until the user edits it.

### Calm by default

- Nothing contentful paints before the scene. The page opens in the
  browser's own new-tab color, the scene eases in, then the rest appears
  (see [Motion](#motion)).
- Controls hide until wanted. The settings gear is a faint glyph that
  becomes a glass button only as the pointer approaches
  (`src/app/tarn-settings-button.ts`), and steps aside while the panel is
  open.
- **The one tip** (owner, 2026-10-14): on a fresh install the gear is
  awake with a soft ring and a small glass card above it ("Make it
  yours", Got it / Open settings). It waits for the first mouse move or
  key, shows on at most 3 new tabs, and ends for good on either button,
  Escape or opening settings. Never after an update, never on a computer
  whose settings came through sync (`src/app/first-run.ts`). Rejected:
  a white welcome toast (loudest thing on the page), a dot on the gear
  (says where, not what). Mockups: `docs/design/first-run-hints-plan.md`.
  The dev build (`npm run dev`) shows it on every new tab, for review.
- Edit affordances (name holders, resize grips, remove badges, the drag
  hint) exist only in edit mode, which is "the settings panel is open".

### Power hidden

- Home of the settings panel holds only what most people change: wallpaper,
  clock, widgets. Everything else is one level down
  (`docs/settings.md`, rule 1).
- Pickers show three choices and a fourth "Show All" tile; the first screen
  never grows with the catalog.
- In editors, uncommon fields fold behind "More" (the Bookmarks site editor:
  custom icon and folder, `src/widgets/tarn-favorites.ts`).
- The page is named "Advanced", never "Developer".

## 3. Brand essentials

Short version only. Specs, files, colorways and the decision log are in
`docs/brand/BRAND.md`.

- **The brand is the word**: lowercase `tarn`, from the SVG files only. Never
  retype it as live text in a logo context (the r-n spacing rule keeps it
  from reading "tam").
- **No logo.** The `ta` mark (the `a` cut by the frame) exists only for
  square slots: toolbar, extensions page, store icon, avatars, Chrome's side
  panel header. Never on the new tab page. Don't invent symbols, monograms
  or mascots.
- **Pure black `#000000` and white `#FFFFFF`** for brand marks and brand
  surfaces. No brand hue, no near-black, no blue-grey.
- **Google Sans Flex, default design**, untuned: no roundness, width or slant
  changes. Bundled, never fetched.
- **"Chrome" never goes in a name or mark.** "for Google Chrome™" appears
  only as a secondary line (store, the panel signature).
- **No rainbow, prism, iridescence or AI-style glow**, anywhere.
- Where the wordmark appears in the product: only faded at the bottom of the
  settings panel's home page (`src/ui/wordmark.ts`, `.signature` in
  `src/panel/tarn-panel.ts`).

## 4. Tokens

There is no single token file yet. Tokens live in four scopes, each set at
the top of the component that owns them:

| Scope                     | Where                                  | Used by                                                        |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Global                    | `:root` in `src/styles/global.css`     | font, base page color, `--glass-*` (takeover page), focus ring |
| New tab (scene-dependent) | `:host` in `src/app/tarn-app.ts`       | clock, widgets, board, sheets, glass search box                |
| Settings panel            | `:host` in `src/panel/tarn-panel.ts`   | everything in the side panel                                   |
| Search box                | `:host` in `src/search/tarn-search.ts` | the search box and its dropdown, Lens box, voice               |

Rule from `global.css`: components read tokens; nothing hardcodes a color.
(Exceptions that exist today are listed under each component.)

### Color: new tab page

Set on `<tarn-app>` and switched by its `tone` attribute, which comes from
the scene, not the system (see [Light and dark](#6-light-and-dark)).

| Token                | Dark scenes (default)               | Light scenes (`tone='light'`) | Use                                                       |
| -------------------- | ----------------------------------- | ----------------------------- | --------------------------------------------------------- |
| `--ink`              | `rgb(244 247 251)`                  | `rgb(22 26 38)`               | Clock, widget text, icons                                 |
| `--ink-dim`          | `rgb(244 247 251 / 0.66)`           | `rgb(22 26 38 / 0.64)`        | Date, headings, secondary text, edit hint                 |
| `--ink-faint`        | `rgb(244 247 251 / 0.4)`            | `rgb(22 26 38 / 0.4)`         | Placeholders                                              |
| `--ink-shadow`       | `0 1px 3px rgb(0 0 0 / 0.28)`       | `none`                        | Keeps white text readable over bright patches             |
| `--tile-line`        | `rgb(255 255 255 / 0.14)`           | `rgb(255 255 255 / 0.55)`     | Tile border, field borders, hairlines in sheets           |
| `--tile-fill`        | `rgb(255 255 255 / 0.03)`           | `rgb(255 255 255 / 0.06)`     | Tile fill over shader glass                               |
| `--tile-fill-solid`  | `rgb(255 255 255 / 0.1)`            | `rgb(255 255 255 / 0.45)`     | Tile fill when CSS blur stands in (no WebGL)              |
| `--tile-highlight`   | `rgb(255 255 255 / 0.08)`           | `rgb(255 255 255 / 0.5)`      | 1px inset top highlight on tiles                          |
| `--tile-held`        | `rgb(20 25 34 / 0.86)`              | `rgb(246 246 251 / 0.88)`     | Lifted tile, holder pill, sheets, open folder             |
| `--chip`             | `rgb(255 255 255 / 0.14)`           | `rgb(255 255 255 / 0.45)`     | Buttons, inputs, letter-less chips, hover fills           |
| `--chip-hover`       | `rgb(255 255 255 / 0.22)`           | `rgb(255 255 255 / 0.65)`     | Hover on the above                                        |
| `--chip-strong`      | `rgb(30 34 44 / 0.85)`              | `rgb(255 255 255 / 0.9)`      | Opaque chip                                               |
| `--focus-ring`       | `rgb(255 255 255 / 0.7)` (global)   | `rgb(22 26 38 / 0.6)`         | 2px focus outline                                         |
| `--tile-line-strong` | `color-mix(--tile-line, white 35%)` | same                          | Held/resizing tile border, snap outline (`tarn-board.ts`) |

Fixed colors on the new tab (allowed exceptions):

| Value                                                           | Where                                                  | Why                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `rgb(214 64 69 / 0.92)`                                         | Holder remove button, second press                     | The only red on the page: "this removes"                                          |
| `#22252c` (`DARK_CHIP`)                                         | Bookmarks chips with white icons                       | White icons (GitHub, ChatGPT) would vanish on white                               |
| `rgb(255 255 255 / 0.94)`                                       | Bookmarks chips behind real site icons                 | Icons sit on a light tile, like app icons                                         |
| `hsl(hue 22% 38%)`                                              | Letter tiles (no icon cached)                          | A quiet tint per site (`siteHue()` in `src/widgets/site-icon.ts`). Never rainbow. |
| `rgb(74 78 88)`                                                 | Remove badges on site icons                            | Opaque so the icon under it never shows through                                   |
| `#ffffff` / `#3c3c3c` (Chrome), `#f9f9fb` / `#2b2a33` (Firefox) | First frame (`START_COLORS`, `src/app/first-paint.ts`) | The browser's own default new-tab colors, so the hand-over has no edge            |

### Color: frosted glass

The frost behind tiles is drawn by the scene (`src/backdrop/glass.ts`): a
blur of about 26 CSS px (`BLUR_CSS_PX`) from mipmaps, mixed with white at
0.09 on dark scenes and 0.28 on light ones (`uFrost`,
`src/backdrop/renderer.ts`). The tile adds only a near-clear fill, a 1px
border and an inset top highlight.

When WebGL is off, `glass="css"` swaps in `--tile-fill-solid` with
`backdrop-filter: blur(24px) saturate(1.3)` (cheap there, because nothing
moves). Never use CSS `backdrop-filter` on the live page for anything that
is always visible: it re-blurs the moving canvas every frame (measured
compositor 2% to 8%). Sheets and dialogs may use it only while open.

### Color: settings panel

Light first with a dark twin under `@media (prefers-color-scheme: dark)`;
system greys like macOS/iOS settings.

| Token                   | Light                     | Dark                      | Use                                     |
| ----------------------- | ------------------------- | ------------------------- | --------------------------------------- |
| `--bg`                  | `#f2f2f7`                 | `#000000`                 | Page                                    |
| `--group`               | `#ffffff`                 | `#1c1c1e`                 | Rounded groups                          |
| `--ink`                 | `#000000`                 | `#ffffff`                 | Text, selection ring, toast background  |
| `--muted`               | `rgb(60 60 67 / 0.6)`     | `rgb(235 235 245 / 0.6)`  | Section labels, notes, values, chevrons |
| `--hair`                | `rgb(60 60 67 / 0.2)`     | `rgb(84 84 88 / 0.65)`    | Row hairlines, search focus ring        |
| `--field`               | `rgb(118 118 128 / 0.12)` | `rgb(118 118 128 / 0.24)` | Search field, segmented track           |
| `--tile` / `--tile-ink` | `#000` / `#fff`           | `#fff` / `#000`           | Icon tiles behind row glyphs            |
| `--seg-on`              | `#ffffff`                 | `#636366`                 | Selected segment                        |
| `--press`               | `rgb(0 0 0 / 0.06)`       | `rgb(255 255 255 / 0.08)` | Row hover                               |
| `--track`               | `rgb(120 120 128 / 0.22)` | `rgb(120 120 128 / 0.32)` | Switch off                              |
| `--on` / `--knob-on`    | `#000` / `#fff`           | `#fff` / `#000`           | Switch on                               |

No accent hue. "On" is black (white in dark).

### Color: search box

Copies the browser's own box, so it is the one place Google's UI greys and
accents appear (`src/search/tarn-search.ts`). Looks: `auto` (follows
`prefers-color-scheme`), `light`, `dark`, `glass`.

| Token         | Light     | Dark      | Glass                                                    |
| ------------- | --------- | --------- | -------------------------------------------------------- |
| `--box`       | `#ffffff` | `#303134` | `var(--tile-fill)` (solid fill + CSS blur without WebGL) |
| `--box-ink`   | `#202124` | `#e8eaed` | `var(--ink)`                                             |
| `--box-dim`   | `#5f6368` | `#9aa0a6` | `var(--ink-dim)`                                         |
| `--box-hover` | `#f1f3f4` | `#3c4043` | `var(--chip)`                                            |
| `--box-line`  | `#e8eaed` | `#5f6368` | `var(--tile-line)`                                       |
| `--accent`    | `#1a73e8` | `#8ab4f8` | `var(--ink)`                                             |
| `--listening` | `#ea4335` | `#f28b82` | `#ff8a80`                                                |

Only the blue accent (focus, Lens links) and the red listening state are
used, never Google's four colors together (BRAND.md).

### Type

| Role                      | Spec                                                                                                | Where                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Family                    | `--font-sans`: Google Sans Flex, then system-ui, -apple-system, Segoe UI, Roboto                    | `src/styles/global.css`                                |
| Font file                 | `public/fonts/google-sans-flex-latin.woff2`, weights 1-1000, `font-display: block`, Latin subset    | `global.css`                                           |
| Clock time                | 112px, weight 200, line-height 0.92, -0.04em, tabular numbers (72px under 480px wide)               | `src/widgets/tarn-clock.ts`                            |
| Clock date                | 19px, weight 450, `--ink-dim` (16px under 480px)                                                    | `tarn-clock.ts`                                        |
| Big widget numbers        | Light weights (200-250), sized to the tile with container units (Timer, Calendar day 52px, Weather) | `tarn-focus.ts`, `tarn-calendar.ts`, `tarn-weather.ts` |
| Widget heading            | 12px, 600, 0.06em tracking, uppercase via CSS, `--ink-dim`                                          | `widgetStyles` in `src/widgets/styles.ts`              |
| Widget body               | 15px (Notes, Tasks); 12-13px for labels                                                             | widget files                                           |
| Sheet title               | 15px, 600                                                                                           | `sheetStyles`                                          |
| Holder pill, edit hint    | 12px 500; 13px 500                                                                                  | `src/widgets/tarn-board.ts`                            |
| Search input / rows       | 16px / 15px, details 13px                                                                           | `tarn-search.ts`                                       |
| Panel title / description | `--title` 13.5px/18px, `--desc` 12px/16px                                                           | `tarn-panel.ts`                                        |
| Panel section label       | 12px, 400, `--muted`                                                                                | `h2` in `tarn-panel.ts`                                |
| Panel page title          | 14px, 600                                                                                           | `h1` in `tarn-panel.ts`                                |
| Segmented control         | 11.5px/16px, 500                                                                                    | `.seg` in `tarn-panel.ts`                              |

Weights: 400 text, 500 controls and labels, 600 headings, 200-250 for big
numerals. Sentence case in all source strings; the widget heading is the one
place CSS uppercases.

Clock faces (`src/widgets/clock-faces.ts`) style the same bundled font with
SVG filters; the only other fonts are the two blackletter faces (Tarn
Fraktur, Grenze Gotisch, OFL, `global.css`), loaded only when their face is
shown.

### Radii

| Element                                       | Radius                                                            | Where                            |
| --------------------------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| Widget tile                                   | 24px (`RADIUS`)                                                   | `src/widgets/tarn-board.ts`      |
| Open Bookmarks folder                         | 30px                                                              | `tarn-favorites.ts`              |
| Site editor sheet                             | 24px                                                              | `tarn-favorites.ts`              |
| Generic sheet (`sheetStyles`)                 | 18px                                                              | `src/widgets/styles.ts`          |
| Search box                                    | 23px (half of 46px); open: top corners only, list gets the bottom | `tarn-search.ts`                 |
| Lens box                                      | 24px                                                              | `tarn-search.ts`                 |
| Site chip                                     | 12px (14px in large tiles, 15px in an open folder)                | `tarn-favorites.ts`              |
| Inputs in sheets, grouped fields              | 10px, 12px                                                        | `styles.ts`, `tarn-favorites.ts` |
| Panel group                                   | 10px                                                              | `tarn-panel.ts`                  |
| Panel wallpaper card / clock tile             | 12px / 6px                                                        | `tarn-panel.ts`                  |
| Panel icon tile                               | 6px                                                               | `tarn-panel.ts`                  |
| Panel search field, segmented track / segment | 9px / 9px / 7px                                                   | `tarn-panel.ts`                  |
| Toast                                         | 12px                                                              | `tarn-panel.ts`                  |
| Pills: buttons, holder, chips, switch         | 999px                                                             | everywhere                       |

Corners are concentric: an inner shape's radius is the outer radius minus
the gap between them. A selected tile's ring sits 4px outside it, so a tile
in a 10px card is 6px. Folder minis use `chip-radius - inset`. Change outer
and inner radii together.

### Spacing and grid

| Token                               | Value                                                                                         | Where                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Cell                                | 136px (`CELL`); content never scaled                                                          | `src/widgets/geometry.ts`                             |
| Gap                                 | 24px (`GAP`); pitch 160px                                                                     | `geometry.ts`                                         |
| Columns                             | 2, 3, 4 or 6, max 6                                                                           | `src/layout/bands.ts`, `docs/widgets.md`              |
| Widget sizes                        | S 1x1, M 2x1, L 2x2, XL 4x2 (each kind offers only some)                                      | `WIDGET_SIZE_OPTIONS`, `src/settings/schema.ts`       |
| Page side margin                    | 24px                                                                                          | `MARGIN` in `tarn-board.ts`, `.page` in `tarn-app.ts` |
| Clock to widgets                    | 56px group gap                                                                                | `.group` in `tarn-app.ts`                             |
| Clock to search / search to widgets | 32px / 40px                                                                                   | `tarn-app.ts`                                         |
| Search box width                    | 616px = 4 columns; 3 or 2 columns (the grid's width) under 664px; fits the window under 328px | `tarn-search.ts`                                      |
| Vertical placement                  | Free space split 2 : 3 above/below, at least 40px each                                        | `.page` in `tarn-app.ts`                              |
| Widget padding                      | 16px 18px, 8px gap                                                                            | `widgetStyles`                                        |
| Panel page                          | 14px 16px 28px, 22px between sections                                                         | `tarn-panel.ts`                                       |
| Panel row                           | min 44px tall, `--row-x` 12px, `--row-gap` 10px, icon 24px with 15px glyph                    | `tarn-panel.ts`                                       |

Nothing changes size with the window. A phone-sized window only gets a
smaller clock. Rows share one grid, left-aligned within it; the grid as a
whole is centered (`docs/widgets.md`).

### Shadows

Shadows are rare and soft; tiles get only an inset highlight.

| Element                   | Shadow                                                       |
| ------------------------- | ------------------------------------------------------------ |
| Tile at rest              | `inset 0 1px 0 var(--tile-highlight)`                        |
| Tile hovered in edit mode | lifts 3px, `0 10px 28px rgb(0 0 0 / 0.22)`                   |
| Tile held or resizing     | `0 22px 48px rgb(0 0 0 / 0.32)` on `--tile-held`             |
| Holder pill               | `0 4px 14px rgb(0 0 0 / 0.22)`                               |
| Sheet                     | `0 24px 64px rgb(0 0 0 / 0.35)`, backdrop `rgb(0 0 0 / 0.4)` |
| Search box (light)        | `0 1px 6px rgb(32 33 36 / 0.28)`, like the browser's         |
| Panel toast               | `0 10px 30px -10px rgb(0 0 0 / 0.45)`                        |
| Panel selected segment    | `0 3px 8px rgb(0 0 0 / 0.12), 0 1px 1px rgb(0 0 0 / 0.06)`   |
| Text on dark scenes       | `--ink-shadow`                                               |

### Motion

Animate only `transform` and `opacity` on the page. Motion is judged by eye:
prototype and record before changing any timing, and don't touch arrival
timing unless the owner asks for exactly that.

| Moment                              | Timing                                                                                          | Where                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| New tab: scene fade-in              | 700ms (`REVEAL_MS`), `cubic-bezier(0.22, 1, 0.36, 1)`                                           | `src/backdrop/tarn-backdrop.ts`                                   |
| New tab: scene settle               | 1100ms (`SETTLE_MS`) from scale 1.035                                                           | `tarn-backdrop.ts`                                                |
| New tab: browser gray to scene base | 250ms (`DARKEN_MS`)                                                                             | `tarn-backdrop.ts`                                                |
| Clock, search, widgets appear       | with the scene's first frame (`WIDGETS_AT_MS = 0`), 200ms fade                                  | `tarn-backdrop.ts`, `tarn-app.ts`, `APPEAR_MS` in `tarn-board.ts` |
| Settings gear appears               | 500ms fade after reveal                                                                         | `.controls` in `tarn-app.ts`                                      |
| First-run tip                       | first mouse move or key, at least 1.8s after load; 320ms fade from 6px below; ring pulses twice | `tarn-settings-button.ts`                                         |
| Reload                              | no fade: ghost frame, then everything in place                                                  | `src/app/first-paint.ts`                                          |
| Scene to scene                      | 400ms crossfade (`FADE_MS`)                                                                     | `tarn-backdrop.ts`                                                |
| Widgets move or resize (FLIP)       | 460ms (`MOVE_MS`), same ease                                                                    | `tarn-board.ts`                                                   |
| Snap outline, held tile             | 180-220ms                                                                                       | `tarn-board.ts`                                                   |
| Sheet in                            | 180ms ease-out, from 8px below at 0.98                                                          | `sheetStyles`                                                     |
| Panel page push                     | 240ms, 24px slide from 0.3 opacity                                                              | `tarn-panel.ts`                                                   |
| Panel switch knob                   | 250ms `cubic-bezier(0.3, 1.3, 0.6, 1)` (slight overshoot)                                       | `tarn-panel.ts`                                                   |
| Hover color changes                 | 150ms ease                                                                                      | everywhere                                                        |
| Toast                               | stays 4s                                                                                        | `showToast` in `tarn-panel.ts`                                    |
| Idle pace                           | active 30fps; calm after 1 min idle at 40% speed, 20fps; never stops while visible              | `src/backdrop/pace.ts`, `wallpapers.md`                           |

**Reduced motion** (`prefers-reduced-motion: reduce`): the scene draws one
still frame and stops (`renderer.ts`); a new tab fades in over 400ms with no
settle; FLIP, sheet, page-push, holder and switch animations are off; the
gear doesn't rotate; the first-run ring doesn't pulse. Every new animation needs its reduced-motion branch.

## 5. Components

### Tile and glass

`src/widgets/tarn-board.ts`. Every widget sits in a tile: a 24px rounded
rectangle, 1px `--tile-line` border, near-clear `--tile-fill`, inset top
highlight, frost drawn behind it by the scene. The tile is a size container,
so a widget adapts with `@container` queries rather than JS. The tile clips
its content, not itself, so edit controls can overhang its edge.

- Never fade a tile container with opacity (it breaks CSS glass in the still
  fallback). Fade the content.
- Tiles are positioned with transforms by the board, never by free
  placement.
- Edit mode adds: a holder pill on the top edge (name, click to rename; a
  remove button that turns red and asks once), a resize grip just outside
  the bottom-right corner, and a hint under the widgets ("Drag to rearrange ·
  drag a corner to resize"). Widget contents are `inert` meanwhile, except
  `editable` widgets (Bookmarks, Weather) that show their own controls,
  marked `data-edit`.

### Widget heading

`h3` in `widgetStyles` (`src/widgets/styles.ts`): 12px, 600, uppercase,
0.06em, `--ink-dim`, not selectable. The text is the widget's name
(`WidgetEntry.name`, or the kind's default from `widget.*` in the catalog).
Short tiles hide it (Bookmarks under 140px tall).

### Chips, site icons and folders

`src/widgets/tarn-favorites.ts`, `src/widgets/site-icon.ts`.

- **Chip**: 44px with a 32px icon and 12px radius (52/38/14px in large
  tiles). Real icons sit on near-white, like app icons; white icons get the
  dark chip with an edge; the user's own image fills the chip.
- **Letter tile**: the site's first letter on `hsl(hue 22% 38%)` with a faint
  top gradient. The hue comes from the host name. A quiet tint, never
  saturated, never rainbow.
- **Folder**: a glass chip holding its first four icons at concentric
  corners; opens as a glass sheet (30px radius) as wide as its icons, at
  most six across, rows as even as possible.
- **Badges**: the × and + are drawn SVG paths, not font glyphs (a font's ×
  sits a pixel off center). Remove badges sit whole on the icon's top-left
  corner, opaque.
- Icons come from the browser's favicon cache, never the network.

### Sheets and dialogs

`sheetStyles` in `src/widgets/styles.ts`; the site editor in
`tarn-favorites.ts`. Like Safari's sheets:

- A modal `<dialog>`, max 340-360px wide, on `--tile-held` with a 1px
  `--tile-line` border, 18-24px radius, a soft shadow, and a CSS blur only
  while open.
- Title 15px 600, centered in the editor. Fields as one rounded group with
  hairlines between rows and a fixed-width label column (the editor), or
  stacked labels (generic sheets).
- Buttons at the bottom right: Cancel and a primary, both pills; primary is
  ink on the sheet color. The editor uses two equal buttons.
- Uncommon fields fold behind "More ›".
- No full-screen overlays. A tool that needs room opens over its own control
  (the Lens box opens over the search box), not over the page.

### Settings panel

`src/panel/tarn-panel.ts`; rules and structure in
`docs/settings.md`. Desktop proportions, like macOS System
Settings, black and white.

| Part              | Spec                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page              | One scrolling list that goes deeper; no tabs, no close button. Home opens on search and ends on the signature.                                                                                                                                                                                                                                           |
| Sub-page bar      | iOS style: "‹ Settings" left, page name centered, search under it.                                                                                                                                                                                                                                                                                       |
| Search field      | 32px tall, 9px radius, `--field`; focus is a soft 3px ring on the whole field. `/` focuses it, Escape clears.                                                                                                                                                                                                                                            |
| Section           | Muted 12px label above a white 10px-radius group; a short note below the group explains it (not a second line in a row).                                                                                                                                                                                                                                 |
| Row               | Min 44px: icon tile, one-line title, control or value on the right, chevron if it opens a page. Hairlines start at the text.                                                                                                                                                                                                                             |
| Icon tile         | 24px black tile (white in dark), 6px radius, 15px filled glyph. Its box is one title line plus one description line tall.                                                                                                                                                                                                                                |
| Switch            | 34x20, knob 16px, black when on (white in dark). Safari-sized, not phone-sized.                                                                                                                                                                                                                                                                          |
| Segmented control | `--field` track 9px radius, 2px padding; selected segment `--seg-on` with a small shadow.                                                                                                                                                                                                                                                                |
| Picker cards      | Wallpapers: 2-column 16:10 cards, 12px radius, name left and load gauge right. A glass mark in the thumbnail's bottom-left corner says Live for scenes or Photo for photos, text only (owner, 2026-10-14: no icon). Clock: a card of four square tiles. Last tile "Show All" (blurred background, grid glyph). Selected: 2px gap ring plus 2px ink ring. |
| Load gauge        | A 20x14 arc with a needle in `--muted`/`--ink`, from measured cost (`src/backdrop/scenes/load.ts`): still, light, medium, heavy.                                                                                                                                                                                                                         |
| Chips row         | Pills on `--group`, 12.5px 500 (example setups, in Advanced).                                                                                                                                                                                                                                                                                            |
| Toast             | Bottom, 16px inset, inverted (`--ink` background, `--bg` text), 12px radius, optional Undo in 600; 4s.                                                                                                                                                                                                                                                   |
| Signature         | Wordmark at 16% opacity, "for" plus the browser's name, version, Privacy · Source code. Never Google's logo or colors.                                                                                                                                                                                                                                   |

Changes apply live; there is no Save button. Removing and resetting offer
Undo.

### Search box

`src/search/tarn-search.ts`. Shaped like the browser's own new-tab box:

- A 46px pill (23px radius), 616px wide so its edges line up with four
  widget columns; soft shadow; gray 20px stroke icons (search, mic, Lens);
  16px input with "Search or type a URL".
- Open, the dropdown joins onto it: top corners only on the box, a 1px line
  inset 18px, slim 34px rows like Google's, at most 6 bookmarks.
- Looks: Auto (default, follows the system), Light, Dark, Glass. Glass uses
  the page's ink and frost; with widgets on a live scene, the scene draws its
  frost like a tile.
- Voice listens in the box: the mic turns red and a level line replaces the
  search icon. Lens opens a box over the search box. AI Mode is an optional
  pill.
- Enter always searches with the browser's default engine.

Its icons are stroked, like the browser's box, unlike the filled panel
glyphs. That is deliberate: the box copies the browser, the panel copies the
system.

### Buttons and pills

| Kind              | Spec                                                                                                                    | Where                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Sheet button      | Pill, 7px 16px, 13px 500, `--chip`; primary is `--ink` fill                                                             | `sheetStyles`                     |
| Holder pill       | 26px tall, 12px 500, on `--tile-held`; remove turns red on first press                                                  | `tarn-board.ts`                   |
| Round tool        | 40px circle, transparent, `--box-hover` on hover                                                                        | `tarn-search.ts`                  |
| Settings gear     | 32px circle; at rest a faint glyph (`rgb(255 255 255 / 0.38)`), near the pointer a glass circle; rotates 60deg on hover | `src/app/tarn-settings-button.ts` |
| Panel text button | 600 title-size, no fill                                                                                                 | `tarn-panel.ts`                   |
| Panel add/remove  | Round plus and minus glyphs (20px) in a 28px target                                                                     | `tarn-panel.ts`                   |

Focus: always a visible 2px outline with 2px offset (`--focus-ring` on the
page, `--ink` in the panel, `--accent` in the search box).

### Glyphs

`src/ui/glyphs.ts`. Solid 24x24 shapes drawn for Tarn: one filled shape with
details cut out (even-odd), readable at 15px in a 24px tile.

- Never outline icons in the panel, never emoji.
- Add a glyph to `GLYPHS` rather than inlining one in a component.
- Third-party icons only from Google (Apache-licensed Material Icons, like
  the settings gear in `tarn-settings-button.ts`, credited in a comment) or
  truly free sources (OFL). Never trace or copy icons from proprietary apps.
- The search box keeps its own stroked set, matching the browser's box.

## 6. Light and dark

Two separate switches decide light and dark. Know which one a surface
follows.

| Surface                                     | Follows                                    | How                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| First frame of a new tab                    | System (`prefers-color-scheme`)            | The browser's default new-tab color, `src/app/first-paint.ts`                                                                               |
| Scene                                       | The user's choice                          | Each scene has a tone: Bloom, Silk, Sakura and Contour are light; the rest, including the default Tarn, are dark. Photos measure their own. |
| Clock, widgets, tiles, sheets, glass search | Scene tone                                 | `sceneTone()` in `src/backdrop/scenes/index.ts`, set as `tone` on `<tarn-app>`; frost white mix 0.09 vs 0.28                                |
| Search box (Auto)                           | System                                     | Like the browser's own box                                                                                                                  |
| Search box (Light, Dark)                    | Fixed                                      |                                                                                                                                             |
| Settings panel                              | System                                     | `@media (prefers-color-scheme: dark)` in `tarn-panel.ts`                                                                                    |
| Tab icon tint                               | System                                     | `onSchemeChange` in `tarn-app.ts`                                                                                                           |
| Settings gear                               | Neither (always white with a faint shadow) | `tarn-settings-button.ts`                                                                                                                   |
| Toolbar popup, takeover page                | Neither (dark only)                        | `src/popup/tarn-popup.ts`, `src/takeover/tarn-takeover.ts`                                                                                  |

Rules:

- BRAND.md says light first, following the system. The panel and search box
  do. Scenes don't yet: light/dark scene twins are listed as not built in
  `docs/wallpapers.md`. Don't claim otherwise in store copy.
- Every new visual needs a light version and a dark twin. On the page, that
  means it reads correctly in both scene tones; in the panel, both system
  schemes.
- Page components take colors from the tone tokens only, so a light scene
  gets dark ink and stronger frost automatically.
- Known gaps: the popup is dark only, uses the system font instead of Google
  Sans Flex, and uses scene colors (`#0d2740` to `#05080f`, `#a9cfe0`) as UI
  chrome; the takeover page is dark only. Align them with the panel when
  they are next touched.

## 7. Words and language

### Tone

From BRAND.md ("Voice") and the catalog (`src/i18n/messages/en.ts`):

- **Fewer words than anyone.** "Background", not "Background renderer
  (WebGL2)". Opening a tab says nothing.
- **Plain everyday words.** "Bookmarks", not "Favorites"; "Timer", not
  "Focus timer" (renamed in #39). "Advanced", not "Developer".
- **Sentence case.** Never all caps for the name. Labels are nouns
  ("Look", "Buttons"), actions are verbs ("Add a place", "Remove {name}").
- **Honest and calm.** Say what happened and what to do: "Tarn is off. New
  tabs open your browser's page." No alarm ("Are you sure? You'll lose your
  setup."), no upsell, no exclamation marks.
- **Explanations go under the group**, as one short note, not in the row.
- **Empty states invite, briefly**: "See the weather where you are, or
  anywhere.", "Open settings to add your sites."
- **Never "Chrome" as Tarn's name.** Name the user's browser only where it
  reports itself (panel signature, tab icon option).

### Mechanics

- Every visible word goes through `t()` from `src/i18n`. Never write UI text
  inline, including `aria-label`s, toasts and screen-reader announcements.
- Add the English to `src/i18n/messages/en.ts` under a grouped key
  (`panel.*`, `board.*`, `favorites.*`...), with `{name}` placeholders, and
  the same key to all 9 other catalogs. `src/i18n/i18n.test.ts` fails on a
  missing key or placeholder.
- **Ten languages**: en, es, pt-BR, fr, de, ru, ja, zh-CN, ko, tr; "auto"
  follows the browser.
- **No wording that depends on a count.** There are no plural forms. Write
  "{name}, {index} of {count}" or "Widgets › 3", not "3 widgets".
- Pass `locale()` to every `Intl` call (dates, times, numbers, week start).
- Components re-render on a language change with
  `new LocaleController(this)`.
- Leave room: German and Russian run about 30% longer than English. Test
  long strings in a 330px panel and in a 1x1 tile.
- The manifest name, short name ("Settings", 12 characters at most) and
  description ("A still, clear start to every tab.") come from
  `public/_locales/*/messages.json`.
- Google's weather credit stays in English (its required wording).
- Known gaps: the HTML `<title>`s ("New Tab" in
  `src/entrypoints/newtab/index.html`, "Make Tarn your new tab" in the
  takeover page) are English only.

## 8. How to propose and review design

### Show it, at real size

The owner reacts to images, not arguments. Long text pages are rejected.

1. **Render every option** at real size: headless Chrome at device scale 2,
   real fonts, the real scene behind it (or a real frame of it). The scene
   thumbnail script (`scripts/scene-previews.mjs`, `CHROME=... node
scripts/scene-previews.mjs`) shows how to drive Chrome without downloads.
2. **Look at the renders yourself** before recommending. Numbers alone
   missed problems that a frame showed at once (Aurora's mountain-like
   glow, blocky stars).
3. **Real size, real screens.** Judge layouts from full-size screenshots at
   1440x900 and a large monitor, not scaled-down simulations: a scaled lab
   made big screens look emptier and misled the owner.
4. **Present side by side, lead with the answer**: the options as images,
   each with a one-line verdict, then your pick. No essays.
5. **Both tones.** Show a dark and a light scene (and the panel in both
   schemes) when the change touches color.
6. **Motion as a recording or frames**, never as a description.
7. When feedback is blunt, make a better attempt rather than defending the
   last one.
8. Ask the owner when a task seems to need something this document or
   BRAND.md forbids. Don't work around it.

### Owner rules (from many rounds)

- Default fonts untuned; no rounded Google Sans.
- Text-first branding over symbols.
- No rainbow, prism or iridescence; letter tiles use a quiet tint.
- Calm moving backgrounds are the signature; realism over cute procedural
  props; motion you notice within seconds; full resolution for detailed
  scenes.
- Fixed sizes on every screen (136px cells, 24px gap, 112px clock), rows on
  one shared grid, no viewport scaling.
- Power options hidden from basic users, behind "More" or one level down.
- Native feel: copy the browser's and the OS's own patterns (Chrome's search
  box, macOS settings, Safari sheets, phone home-screen badges).
- Write original code. Never copy code, shaders or icons from proprietary
  apps; use them only as inspiration. Assets only from Google or truly free
  (OFL) sources; respect Reserved Font Names (Tarn Fraktur).
- Plain everyday wording, every visible word through `t()` in 10 languages.
- No full-screen takeovers; no extra buttons where a list was asked for.

### Rejected, and why

Don't re-propose these. Brand and logo rejections are in BRAND.md's
decision log and are only summarized here.

| Area     | Rejected                                                                                 | Why / what replaced it                                                                                  | Source                   |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------ |
| Brand    | A logo or symbol (still-water sun, horizon line, underline, `t` at a waterline)          | The word is the brand; `ta` cut in half is the only mark                                                | BRAND.md decision log    |
| Brand    | Rounded Google Sans Flex (ROND 60), Albert Sans                                          | Default Google Sans Flex only                                                                           | BRAND.md                 |
| Brand    | Glacier-blue mark, blue-grey ink                                                         | "Black and white, not grey-ish"                                                                         | BRAND.md                 |
| Brand    | `tarn` or `rn` in the square; wordmark at opsz 144                                       | Reads "tam"                                                                                             | BRAND.md, #22            |
| Brand    | Renaming (loch, lampi, kelda), a new font                                                | Owner kept the name; the fix stayed inside the font                                                     | BRAND.md, #22            |
| Brand    | All caps TARN; dark-first brand                                                          | Loud; light first matches the browser                                                                   | BRAND.md                 |
| Color    | Prism, pearl/iridescent scenes, rainbow UI glow                                          | "Forget prism entirely"; reads as an AI feature                                                         | BRAND.md, backgrounds.md |
| Color    | Rainbow letter tiles                                                                     | A quiet tint per site                                                                                   | #31                      |
| Layout   | Free placement; page-wide grid from the top-left                                         | Breaks on other windows; "looks ass on wide screens"                                                    | widget-layout.md, memory |
| Layout   | A compact block in the center                                                            | "Weird bunch of boxes in the center"                                                                    | memory                   |
| Layout   | Scaling the page with the screen; a clock that shrinks while tiles don't                 | Sizes must be the same everywhere                                                                       | widget-layout.md, memory |
| Layout   | Centering each row on its own                                                            | Short rows fall half a tile off the grid                                                                | widget-layout.md         |
| Layout   | Odd column counts (3, 5)                                                                 | 34-61% of rows ended in a gap                                                                           | widget-layout.md         |
| Layout   | Stretching a lone 1x1 or medium to fill a band                                           | "I can't make it 1x1"; chosen sizes win after "no holes"                                                | widget-layout.md, #26    |
| Layout   | 16px or 30px gap                                                                         | Cramped / scattered; 24px chosen                                                                        | widget-layout.md         |
| Arrival  | Faster scene (0.45s fade, 0.65s settle)                                                  | "Flashing my eyes"                                                                                      | AGENTS.md, memory        |
| Arrival  | Widgets after the settle (~1.7s), or halfway through the fade (~0.6s)                    | "So late"; widgets now come with the first frame                                                        | AGENTS.md, #6            |
| Arrival  | A separate theme add-on to color the pre-paint frame                                     | "One install"                                                                                           | memory                   |
| Pace     | Stopping the scene when idle                                                             | "I'd love to see it still running"                                                                      | backgrounds.md           |
| Pace     | 30 to 10 fps step; 15 fps at half speed                                                  | "Hard lag"; still felt low. Now 40% speed at 20 fps                                                     | backgrounds.md           |
| Pace     | Slowing down when another app is in front                                                | Tarn stays in view beside other apps on a wide display                                                  | AGENTS.md                |
| Scenes   | Mist, Dunes, Rain, Nebula                                                                | "Too basic, just moving something"                                                                      | backgrounds.md, #35      |
| Scenes   | Sora, Fireflies                                                                          | Removed after review                                                                                    | #38                      |
| Scenes   | Comet's houses and power lines                                                           | "Very much Claude coded"; a mirrored mountain lake instead                                              | backgrounds.md, #40      |
| Scenes   | Half-resolution detailed scenes                                                          | "Very low quality"                                                                                      | backgrounds.md           |
| Scenes   | Two scenes of the same family (Suminagashi next to Contour)                              | Swapped for Koi                                                                                         | backgrounds.md           |
| Scenes   | CSS-gradient thumbnails                                                                  | Thumbnails are real frames                                                                              | backgrounds.md           |
| Page     | A background switcher at the bottom of the page                                          | Removed; wallpapers live in settings                                                                    | #10                      |
| Page     | Number keys switching wallpapers                                                         | People typed numbers and the wallpaper changed                                                          | backgrounds.md, #39      |
| Page     | Weather beside the clock                                                                 | "Get rid of it, the widget is enough"                                                                   | #26                      |
| Page     | A welcome toast, or a dot on the gear, for new users                                     | Toast too loud, dot says too little; the coach card by the gear won                                     | first-run-hints-plan.md  |
| Page     | The edit hint above the widgets                                                          | Squeezed between the search box and the holders; it sits below                                          | #50                      |
| Search   | A full-screen voice listening screen                                                     | Voice listens in the box with a level line                                                              | #44                      |
| Clock    | Tall, Duo, Nixie faces                                                                   | The owner didn't like them; stored values fall back to Classic                                          | #43, #47                 |
| Clock    | A clock on/off switch                                                                    | "None" is one of the faces                                                                              | settings-panel.md        |
| Widgets  | Weather XL                                                                               | Too large                                                                                               | #26                      |
| Widgets  | Every widget offering 1x1                                                                | Notes and Tasks stay M/L/XL                                                                             | memory                   |
| Widgets  | An icon preview on top of the site editor                                                | Image and Remove sit in the Icon row                                                                    | #31                      |
| Settings | Tabs (for now)                                                                           | People guess the tab; four labels barely fit in 330px                                                   | settings-panel.md        |
| Settings | A "Developer" section; a close button                                                    | Scares normal users; the side panel has its own close                                                   | settings-panel.md        |
| Settings | "Tarn" or "Tarn Settings" in Chrome's header; the ta mark or wordmark at the panel's top | Name read twice; over 12 characters; competed with search. Header says "Settings", wordmark closes home | settings-panel.md        |
| Settings | A "Use Tarn for new tabs" switch in the panel                                            | Not needed; the extensions page does it                                                                 | settings-panel.md        |
| Settings | "Soon" rows                                                                              | No fake features                                                                                        | settings-panel.md        |
| Settings | Cards or extra buttons for "Add a widget" and example setups                             | Back to a list with grips; example setups as one row of small buttons in Advanced                       | #39                      |
| Settings | Outline icons, emoji                                                                     | Filled glyphs only                                                                                      | settings-panel.md        |

## 9. Files map

| Area                   | File                                                        | Holds                                                                        |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Global                 | `src/styles/global.css`                                     | `@font-face` (Google Sans Flex, gothic faces), `:root` tokens, `--font-sans` |
| Fonts                  | `public/fonts/`                                             | Bundled subsets and their OFL files                                          |
| New tab tokens, layout | `src/app/tarn-app.ts`                                       | `--ink*`, `--tile-*`, `--chip*`, tone switch, page and group spacing         |
| First frame            | `src/app/first-paint.ts`                                    | Browser start colors, ghost frame, tab icon                                  |
| Settings gear          | `src/app/tarn-settings-button.ts`                           | Corner gear (Material Icons path)                                            |
| Scene arrival          | `src/backdrop/tarn-backdrop.ts`                             | Reveal, settle, crossfade timings                                            |
| Shader glass           | `src/backdrop/glass.ts`, `src/backdrop/renderer.ts`         | Blur size, frost mix                                                         |
| Scene tones, stills    | `src/backdrop/scenes/index.ts`                              | `sceneTone()`, scene base colors, `sceneStill()`                             |
| Scene cost             | `src/backdrop/scenes/load.ts`                               | Load gauge levels                                                            |
| Grid constants         | `src/widgets/geometry.ts`, `src/layout/bands.ts`            | `CELL`, `GAP`, `PITCH`, band layout                                          |
| Tiles, edit mode       | `src/widgets/tarn-board.ts`                                 | Tile look, `RADIUS`, holder, grip, hint, FLIP timings                        |
| Widget base, sheets    | `src/widgets/styles.ts`                                     | `widgetStyles`, `sheetStyles`                                                |
| Clock                  | `src/widgets/tarn-clock.ts`, `src/widgets/clock-faces.ts`   | Clock size, face styles and SVG filters                                      |
| Bookmarks              | `src/widgets/tarn-favorites.ts`, `src/widgets/site-icon.ts` | Chips, letter tiles, folders, editor sheet, `DARK_CHIP`, `siteHue`           |
| Other widgets          | `src/widgets/tarn-{notes,tasks,focus,weather,calendar}.ts`  | Each widget's own styles                                                     |
| Search box             | `src/search/tarn-search.ts`                                 | Box tokens and looks, dropdown, Lens, voice                                  |
| Settings panel         | `src/panel/tarn-panel.ts`                                   | Panel tokens and components                                                  |
| Glyphs                 | `src/ui/glyphs.ts`                                          | `GLYPHS`                                                                     |
| Wordmark               | `src/ui/wordmark.ts`                                        | The panel signature's wordmark                                               |
| Switch (popup)         | `src/ui/tarn-switch.ts`                                     | 44x26 switch used outside the panel                                          |
| Popup                  | `src/popup/tarn-popup.ts`                                   | Toolbar popup (dark only)                                                    |
| Takeover               | `src/takeover/tarn-takeover.ts`                             | Switch off other new-tab extensions (glass card, dark)                       |
| Words                  | `src/i18n/messages/*.ts`, `public/_locales/*/messages.json` | UI words; manifest name, short name, description                             |
| Brand assets           | `docs/brand/`                                               | BRAND.md, `build_logo.py`, SVG and PNG marks                                 |
| Design docs            | `docs/design/`                                              | Settings panel, widget layout, backgrounds, onboarding plan                  |
| Thumbnails             | `scripts/scene-previews.mjs`, `public/scenes/`              | Real-frame scene previews via headless Chrome                                |
