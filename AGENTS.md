# Tarn: notes for AI agents and contributors

Open-source new tab page for every browser, with GPU-rendered backgrounds.
Goal: ultra clean and calm by default, deeply customizable for power users.

Read CONTRIBUTING.md for structure and principles, and
`docs/research/2026-10-new-tab-research.md` before adding any feature: it
records what users want and hate, and Tarn's five product promises. Read
`docs/brand/BRAND.md` before any visual, naming, icon or store-listing work:
there is no logo, the `ta` mark is only for square slots, and it lists what
was already rejected. Read `docs/design/backgrounds.md` before changing or
adding a background scene: the scenes, their cost, thumbnails, and the
owner's taste. The essentials:

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
  The only one so far is **weather** (owner-approved 2026-10-13,
  `src/weather/`): nothing is sent until a Weather widget exists and has a
  place. City search goes to Open-Meteo's geocoding API; forecasts come
  from Open-Meteo (free, no key, non-commercial use, CC BY 4.0, credited in
  the widget) or Google's Weather API with the user's own key (kept in
  storage.local, never synced or exported; credited "Includes weather data
  from Google"). Only rounded coordinates (~1 km) are sent, at most every
  30 minutes per place, only while a tab is visible; the last forecast is
  cached for first paint. All requests omit credentials and referrer, and
  need no host permission (both APIs allow CORS). "Use my location" asks
  for the optional `geolocation` permission at that moment.
  The **search box** (`src/search/`, owner-approved 2026-10-14) sends a
  query only when the user presses Enter, to the browser's own default
  engine (`search` permission: chrome.search / browser.search; Tarn never
  picks or changes the engine). Its suggestions are offline (a typed
  address, the browser's bookmarks). The mic uses the browser's speech
  recognition, which in Chrome sends the audio to Google, only on its own
  voice screen. Lens opens a box on the page; an image goes to Google Lens
  (a form post to lens.google.com, or `uploadbyurl` for a link) only when
  the user drops, picks or pastes one. AI Mode opens Google's AI Mode with
  the question (one service on purpose, owner 2026-10-14). No web
  suggestions: they would send every keystroke. Looks: auto (follows the
  computer, like the browser's box; default), light, dark, glass (the
  scene's frost, via the board's tile report).
- **Permissions:** `storage`, `offscreen` (see Arrival), `sidePanel`,
  `search` (the search box, above), and
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
  (popup meta). Settings > Tab icon offers the browser's own icon (default,
  via the favicon API; labeled with the browser's name: Chrome, Edge...),
  "None" (a transparent icon once the page exists) and "Your own" (an image
  the user picks, 64px PNG in localStorage `tarn.tabIcon.custom`, this
  computer only; first-paint.ts draws it in the first frame).
  `management` is
  _optional_, requested only when the user asks Tarn to switch off another
  new-tab extension (Chromium only). `bookmarks` is _required_ (owner's
  choice 2026-10-14, before the store launch: adding a required permission
  later would disable Tarn for existing users). A Bookmarks widget with no
  content of its own shows the browser's bookmarks bar, live
  (`widgets/bookmarks.ts`; folders become folders, deeper ones flatten),
  from the first new tab; the user's first change saves a copy that is
  theirs from then on. Read only; its install warning is "Read and change
  your bookmarks". Adding any permission needs a stated reason.
- **Performance:** never block first paint; animate only transform/opacity;
  backgrounds pause when hidden and honor `prefers-reduced-motion`.
- **Words:** every visible word goes through `t()` (`src/i18n/`); never
  write UI text inline. Add the English to `messages/en.ts` (grouped keys,
  `{name}` placeholders, no wording that depends on a count) and the same
  key to all 9 other catalogs; `i18n.test.ts` fails on a missing key or
  placeholder. Pass `locale()` to every Intl call. Languages: en, es,
  pt-BR, fr, de, ru, ja, zh-CN, ko, tr; 'auto' follows the browser. The
  active catalog is mirrored in localStorage, so the first frame is
  already in the right language; components re-render on a change with
  `new LocaleController(this)`. The manifest name and description come
  from `public/_locales`. Google's weather credit stays in English (its
  required wording).
- **Settings** go through `src/settings/` (versioned key, normalized on read).
  Never trust stored data's shape.
- **Never lose a setup** (`settings/store.ts`, `migrate.ts`, `backup.ts`;
  pinned by `protection.test.ts`). Settings sync between computers that can
  run different Tarn versions, so a save rewrites only the fields it
  changes; values, widgets and fields this version doesn't know (a newer
  Tarn wrote them) are kept, just not shown. Renaming or moving a stored
  value bumps `SETTINGS_VERSION` with a migration step, plus the old shape
  as a fixture in the "every past shape" test. Reset, Import and restores
  use `replaceSettings` (a full replace, `enabled` kept). Each update first
  saves an automatic backup (settings plus widget content, last 3), and
  Export/Import carry the same backup format.

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

## Widgets

Layout rules and the evidence behind them: `docs/design/widget-layout.md`.

