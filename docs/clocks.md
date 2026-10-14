# Clocks

The big clock and date above the widgets, and the faces it can wear. This
file is for whoever picks up a clock task cold: what exists, how it is
drawn, what the owner already turned down, and the steps for adding or
removing a face. Checked against the code on 2026-10-14.

## Summary

- One element, `<tarn-clock>` (`src/widgets/tarn-clock.ts`), draws the time
  and the date line. It ticks once a minute, on the minute, and never while
  the tab is hidden.
- The look is the **face**: the `clock` setting, one of `CLOCK_STYLES`
  (`src/settings/schema.ts`). There are 15 faces plus `none`, which hides
  the clock. The default is `center` ("Classic").
- Everything a face needs (markup, CSS, SVG filters) lives in
  `src/widgets/clock-faces.ts`. The clock on the tab and the thumbnails in
  settings both use it, so a thumbnail is a true small copy.
- Only two faces load a font of their own (Fraktur, Gotisch). They are
  bundled OFL subsets, never fetched from the network.
- The owner has removed three faces after seeing them (Tall, Duo, Nixie)
  and the weather on the date line. Check section 5 before proposing
  something similar.

### Read this before…

| Before you…                       | Read                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| add, change or remove a face      | sections 4, 5 and 6 here, then `docs/brand/BRAND.md` (fonts, glow, light and dark rules)      |
| change clock size or position     | `docs/widgets.md` (the clock is 112px everywhere; no scaling)                                 |
| change how the clock appears      | "Arrival" in `architecture.md` (the clock comes in with the scene; a reload draws it at once) |
| change the Clock page in settings | `docs/settings.md` (home card, "Show All", pictures not names)                                |
| add a font                        | section 2 "Fonts" here and the "Brand typeface" part of `docs/brand/BRAND.md`                 |
| change any visible word           | the "Words" rule in `AGENTS.md` (all 10 catalogs, `t()`, `locale()`)                          |

## 2. How a clock is drawn

### The element

`src/widgets/tarn-clock.ts` defines `TarnClock` (`<tarn-clock>`), a Lit
element with two reactive properties:

- `now` (state): the `Date` being shown.
- `face` (attribute, reflected): any `ClockStyle` except `'none'`.
  Defaults to `'center'`.

`render()` outputs, in its shadow root:

1. `faceFilters`, the hidden `<svg>` with the filters some faces use.
2. `<time class="t <face>" datetime="<ISO>">` holding
   `clockTime(face, time, now, previous)`.
3. `<div class="date">` with the date, except for the `minimal` face.

`src/app/tarn-app.ts` places it: inside `.page > .group`, first in the
column, above the search box and the widget board. When the setting is
`'none'` the element is not rendered at all.

### Time text

`clockText(now, tag = locale())` in `src/widgets/clock-faces.ts` formats
hours and minutes with `Intl.DateTimeFormat(tag, {hour: 'numeric', minute:
'2-digit'})`, then keeps only the hour, the minute and the literal between
them. AM/PM is dropped wherever the language puts it. The separator is the
language's own (`:` in most, `.` in Finnish); `:` is the fallback. Whether
the hour is 12- or 24-hour follows the language. `clock-faces.test.ts`
pins `en-US` "9:40", `en-GB` "21:40", `ko` "9:40", `ja` and `de` "21:40",
`fi` "21.40".

Helpers built on that string:

- `splitTime(time)` returns `[hh, mm]` with the hour padded to two digits.
  Stacked and Flip use it, so they always show two hour digits.
- `handAngles(hours, minutes)` returns degrees from 12 for the analog hands
  (tested).

### The date line

`now.toLocaleDateString(locale(), {weekday: 'long', month: 'long', day:
'numeric'})`, for example "Wednesday, October 14". 19px, weight 450,
`--ink-dim`, 12px under the time; 16px on phone-narrow windows. Every face
shows it except `minimal`. Fraktur and Gotisch set the date in their own
blackletter font (`.t.fraktur + .date`, `.t.gotisch + .date`). No other
face styles the date.

