# Tarn: notes for AI agents and contributors

Open-source new tab page for every browser, with GPU-rendered backgrounds.
Goal: ultra clean and calm by default, deeply customizable for power users.

Read CONTRIBUTING.md for structure and principles, and
`docs/research/2026-10-new-tab-research.md` before adding any feature: it
records what users want and hate, and Tarn's five product promises. Read
`docs/brand/BRAND.md` before any visual, naming, icon or store-listing work:
there is no logo, the `ta` mark is only for square slots, and it lists what
was already rejected. The essentials:

## Stack (decided, don't change without discussion)

- **Lit + TypeScript (strict)**: Web Components; Lit is the only runtime dependency.
- **WXT**: builds Chromium and Firefox from one codebase (`src/entrypoints/`).
- **Raw WebGL2**: no three.js or shader libraries.
- **Plain CSS** with tokens in `src/styles/global.css`.
- **Apache 2.0**: every source file carries the SPDX header.
- Google TypeScript style (ESLint + Prettier). `npm run check` must pass.

## Rules

- **Ownership:** write original code. Never copy from proprietary sites or
  apps, including shaders; use them as inspiration only.
- **Network:** none by default. A feature that needs the network is an
  explicit, opt-in decision; document it in README and here before building.
- **Permissions:** `storage`, `offscreen` (see Arrival), `sidePanel`, and
  `favicon` (Chrome's own new-tab icon in the tab; later, site icons without
  network requests). Its install warning is "Read the icons of the websites
  you visit", a deliberate trade-off. The manifest's 16/32px icons are
  the ta mark (small master, docs/brand). Chrome uses them for two things:
  the side panel header's icon (next to "Settings", the manifest
  `short_name`), and the tab icon for the split second before a page exists
  (~10ms on reload; while the tab is created on open, measured 2026-10-11).
  They used to be transparent so the tab never showed Tarn's icon, but that
  left the side panel header blank; on 2026-10-13 the owner chose a filled
  header over that brief flash. The toolbar button uses `action.default_icon`
  (popup meta). Settings > Tab icon offers "Chrome" (default: Chrome's icon
  via the favicon API) and "None" (a transparent icon once the page exists).
  `management` is
  _optional_, requested only when the user asks Tarn to switch off another
  new-tab extension (Chromium only). Adding any permission needs a stated reason.
- **Performance:** never block first paint; animate only transform/opacity;
  backgrounds pause when hidden and honor `prefers-reduced-motion`.
- **Settings** go through `src/settings/` (versioned key, normalized on read).
  Never trust stored data's shape.

## Arrival (smoothness over speed)

How a page arrives on screen matters more than how fast it does
(`src/app/first-paint.ts`, `backdrop/tarn-backdrop.ts`):

