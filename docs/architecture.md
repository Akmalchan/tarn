# Architecture

How Tarn is put together, in one page. Each area has its own doc with
the details (see `docs/README.md`); this is the map between them.

## What Tarn is

A new tab page extension for Chromium browsers (Chrome, Edge, Brave,
Opera, Vivaldi, Arc) and Firefox, from one codebase. A living background
(WebGL2 shaders or the user's photos), a clock, a search box and a grid
of widgets, with settings in the browser's side panel. Calm by default,
deep for power users, private: nothing leaves the browser unless the user
asks for a feature that needs it.

Stack, decided (AGENTS.md): Lit + TypeScript (strict), WXT, raw WebGL2,
plain CSS with tokens, Apache 2.0. Lit is the only runtime dependency.

## Entrypoints

| Entrypoint   | What it is                                                                                                                                                              | Main code                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `newtab`     | The new tab page. A blocking first-paint script runs before anything draws, then the render-blocking app module draws the clock, search and widgets in the first frame. | `src/entrypoints/first-paint.ts`, `src/app/` |
| `sidepanel`  | Settings, in the browser's side panel. While open, the tab is in edit mode.                                                                                             | `src/panel/`                                 |
| `popup`      | The toolbar button: turn Tarn on or off, open settings.                                                                                                                 | `src/popup/`                                 |
| `takeover`   | A full tab to switch off other new-tab extensions (needs the optional `management` permission; a popup would close during the prompt).                                  | `src/takeover/`                              |
| `offscreen`  | Mirrors synced settings into localStorage for first paint, and keeps Tarn's extension process warm (Chromium).                                                          | `src/entrypoints/offscreen/`                 |
| `background` | Service worker: re-creates the offscreen document, saves an automatic backup before each update, side panel wiring.                                                     | `src/entrypoints/background.ts`              |

## Source folders

| Folder                          | Responsibility                                                                                                                      | Doc                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `src/app/`                      | `<tarn-app>`: the page; first paint, mirrors, side panel watch, hand-off to the browser's own new tab when Tarn is off, tile memory | this doc, `wallpapers.md` |
| `src/backdrop/`                 | The background engine: worker, renderer, scenes, glass, pace, quality                                                               | `wallpapers.md`           |
| `src/wallpapers/`               | The user's own photos                                                                                                               | `wallpapers.md`           |
| `src/widgets/`                  | The board, every widget, the clock, site icons, widget data                                                                         | `widgets.md`, `clocks.md` |
| `src/layout/`                   | The pure layout engine for widget bands                                                                                             | `widgets.md`              |
| `src/search/`                   | The search box                                                                                                                      | `search.md`               |
| `src/weather/`, `src/calendar/` | Weather providers and glyphs; calendar dates and event sources                                                                      | `widgets.md`              |
| `src/settings/`                 | Schema, storage, migrations, backups                                                                                                | `settings.md`             |
| `src/panel/`                    | The settings panel                                                                                                                  | `settings.md`             |
| `src/i18n/`                     | `t()`, `locale()`, 10 language catalogs                                                                                             | below                     |
| `src/ui/`                       | Glyphs and the wordmark                                                                                                             | `design.md`               |
| `src/styles/`                   | Global CSS, tokens, bundled fonts                                                                                                   | `design.md`               |
| `public/`                       | Scene thumbnails, fonts, icons, `_locales` (store name and description)                                                             |                           |
| `scripts/`                      | Scene thumbnail generator                                                                                                           | `wallpapers.md`           |
| `docs/`                         | These docs, the brand, research                                                                                                     | `README.md`               |

## How a new tab arrives

Smoothness over speed (details below, in "Arrival in detail"):

1. The browser paints its own new-tab color for a few frames; Tarn's
   first frame matches it (`START_COLORS`, set inline by
   `prepareFirstPaint()` in `src/app/first-paint.ts`).
2. The blocking first-paint script reads localStorage mirrors
   synchronously: scene, base color, tab icon, and on reload the ghost
   (a small still of the last frame, drawn into a canvas).
3. The app module (render-blocking) draws the clock, search box and
   widgets from mirrors, so a reload's first frame already has them.
4. The scene starts in a worker on an OffscreenCanvas, eases in over
   about 0.7 s while settling from 1.035x; widgets fade in with its first
   frame. On reload it continues from the ghost's exact moment.
5. Synced storage answers a moment later and confirms or updates
   everything.

Nothing contentful paints before the scene; nothing waits on the GPU
for more than 2.5 s (a CSS still takes over). The measured details are
below, in "Arrival in detail".

## Data

- Settings: `storage.sync` (synced), patched, never rewritten whole.
- Widget content: `storage.local` per widget, mirrored to localStorage.
- Photos (and later, library items): IndexedDB on each computer.
- Details and the never-lose-a-setup rules: `settings.md`; future
  library: `library.md`.

## Permissions

| Permission               | Why                                                                     | Install warning                                    |
| ------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------- |
| `storage`                | Settings and content                                                    | None                                               |
| `offscreen`              | First-paint mirror, warm process (Chromium)                             | None                                               |
| `sidePanel`              | Settings next to the tab                                                | None                                               |
| `favicon`                | Chrome's new-tab icon in the tab; site icons without network requests   | "Read the icons of the websites you visit"         |
| `bookmarks`              | The Bookmarks widget shows the bookmarks bar; search suggests bookmarks | "Read and change your bookmarks" (Tarn only reads) |
| `search`                 | The search box uses the browser's default engine                        | To be confirmed in a store install                 |
| `management` (optional)  | Switch off other new-tab extensions, when asked                         | Asked at that moment                               |
| `geolocation` (optional) | Weather's "Use my location", when pressed                               | Asked at that moment                               |

A new required permission in an update disables Tarn for existing users
until they accept it, so add future ones as optional.

## Network

None by default (AGENTS.md, "Network"). What talks to the internet, and
only when the user asks:

- **Weather**: Open-Meteo (or Google with the user's key) for a chosen
  place, rounded to about 1 km, at most every 30 minutes while visible.
- **Search box**: the search itself (to the user's engine); voice audio
  to Google while listening; an image to Google Lens when given; AI Mode
  opens Google's site.
- Planned: the online library (`library.md`), a calendar link.

## Languages

Every visible word goes through `t()` (`src/i18n/`), with English in
`messages/en.ts` and the same keys in all 10 catalogs (en, es, pt-BR,
fr, de, ru, ja, zh-CN, ko, tr); `i18n.test.ts` fails on a missing key or
placeholder. `locale()` goes to every Intl call. 'auto' follows the
browser. The active catalog is mirrored in localStorage so the first
frame is already in the right language. No wording that depends on a
count. Store name and description: `public/_locales`.

## Performance

Animate only transform and opacity; never block first paint; the scene
pauses when the tab is hidden and honors reduced motion; idle costs are
measured and recorded (`wallpapers.md`, `docs/research/
2026-10-new-tab-performance.md`). The scene runs at 30 fps when active,
20 fps at 40% speed after a minute idle; the quality governor steps
resolution down on slow machines.

## Working on Tarn

- `npm run dev`: the dev build with live reload, loaded in the owner's
  Chrome as "Tarn Dev" from `dist/chrome-mv3-dev`. Never build into that
  folder by hand.
- `npm run check`: typecheck, lint, tests, build. Must pass.
- Several AI sessions work on Tarn at once from the same folder. Each
  works on its own branch in a separate git worktree and ships through a
  squash-merged PR (one commit per PR); sessions announce which files
  they edit before touching them, and coordinate through messages.
- To see a change without the real extension: build into a worktree,
  serve `dist/chrome-mv3` over HTTP, and screenshot it at 2x with
  headless Chrome, stubbing the `chrome.*` APIs the page touches. Show
  the owner real renders, not descriptions (`design.md`).
- Every source file starts with the SPDX header; Google TypeScript
  style (ESLint + Prettier).

## Arrival in detail (smoothness over speed)

How a page arrives on screen matters more than how fast it does
(`src/app/first-paint.ts`, `backdrop/tarn-backdrop.ts`):

- **Opening a tab:** the browser fills the tab with its own new-tab color
  until the first frame. Tarn's first frame is the browser's _default_ new-tab
  color (`START_COLORS`, set inline by `prepareFirstPaint()`: Chrome #ffffff / #3c3c3c, Firefox #f9f9fb /
  #2b2a33), then the live scene eases in over ~0.7s while settling from
  1.035x. Under it, the page color goes from the browser's gray to the
  scene's dark base in 0.25s, so the half-faded scene is never washed in
  gray (measured, dark mode: gray gone by ~0.15s instead of ~0.35s).
  The gear, the clock and widgets appear with the scene's
  first frame (widgets fade in over 0.2s). Tried and rejected on 2026-10-12:
  a faster scene (0.45s, settle 0.65s) felt flashy. The owner wants widgets
  as soon as possible: waiting for the fade (~0.6-1s) felt "so late".
- **Reloading:** the animation continues from the exact moment the old page
  showed. A page cannot hold its first paint for async work (tested: a
  `blocking="render"` module with top-level await does not delay it), so
  Chrome presents one frame before the live scene. That frame is a _ghost_: a
  320px still captured every 0.25-1s (faster for faster scenes) and on
  `beforeunload`, with its animation moment and mean color, kept as raw RGB in
  per-tab sessionStorage. The blocking first-paint script writes it into a
  `<canvas>` synchronously, so there is no image decode and it appears whole:
  a full-screen CSS background image is rastered in tiles and was caught
  showing a half-gray "split" frame. The live scene starts at exactly the
  ghost's moment. Measured over 24 reloads (4 scenes, dev and prod): mean
  frame-to-frame change 0.3-2.1 / 255, the same as normal motion (was up to
  146 with a flat color, up to 98 with a CSS-background ghost).
- **Clock and widgets on reload:** the app module is render-blocking
  (`blocking="render"`, restored after Vite by a plugin in `wxt.config.ts`).
  Its work is synchronous, so the first frame already holds the clock and
  widgets over the ghost. Everything that frame needs is read synchronously
  from localStorage mirrors: the layout (`app/mirror.ts`), each widget's
  content (`widgets/data.ts`), site icons (`widgets/site-icon.ts`) and tile
  positions for the frost (`app/tile-memory.ts`). Measured over 4 scenes:
  worst reload frame change 0.3-3.6 / 255, all of it the ghost's lower
  resolution; widgets don't change at all (was 4-8 with a one-frame blink).
- On a new tab, nothing contentful paints before the scene: controls appear
  after `tarn-revealed`, the clock and widgets after `tarn-settled`, which
  fires right with it (fully in by ~0.3s). The frost follows the whole
  settle every frame (`followSettle`), so it stays behind the tiles.
- Before the page exists, the browser's pre-paint color is outside any
  extension's control in Chrome (tested 2026-10-11: chrome://theme is blocked,
  CSS system colors don't reflect it, a transparent page shows white). An
  empty extension page needs ~40-70ms to paint; Tarn adds ~4ms.
- An offscreen document (`entrypoints/background.ts`, reason LOCAL_STORAGE)
  mirrors synced settings into localStorage and keeps Tarn's extension process warm,
  which cut first paint after idle from ~85ms to ~52ms.
- Background sources other than shaders follow the same rules: keep
  originals in IndexedDB, ease in on open, ghost on reload, never block first
  paint on async storage. **Photos do this now** (`photo:<id>` scenes;
  `wallpapers/store.ts` keeps the original, a display copy and a thumbnail;
  `photoScene()` in `scenes/index.ts`). First paint knows a photo's base
  color and tone synchronously from the `tarn.photos` localStorage index.
  The renderer decodes the display copy in the worker at the size the
  screen needs (cover fit, full pixel density up to 2x), draws one frame and
  stops: a still photo costs ~0% while idle (measured: page ~0%, graphics
  ~1.7% vs 8-11% for a shader). Scene switches wait for the photo's first
  frame (`sceneShown`) before fading in. A photo missing on this computer
  (synced from another, or deleted) shows the default scene. Video, if ever
  added, should follow the same path.