The rule "minimal hides the date" is written twice: in `TarnClock.render()`
and in `clockArt()` in `src/panel/tarn-panel.ts`. Change both together.

### Ticking and hidden tabs

`tick()` remembers the text shown so far in `previous` (for Flip), sets
`now = new Date()`, and, only if the document is visible, schedules the
next tick for 20ms after the next whole minute. `visibilitychange` restarts
`tick()` when the tab becomes visible and clears the timer when it is
hidden. So a hidden tab does no clock work at all, and a tab coming back
shows the right time at once. Nothing runs every second.

`new LocaleController(this)` re-renders the clock when the language
changes. A re-render that is not a tick keeps `previous`, so Flip does not
replay.

### Arrival

The clock follows the "Arrival" rules in `architecture.md`:

- **New tab:** `tarn-app` renders the page (clock included) only after the
  backdrop fires `tarn-settled`. The clock then fades in over 200ms
  (`controls-in` animation on `tarn-clock`).
- **Reload:** `arrival() === 'resume'`, the `.group` gets `data-in-place`,
  the animation is off, and the clock is in the first frame. The face comes
  from the `tarn.home` localStorage mirror (`src/app/mirror.ts`, written by
  `mirrorSettings`), read synchronously in `TarnApp`'s constructor, so no
  async storage read is needed.

### Sizing and position

- The time is 112px on every screen (`docs/widgets.md` rule 1),
  72px at `max-width: 480px`. Base text: weight 200, line-height 0.92,
  letter-spacing -0.04em, tabular numbers.
- Tab-only per-face sizes live in `tarn-clock.ts`: Stacked is 104px (72px
  on narrow windows, like the rest), Pixel has line-height 1.
- Drawn faces size in `em` from the clock's font size: Pixel's SVG is
  0.6em tall, LCD's 1.04em, Analog's 1.55em square, Flip's card padding
  and radius are in em. That is how the same code fits a 112px clock and a
  settings thumbnail.
- The clock and the widgets are one centered group a little above the
  middle (`.page`/`.group` in `tarn-app.ts`, 56px gap). The search box sits
  under the clock with `margin-top: -24px` (so 32px).

### Color and tone

The clock uses `--ink`, `--ink-dim` and `--ink-shadow` from `tarn-app.ts`.
`tarn-app` sets `tone="light"` or `"dark"` from the scene, and light scenes
switch the ink to dark text with no shadow. Faces that ignore tone on
purpose: Flip (dark cards with light digits in any light) and Neon (fixed
near-white with a pink glow). Glass switches to a second filter on light
scenes (see below).

### How faces are applied

Two mechanisms, both in `src/widgets/clock-faces.ts`:

1. **CSS: `faceStyles`.** A `css` block with rules for `.t.<face>`. Any
   element with classes `t <face>` gets the look, both the clock's
   `<time>` and the panel's thumbnail `<span>`. Sizes stay with the caller.
   A light background is detected by `:host([tone='light'])` (the clock
   reflects the wallpaper's tone, which `tarn-app` passes in) or a `.light`
   ancestor (the panel thumbnails).
2. **Markup: `clockTime(face, time, now?, previous?)`.** Returns the plain
   text for most faces, and markup for five:
   - `stacked`: `<span class="hh">` and `<span class="mm">` (grid, hours
     over minutes).
   - `flip`: `flipTime()`, two split-flap cards.
   - `lcd`: `lcdTime()`, an inline SVG of seven-segment digits.
   - `pixel`: `pixelTime()`, one SVG path from a 5x7 bitmap.
   - `analog`: `analogTime()`, an SVG dial.

   The SVG faces carry `role="img"` and `aria-label` with the time text.

**SVG filters: `faceFilters`.** A hidden `<svg class="face-filters">` with
four filters, rendered once in each shadow root that shows a clock (the
clock's and the panel's). CSS references them by id with `filter: url(#…)`.
All use `primitiveUnits="objectBoundingBox"`, so their radii are fractions
of the text box and the same filter fits the big clock and a thumbnail.

| Filter id          | Used by                   | What it does                                                                              |
| ------------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| `face-outline`     | Outline                   | Dilates the glyphs and cuts the glyphs out, leaving a ring filled with the ink color      |
| `face-round`       | Rounded                   | Blurs the alpha and thresholds it again, melting the corners                              |
| `face-glass`       | Glass on dark wallpapers  | Translucent body (16% white), specular bevel, bright rim, soft drop shadow                |
| `face-glass-light` | Glass on light wallpapers | The same with a darker lower rim and a fainter shadow, so it reads on a bright background |

`.face-filters .ink { flood-color: currentColor }` makes the outline and
round filters follow `--ink`.

### Fonts and how they load

| Font             | File                                                  | License file                              | Used by                                                      |
| ---------------- | ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| Google Sans Flex | `public/fonts/google-sans-flex-latin.woff2` (~139 KB) | `public/fonts/OFL.txt`                    | Every face except Serif, Fraktur, Gotisch, and the date line |
| Tarn Fraktur     | `public/fonts/tarn-fraktur-latin.woff2` (~23 KB)      | `public/fonts/OFL-UnifrakturMaguntia.txt` | Fraktur, time and date                                       |
| Grenze Gotisch   | `public/fonts/grenze-gotisch-latin.woff2` (~49 KB)    | `public/fonts/OFL-GrenzeGotisch.txt`      | Gotisch, time and date                                       |
| system serif     | none (`ui-serif`, New York, Iowan Old Style, Georgia) | n/a                                       | Serif                                                        |

- The `@font-face` rules are in `src/styles/global.css`, which the new tab,
  side panel and take-over pages import. They must stay at document level:
  Chrome ignores `@font-face` inside a shadow root's styles.
- All three use `font-display: block`. A browser downloads a font only when
  some text uses it, so the gothic files load only when a gothic face is on
  screen (on the tab, or as a thumbnail on the Clock page).
- "Tarn Fraktur" is a Latin subset of UnifrakturMaguntia, renamed because
  its license has a Reserved Font Name and a subset counts as a modified
  version. Grenze Gotisch declares none, so it keeps its name.
- Subsets are Latin only, on purpose (2026-10-14): blackletter is a Latin
  style. In Russian, Japanese, Chinese or Korean, the gothic faces' date
  falls back to `ui-serif` for the non-Latin letters.
- Google Sans Flex is the brand font: default design only, `ROND` pinned to
  0 in the subset. Glass sets `font-variation-settings: 'opsz' 144`. The
  Rounded face rounds with an SVG filter, not the font's roundness axis.
- There is no script in the repo that produced the subsets. If you make
  one, record the command in this file.

### Motion

Only Flip moves. When a card's number changes, `keyed()` gives it a new
element so the animation plays once: the old top half falls (`flap-fall`,
260ms), then the new bottom half lands (`flap-land`, 340ms after 250ms).
Each flap dims as it tilts away through a black `::before` layer whose
opacity animates (`flap-shade`, `flap-unshade`): transform and opacity
only. The bottom halves are `aria-hidden`, so a screen reader reads each
number once.
With `prefers-reduced-motion: reduce` the top flap is hidden and the bottom
does not animate: the new number just appears.

## 3. Settings

### Stored value

`Settings.clock: ClockStyle` in `src/settings/schema.ts`, default
`'center'`. `normalizeSettings` keeps any value in `CLOCK_STYLES` and turns
anything else into `'center'`. `'center'` is the Classic face; its id
predates the other faces and was kept so stored settings keep working.

Settings sync between computers on different Tarn versions.
`saveSettings` (`src/settings/store.ts`) rewrites only the fields a change
touches, so a face this version does not know (written by a newer Tarn, or
removed since) stays in storage and is shown as Classic here. It is
replaced only when the user picks a face. `protection.test.ts` pins this
with a made-up newer face, `'hologram'`.

### Home: the Clock card

`renderHome()` in `src/panel/tarn-panel.ts` shows a card of four square
tiles: three faces and "Show All". The three come from
`HOME_FACES = ['center', 'minimal', 'none']` through `pickShown`: if the
current face is not among them, it takes the last place, so the user's
choice is always visible and the tiles don't reshuffle. The "Show All"
tile is the current wallpaper, blurred, with a grid glyph.

### The Clock page

`renderClock()` shows every face in `CLOCK_STYLES` order, two per row,
16:10 tiles. The page's search field ("Search Clocks") filters by the
face's name **in the current language** (`t(FACE_NAMES[face])`); no match
shows `panel.noClocks`.

### Thumbnails on the current wallpaper

`faceButton(face, preview)` draws each tile:

- `clockPreview(this.art(this.settings.scene))` takes the current wallpaper
  (scene preview or the user's photo) and its tone, the time from
  `clockText(new Date())`, and the date in the same format as the clock.
  It is computed on render; the panel has no clock timer, so thumbnails
  don't tick.
- `clockArt(face, preview)` renders `<span class="t <face>">` with
  `clockTime(face, time)` and, unless the face is `minimal`, a
  `<span class="d">` date. No `now` or `previous` is passed, so Analog reads
  its hands from the text and Flip never animates.
- The `none` tile shows the word "Off" (`panel.face.off`) instead of a
  clock; its name under the tile is "None".
- The tile's class is the wallpaper's tone (`dark` or `light`), which sets
  the text color and lets `.light .t.glass` pick the light glass filter.
- Thumbnail text is sized in container units (`.thumb .t`: 27cqi on the
  home tiles, 17cqi on the Clock page; the date 7.5cqi and 5cqi), so a
  thumbnail is the real clock scaled down at any panel width.
- The panel's CSS ends with `${faceStyles}` so face rules beat the
  thumbnail base rule (`.thumb .t`, same specificity). Keep it last.
- Rounded drops its filter in thumbnails (`.thumb .t.rounded { filter:
none }`): too small to melt, it just shows the heavy weight.
- The panel renders `faceFilters` once at the top of its shadow root.

Picking a tile calls `applyPatch({clock: face})`; open tabs update live
through storage change events.

### Search words

Settings search (`SEARCH_INDEX`, the `panel.clock` entry) matches the
translated label plus a fixed English word list: `time date face classic
glass bold rounded minimal serif stacked outline pixel 8-bit retro flip lcd
digital neon gothic fraktur gotisch analog dial hide`. A hit opens home and
flashes the Clock card.

### Hiding the clock

`'none'` is a face, not a switch. `docs/settings.md` records
that a separate on/off switch was considered and rejected. With `'none'`,
`tarn-app` doesn't render `<tarn-clock>`; the search box and widgets keep
their places in the group.

## 4. The library

In `CLOCK_STYLES` order (the order settings shows). All use Google Sans
Flex unless the Look column says otherwise. "Markup" means `clockTime`
returns something other than plain text.

| #   | id        | Name (en) | Look                                                                                                                     | Special rendering                                                                                      | Date             |
| --- | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | `center`  | Classic   | Weight 200, -0.04em, line-height 0.92, tabular numbers. The default.                                                     | None. No `.t.center` rule; the base `time` style is the face.                                          | Yes              |
| 2   | `glass`   | Glass     | Weight 720, `opsz` 144, -0.035em, no text shadow                                                                         | `filter: url(#face-glass)`; `#face-glass-light` on light wallpapers                                    | Yes              |
| 3   | `bold`    | Bold      | Weight 600, -0.05em                                                                                                      | None                                                                                                   | Yes              |
| 4   | `rounded` | Rounded   | Weight 740, -0.03em                                                                                                      | `filter: url(#face-round)` on the tab; no filter in thumbnails                                         | Yes              |
| 5   | `minimal` | Minimal   | Same as Classic                                                                                                          | None                                                                                                   | No               |
| 6   | `serif`   | Serif     | System serif (`ui-serif`, New York, Iowan Old Style, Georgia), weight 400, -0.02em                                       | None; loads no font                                                                                    | Yes              |
| 7   | `stacked` | Stacked   | Weight 700, line-height 0.84, -0.05em; 104px on the tab                                                                  | Markup: hours over minutes in a grid, hour padded to two digits                                        | Yes              |
| 8   | `outline` | Outline   | Weight 500, no text shadow                                                                                               | `filter: url(#face-outline)`, a ring around filled digits                                              | Yes              |
| 9   | `pixel`   | Pixel     | 8-bit digits drawn for Tarn, 0.6em tall                                                                                  | Markup: one SVG path from a 5x7 bitmap, each pixel 0.9 of its cell; `:` or `.` becomes a two-dot colon | Yes              |
| 10  | `flip`    | Flip      | Weight 640, -0.02em; light digits (#f2f2f2) on dark gradient cards with a hinge line and a drop shadow, in any light     | Markup: two split-flap cards (HH, MM); flaps animate on change; still with reduced motion              | Yes              |
| 11  | `lcd`     | LCD       | Seven-segment digits, skewed -7 degrees, unlit segments at 9% opacity, 1.04em tall, no text shadow                       | Markup: inline SVG; a one-digit hour leaves the first place dark                                       | Yes              |
| 12  | `neon`    | Neon      | Weight 260, -0.01em, near-white (#fff3f8) with five layers of pink glow (text-shadow)                                    | None; ignores tone                                                                                     | Yes              |
| 13  | `fraktur` | Fraktur   | Tarn Fraktur (UnifrakturMaguntia subset), weight 400, line-height 1                                                      | Bundled font; the date is set in it too (weight 400)                                                   | Yes, blackletter |
| 14  | `gotisch` | Gotisch   | Grenze Gotisch, weight 700, line-height 1, -0.01em                                                                       | Bundled font; the date is set in it too (weight 650)                                                   | Yes, blackletter |
| 15  | `analog`  | Analog    | A quiet dial, 1.55em square: 60 ticks (hours heavier, quarters heaviest, minutes faint), two rounded hands, a center dot | Markup: SVG; hands from `now` on the tab, from the text in thumbnails; moves once a minute             | Yes              |
| 16  | `none`    | None      | No clock                                                                                                                 | `<tarn-clock>` not rendered; thumbnail says "Off"                                                      | n/a              |

When faces arrived: Classic (as `center`) with the first widgets (#2);
Bold and Minimal with the settings panel (#4); Serif, Stacked, Outline and
Pixel (#18); Glass, Rounded and Analog (#42, together with Duo and Tall);
Flip, LCD, Neon, Fraktur and Gotisch (#45, together with Nixie); the real
split-flap Flip (#46).

## 5. Removed and rejected, and the owner's taste

| What                       | When                                 | What it was                                                                               | Why it went                                                                                                   |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tall (`tall`)              | Added #42, removed #43               | Weight 330, -0.07em, stretched `scaleY(1.5)`                                              | The owner didn't like it ("stretched")                                                                        |
| Duo (`duo`)                | Added #42, removed #43               | Heavy hours (760), a 50% separator (300), hairline minutes (150)                          | The owner didn't like it                                                                                      |
| Nixie (`nixie`)            | Added #45, reworked #46, removed #47 | Orange glowing digits in glass tubes, unlit cathodes behind, honeycomb mesh, a socket     | The owner did not want it after all, even after the rework                                                    |
| Weather on the date line   | Added #25, removed #26               | An icon and temperature after the date (`weather.clock` setting, Settings > Clock switch) | The owner: "get rid of it, the widget is enough"                                                              |
| Outline with `text-stroke` | #18, replaced in #42                 | `-webkit-text-stroke: 1.5px` with a transparent fill                                      | Stroke traced the font's overlapping contours: stray lines inside 2, 6 and 9. Now the `face-outline` SVG ring |
| A clock on/off switch      | Settings panel design                | A separate toggle                                                                         | The clock is picked by face; None is one of them                                                              |

Stored `tall`, `duo` and `nixie` values (and `weather.clock`) are kept in
storage and ignored: those users see Classic. Don't reuse these ids for a
different look; a synced old setting would suddenly show it.

Taste notes that apply to clocks:

- Show the owner rendered options at real size on a real wallpaper, with
  short verdicts. They react to pictures, not descriptions. Expect blunt
  "no" and remove the face cleanly when it comes (#43 and #47 each took
  minutes).
- Calm first. The default stays Classic: thin, quiet, with the date.
- The clock is one fixed size everywhere (112px; phone-narrow excepted).
  Don't scale it with the window, and don't make a face much bigger or
  smaller than the others.
- Brand font untuned: no roundness, width or slant changes to Google Sans
  Flex (`docs/brand/BRAND.md`). New faces so far reach their look with
  weight, spacing, filters or drawing, never by tuning the font's axes
  (Glass's `opsz` is the font's optical size, the same value the brand mark
  uses).
- Assets: only Google Fonts or fully free (OFL or similar) fonts, bundled,
  never loaded at runtime. The owner's rule is "only Google or fully free
  assets".
- Original work only (`AGENTS.md`). Don't copy another product's clock
  artwork or CSS; use it as inspiration.
- `docs/brand/BRAND.md` says "No rainbow, prism, iridescence or AI-style
  glow. Anywhere." and "Every new visual needs a light version and a dark
  twin." Check a new face against both. (Neon and Flip are tone-fixed by
  design; see "Contradictions" at the end.)
- The owner favors realism over cute, "procedural" props (from the scenes
  work, Comet #40). A skeuomorphic face has to look real, like the second
  Flip, or not ship.

## 6. How to add a face

1. **Name and order.** Add the id to the `ClockStyle` union and to
   `CLOCK_STYLES` in `src/settings/schema.ts`, at the place it should appear
   in settings (`'none'` stays last). Use a new id, never a removed one
   (`tall`, `duo`, `nixie`) and not `hologram` (the test's stand-in for an
   unknown face). Normalization accepts it automatically.
2. **Look.** In `src/widgets/clock-faces.ts`:
   - Add `.t.<id>` rules to `faceStyles`. Use `em` for every length so the
     thumbnail matches. Keep selectors at least as specific as `.t.<id>`
     (the panel's `.thumb .t` has the same weight; `faceStyles` wins by
     coming last).
   - If it should change on light wallpapers, add both
     `:host([tone='light']) .t.<id>` (the clock reflects the wallpaper's
     tone, set by the app) and `.light .t.<id>` (settings thumbnails).
     Not `:host-context()`: Firefox doesn't support it.
   - If it needs markup, add a branch to `clockTime()`. It must work from
     the `time` string alone (thumbnails pass no `now` or `previous`), and
     every hour/separator form `clockText` can produce: one- or two-digit
     hours, `:` or `.`.
   - Drawn SVG gets `role="img"` and `aria-label=${time}`.
   - A filter goes into `faceFilters` with
     `primitiveUnits="objectBoundingBox"`.
   - Motion: transform and opacity only, once a minute at most, and a
     `prefers-reduced-motion: reduce` rule that shows the new time with no
     motion.
3. **Clock-only tweaks.** Font size or line-height for the tab only goes
   into `TarnClock.styles` as `:host([face='<id>']) time`. If the face hides
   the date, change the `minimal` check in both `TarnClock.render()` and
   `clockArt()` in `src/panel/tarn-panel.ts`.
4. **Font, only if needed.** Google Fonts or another OFL font only.
   - Subset to Latin, woff2, into `public/fonts/`.
   - Add its license as `public/fonts/OFL-<Name>.txt`.
   - If the license has a Reserved Font Name, the subset must be renamed
     (as Tarn Fraktur was).
   - Add the `@font-face` to `src/styles/global.css` (document level, not
     a component), with `font-display: block`.
   - Reference it only from the face's rule so it loads only when shown.
5. **Settings.** Add the id to `FACE_NAMES` in `src/panel/tarn-panel.ts`
   (TypeScript fails until you do). Add its English name and any synonyms
   to the clock entry's `words` in `SEARCH_INDEX`. Change `HOME_FACES` only
   if the owner asks.
6. **Words.** Add `panel.face.<id>` to `src/i18n/messages/en.ts` and the
   same key to the 9 other catalogs (de, es, fr, ja, ko, pt-BR, ru, tr,
   zh-CN). `src/i18n/i18n.test.ts` fails on a missing key.
7. **Tests.** `settings.test.ts` already checks every id in `CLOCK_STYLES`
   survives normalization. Add a test in `src/widgets/clock-faces.test.ts`
   for any pure helper the face adds (as `handAngles` has).
8. **Look at it.** In `npm run dev`: on a dark and a light wallpaper, at a
   phone-narrow width, with reduced motion, in a 12-hour language (en-US,
   ko) and a 24-hour one, and in Finnish (`.` separator) if the face draws
   digits. Check both thumbnail sizes (home card if it is selected, and the
   Clock page). Then `npm run check`.
9. **Record it.** A line under "Unreleased > Added" in `CHANGELOG.md`; a row
   in the table in section 4 here; the face list in the doc comment of
   `src/widgets/tarn-clock.ts`.

**Removing a face** is the reverse: drop it from `ClockStyle`,
`CLOCK_STYLES`, `FACE_NAMES`, the search words, all 10 catalogs, its code
and styles in `clock-faces.ts`, any font, `@font-face` and license file
only it used, and its CHANGELOG line. Don't migrate the stored value:
normalization shows Classic, and storage keeps the old value (the
never-lose rule). Add a row to section 5.

## 7. Files

| File                                                  | What it holds                                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/widgets/tarn-clock.ts`                           | `<tarn-clock>`: ticking, visibility, date line, tab sizes                                                                                            |
| `src/widgets/clock-faces.ts`                          | `clockText`, `splitTime`, `clockTime`, the drawn faces (`flipTime`, `lcdTime`, `pixelTime`, `analogTime`, `handAngles`), `faceStyles`, `faceFilters` |
| `src/widgets/clock-faces.test.ts`                     | Time text per language, stacked split, analog hand angles                                                                                            |
| `src/settings/schema.ts`                              | `ClockStyle`, `CLOCK_STYLES` (settings order), default `'center'`, normalization                                                                     |
| `src/settings/store.ts`                               | Saves only changed fields, so unknown faces survive                                                                                                  |
| `src/settings/settings.test.ts`, `protection.test.ts` | Every face survives normalization; an unknown newer face (`'hologram'`) is kept                                                                      |
| `src/app/tarn-app.ts`                                 | Where the clock renders, `none`, tone, arrival fade                                                                                                  |
| `src/app/mirror.ts`                                   | `tarn.home` localStorage mirror, so a reload draws the right face in its first frame                                                                 |
| `src/panel/tarn-panel.ts`                             | `HOME_FACES`, `renderHome`, `renderClock`, `faceButton`, `clockPreview`, `clockArt`, `FACE_NAMES`, `SEARCH_INDEX`                                    |
| `src/styles/global.css`                               | `@font-face` for Google Sans Flex, Tarn Fraktur, Grenze Gotisch                                                                                      |
| `public/fonts/`                                       | The three woff2 subsets and their OFL license files                                                                                                  |
| `src/i18n/messages/*.ts`                              | `panel.face.<id>`, `panel.face.off`, `panel.clock`, `panel.page.clock`, `panel.searchClocks`, `panel.noClocks`                                       |
| `docs/widgets.md`                                     | The clock's fixed size and place in the layout                                                                                                       |
| `docs/settings.md`                                    | The Clock card and page                                                                                                                              |
| `docs/brand/BRAND.md`                                 | Brand font rules, no-glow rule, light and dark rule                                                                                                  |

## Contradictions and open questions (found 2026-10-14)

- **Neon and the brand.** `BRAND.md` bans "AI-style glow" anywhere and
  asks for a light and a dark version of every new visual. Neon is a glow
  and ignores tone; Flip also ignores tone. The owner shipped both, so treat
  them as accepted exceptions, but ask before adding another glow face.
- **CHANGELOG gaps.** It lists Glass, Rounded, Analog, Flip, LCD, Neon,
  Fraktur and Gotisch, and the Outline fix, but not Bold, Minimal, Serif,
  Stacked or Pixel.
- **Clock page search is single-language.** It matches only the face's
  name in the current language, so in German "gothic" or "glass" finds
  nothing there, while the general settings search also takes English
  words.
- **Fonts.** `font-display: block` with no preload: the first time a gothic
  face is shown, the time may be invisible for a moment while the font
  loads. Not measured.