- A widget is its own custom element (code, styles, storage by `widgetId`)
  plus one entry in `widgets/registry.ts`.
  Each kind offers only the sizes its content looks right at
  (`WIDGET_SIZE_OPTIONS` in `settings/schema.ts`: Focus S/M; Weather
  S/M/L; Calendar S/M/L; Notes and Tasks M/L/XL; Favorites all); stored sizes snap to the nearest offered
  one. A widget marked `editable` (Favorites, Weather) stays live in edit
  mode and shows its own controls there (add and remove sites; "Change
  place"), marked `data-edit` so pressing them doesn't start a drag; its
  links are off meanwhile. Shown names: Favorites is "Bookmarks" and Focus
  is "Timer" (owner, 2026-10-14); the kinds' ids stay `favorites`/`focus`.
  In edit mode every tile also gets a holder on its top edge: the widget's
  name (click to rename; `WidgetEntry.name`, shown as its heading) and a
  remove button that asks once before removing. The board saves both
  through the same `tarn-reorder` event as a drag. A grip in each tile's
  corner resizes it. The tile lifts and its frame follows the pointer
  (held at the widget's smallest and largest sizes with a little rubber-band
  give), a soft outline shows the size it will snap to (the nearest one the
  widget offers; sizes are whole cells), the others reflow only when that
  changes, and on release it glides into the outline (FLIP) and saves;
  - and - do the same from the keyboard, Escape cancels. The tile clips its
    content, not itself, so the holder can overlap its edge. Modules load eagerly on purpose:
    a reload must draw every widget in its first frame.
- **Edit mode:** while the settings side panel is open (`watchSidePanel`),
  widgets can be dragged (Pointer Events + capture) or moved with arrow
  keys. Positions come from the layout engine, never free placement;
  `widgets/geometry.ts` (`nearestIndex`) picks the slot under the pointer.
  Widget contents are `inert` meanwhile.

- `layout/bands.ts` places widgets (pure function, ~12 µs for 9 widgets,
  ~42 µs for 30; columns are always 2, 4 or 6). Its order of priorities:
  no holes (only the last band may be short), then the sizes the user
  chose (a small or medium is stretched to fill a two-row band only when
  keeping its size would leave a hole; otherwise it lies flat on a row of
  its own, owner 2026-10-13), then the fewest bands, then the user's order;
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
- **Calendar** (`src/calendar/`, `widgets/tarn-calendar.ts`): offline,
  dates only (today, this week, or the month with arrows), in the
  language's words and week start (`Intl.Locale` week info, else by
  region). Events come only through `calendar/sources.ts`: a source
  implements `EventSource` and registers, and every calendar shows its
  events (dots, the next one on the small tile) with no widget change. No
  source exists yet; a calendar link or provider would be the next network
  feature and follows the Network rule. It wakes only at midnight.
- **Start setup:** a new install (no widget list stored) shows the clock
  plus `START_WIDGETS` (Favorites L, Notes M, Weather S, Focus S;
  `settings/schema.ts`)
  with example content from `widgets/start.ts`, shown until the user edits
  it and never stored before. A stored empty list stays empty.
- Widget content lives in `storage.local` (`widget.<id>`), apart from synced
  settings; removing a widget keeps its content.
- **Favorites** (`widgets/tarn-favorites.ts`, model in `favorites-model.ts`,
  dragging in `favorites-drag.ts`): sites and folders of sites, one level
  deep, stored as one array (content from before folders reads unchanged).
  A folder shows its first four icons and opens as a sheet over the page.
  While arranging: drag a site to move it (it moves after resting ~0.1s
  over a slot), rest it on another site's icon (~0.4s) to make a folder or
  drop it into one, drag it out of an open folder to take it out; arrow
  keys move a focused site. The editor's extras sit behind "More": the
  user's own icon (a 112px image stored with the site, opaque so it never
  clashes) and which folder it's in. Icons that are nearly all white on
  clear (GitHub, ChatGPT; `isLight` in `site-icon.ts`) get a dark chip.
  Only a grid exists; the model doesn't depend on it, so a list view
  (planned, owner 2026-10-13) can reuse it.

## Rendering performance

- **Pace** (`backdrop/pace.ts`, `renderer.ts`): the scene never stops while
  visible. It is `active` (full speed, 30 fps) while the page is used, and
  `calm` (40% speed, 20 fps) after 1 min without input. Another app being in
  front does not count (owner, 2026-10-13: on a wide display Tarn stays in
  view beside other apps); only a hidden tab (minimized, covered, switched
  away) stops. The frame rate follows the speed, less than in proportion,
  so each calm frame moves the picture 60% as far as an active one: 15 fps
  at half speed still felt choppy. Calming eases over ~10 s; waking ~1.5 s.
  Synthetic pointermoves under a resting cursor are ignored. Settings open
  keeps it active.
- Between frames the loop sleeps on a timer and rejoins the display's frame
  callbacks ~12 ms before a frame is due, instead of waking at every
  refresh (120 Hz) to skip. Frames stay evenly spaced (measured: 30.3/s,
  gaps 32-36 ms).
- Ghost snapshots are skipped when the moment hasn't changed, and taken less
  often at slower paces.
- Measured idle cost (M4, headed Chrome, % of one core, page / graphics):
  active 4.1-5.8 / 7.5-10.6; calm (at 15 fps, before the move to 20) 2.7 / 5.8.
- Scene thumbnails in settings are real frames (`public/scenes/<id>.webp`,
  320x200, ~2-4 KB each) rendered from the same shaders by
  `scripts/scene-previews.mjs`, over the scene's still gradient while they
  load (`scenePreview`). Regenerate them when a scene changes.
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