- **Opening a tab:** the browser fills the tab with its own new-tab color
  until the first frame. Tarn's first frame is the browser's _default_ new-tab
  color (CSS `--tarn-start`: Chrome #ffffff / #3c3c3c, Firefox #f9f9fb /
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
  mirrors synced settings into localStorage and keeps Tarn's renderer warm,
  which cut first paint after idle from ~85ms to ~52ms.
- Future background sources (user photo, video) follow the same rules: keep
  originals in IndexedDB, ease in on open, ghost on reload, never block first
  paint on async storage.

## Widgets

Layout rules and the evidence behind them: `docs/design/widget-layout.md`.

- A widget is its own custom element (code, styles, storage by `widgetId`)
  plus one entry in `widgets/registry.ts`. Modules load eagerly on purpose:
  a reload must draw every widget in its first frame.
- **Edit mode:** while the settings side panel is open (`watchSidePanel`),
  widgets can be dragged (Pointer Events + capture) or moved with arrow
  keys. Positions come from the layout engine, never free placement;
  `widgets/geometry.ts` (`nearestIndex`) picks the slot under the pointer.
  Widget contents are `inert` meanwhile.

- `layout/bands.ts` places widgets (pure function, ~12 µs for 9 widgets,
  ~42 µs for 30; columns are always 2, 4 or 6);
  `widgets/tarn-board.ts` positions tiles with transforms and animates moves
  with FLIP (transform and opacity only).
- Nothing runs while idle: the board recalculates only when widgets change
  or the window crosses one of 5 column widths (`matchMedia`); the clock
  ticks once a minute, the focus timer once a second only while running;
  hidden tabs do neither. Measured idle with 9 widgets: 0 layouts, 0-15 style
  recalculations per 8 s, page main thread ~0.5% busy (same as no widgets).
- **Frosted glass is drawn by the scene** (`backdrop/glass.ts`): the frame
  renders to a texture, mipmaps give soft copies, and a final pass shows them
  inside the tiles' rounded rectangles. CSS `backdrop-filter` re-blurs the
  moving canvas every frame (measured ~2% -> ~8% compositor). With no
  widgets the renderer draws straight to the screen as before. Never fade a
  tile container with opacity; it would break CSS glass in the still
  fallback.
- Widget content lives in `storage.local` (`widget.<id>`), apart from synced
  settings; removing a widget keeps its content.

## Rendering performance

- **Pace** (`backdrop/pace.ts`, `renderer.ts`): the scene never stops while
  visible. It is `active` (full speed, 30 fps) while the page is used, and
  `calm` (half speed, 15 fps) after 1 min without input or while another app
  is in front. The frame rate follows the speed continuously (frame interval
  = normal interval / speed), so each frame moves the same distance and the
  change is never felt as a step. Calming eases over ~10 s (measured fps per
  second: 30 30 29 25 22 20 19 18 17 17 16 15); waking eases back in ~1.5 s.
  Synthetic pointermoves under a resting cursor are ignored. Settings open
  keeps it active. Hidden tabs stop as before.
- Between frames the loop sleeps on a timer and rejoins the display's frame
  callbacks ~12 ms before a frame is due, instead of waking at every
  refresh (120 Hz) to skip. Frames stay evenly spaced (measured: 30.3/s,
  gaps 32-36 ms).
- Ghost snapshots are skipped when the moment hasn't changed, and taken less
  often at slower paces.
- Measured idle cost (M4, headed Chrome, % of one core, page / graphics):
  active 4.1-5.8 / 7.5-10.6; calm 2.7 / 5.8.
- The shader prelude offers the same gradient noise two ways: `noise`/`fbm`
  (computed per pixel, exact) and `noiseFast`/`fbmFast` (one fetch from a
  512x512 R16F texture baked from the identical function, an exact port of the
  GLSL hash; `backdrop/noise-texture.ts`, tested texel by texel). Use the fast
  pair when noise is used gently (Ember, Bloom). Heavily domain-warped scenes
  (Tarn) must use the exact pair: chained warps amplify the texture's ~0.001
  differences chaotically into a visibly flatter pattern (measured 2026-10-11:
  plain noise error 0.2/255, warped Tarn 6-16/255).
- `backdrop/quality.ts` watches frame pacing and steps resolution and fps down
  (1x@30 -> 0.5x@20) when frames run late, and back up after ~20s of headroom,
  never retrying a level that just failed. Few cores or little memory start
  one or two steps lower.

## Robustness (audited 2026-10-11)

- **No WebGL / worker failure / slow GPU:** the backdrop races the first live
  frame against an `unavailable` signal and a 2.5s timer; otherwise it shows
  `sceneStill()` (the scene as a CSS gradient) and reveals the controls, so
  the page and its settings never wait on the GPU. A late live frame then
  fades in over the still.
- **Long-lived tabs:** a hidden tab wraps its animation clock once it passes
  24h of animation time, before float32 shader time loses precision.
- **Ghost cost:** pixels are encoded to base64 in the render worker (~2.6ms
  per ghost on an M4 kept off the main thread); a device the quality governor
  stepped down saves ghosts proportionally less often.
- **Settings writes are serialized** (`settings/store.ts`) so concurrent saves
  from a tab and the side panel can't drop each other; failed writes (sync
  quota) are logged and the next save retries.
- **Warm process:** new tabs message the service worker after reveal, which
  re-creates the offscreen document if Chrome closed it.

## Commands

- `npm run dev`: browser with live reload
- `npm run check`: typecheck + lint + test + build
- `npm run build` / `npm run build:firefox`
