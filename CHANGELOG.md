# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Tarn's full name is now "Tarn: Modern New Tab" (translated after the
  colon), as the Chrome Web Store and the extensions page show it.
- The privacy policy is rewritten: a short summary, what Tarn keeps and
  where, exactly what leaves your computer and when, and each permission.

### Added

- Lighter wallpapers for slower computers: Tarn (calmer, less shiny,
  slower), Bloom, Silk, Aurora (more natural rays) and Contour draw with a
  fraction of the work; Wave is remade with layered, twisting ribbons of
  light; every frame's anti-banding dither is cheaper; reload snapshots no
  longer stall the graphics chip.
- Keyboard shortcuts on the new tab, the ones other apps use: ⌘K or Ctrl+K
  (or /) to search, Option or Alt + 1-9 to open a bookmark, ? to see them
  all. They can be turned off in Settings > Advanced > Keyboard.
- Reset Settings at the end of the settings panel: it asks first, then puts
  the wallpaper, clock, search box, weather and tab icon back to how Tarn
  starts, with Undo. Widgets, bookmarks, notes and the language stay.
- Temperature units right on the settings panel's main page.
- Clock color: Auto follows the wallpaper as before; Light or Dark keeps
  the clock that color on any wallpaper (Settings > Clock).
- A search box under the clock, shaped like the browser's own: it searches
  with your browser's engine, opens typed addresses, and suggests your
  bookmarks. Voice (right in the box, with a voice line), Google Lens (a box on the
  page) and AI Mode are one switch each in Settings > Search, along with
  its look (auto, light, dark or glass) or hiding it.
- Bookmarks starts with your browser's bookmarks bar, folders included.
- Three new clock faces: Glass (translucent digits with a lit bevel, like
  Apple's), Rounded and Analog.
- More clock faces: Flip (split-flap cards that flip each minute), LCD (seven segments), Neon, and two
  gothic ones, Fraktur and Gotisch, with blackletter dates (Google Fonts,
  bundled, OFL).
- Settings, polished: search on Widgets and Language filters that page
  ("german" finds Deutsch); wallpaper cards show a gauge of how much each
  asks of your computer; widgets to add show a grip and can be dragged onto your page; example setups
  (up to nine widgets, with Undo) for everyone; your own image as the tab
  icon, and the browser option says which browser it is.
- Weather: "Change place" right on the tile while settings is open.
- Favorites are now Bookmarks, with folders, drag to arrange and your own
  icons; Focus timer is now Timer.

- Six new backgrounds: Sakura (a blossom branch over falling petals),
  Comet (twilight over a mountain lake), Koi (a pond from above),
  Window (rain on glass over a city in bokeh), Lumen (light through haze)
  and Contour (a living topographic map, drawn at full screen sharpness).
  They replace Mist, Dunes, Rain and Nebula; whoever picked one gets the
  nearest new one. Silk is brighter.
- A first look: a new install starts with the clock, Favorites, Notes,
  Weather and Focus, with a few examples to try.
- Calendar widget: today (small), this week (medium) or the month with
  arrows (large), in your language and with your week start. Offline;
  ready for calendar events later.
- Resize widgets while settings is open: drag the corner grip and the
  widget snaps through the sizes it offers, with the others making room.
  Plus and minus keys do the same from the keyboard.
- Tasks: add from a + beside the title, so a small tile shows more tasks.
- Ten languages: English, Español, Português (Brasil), Français, Deutsch,
  Русский, 日本語, 简体中文, 한국어 and Türkçe. Tarn follows the browser's
  language, or pick one in Settings > Language. Dates, times and the store
  listing follow it too.
- Weather widget: now, the next hours and the week ahead, in four sizes.
  Search for a city or use your location; forecasts from Open-Meteo (free,
  no account) or Google with your own API key. Opt-in: nothing is sent
  until you add it.
- Your setup survives updates: a save only changes what you changed, so an
  older Tarn on another computer never erases a newer one's widgets or
  choices; renamed options get proper upgrades; every update first keeps a
  backup of your settings and widget content (notes, tasks, favorites).
- Your own photos as the background: drawn sharp and still (no CPU while
  idle), with the same smooth arrival and reload as the animated scenes.
- Edit mode: a holder on each widget's top edge to rename it (two
  Favorites can be "Project A" and "Project B") or remove it. Widgets can
  be renamed in the settings panel too.
- Favorites: add and edit sites in a small sheet with a name and an
  address, with Cancel; a small tile shows four icons in a neat 2x2.
- Tasks widget: a short to-do list (medium, large or extra large). Type in
  the top row to add; the round button checks a task off and it leaves a
  moment later (click again to undo).
- Focus timer: click the time and type a new length ("45", "12:30" or
  "1:30:00"). Small or medium only.
- Favorites: bigger site icons; add and remove sites while settings is
  open, so the page stays clean otherwise.
- Each widget offers only the sizes it looks right at (Notes: medium and
  up).
- Foundation: WXT build for Chromium and Firefox, Lit, strict TypeScript,
  ESLint, Prettier, Vitest and CI.
- WebGL2 background renderer that runs in a worker, caps at 30fps, pauses
  when hidden and respects reduced motion.
- Six scenes: Tarn, Ember, Bloom, Wave, Aurora (northern lights over a night
  sky) and Silk (pale satin folds, a light scene).
- Settings thumbnails are real frames of each scene, rendered from the same
  shaders (`scripts/scene-previews.mjs`): six WebPs, ~14 KB in all.
- Settings synced through browser storage.
- Toolbar button with an on/off switch that hands new tabs back to the
  browser's own page.
- Settings gear (bottom right, faint until approached) that opens Tarn in the browser's side panel,
  with a live background picker and the on/off switch.
- Warm start: an offscreen document keeps first-paint data in sync and
  Tarn's process warm, cutting new-tab first paint after idle from ~85 ms
  to ~52 ms (Chrome's own floor).
- Fast noise texture baked from the exact shader noise for gently-used
  noise (Ember, Bloom); Tarn keeps exact computed noise. Adaptive quality
  governor lowers resolution and frame rate on weak devices.
- Smooth arrival: new tabs start on the browser's default new-tab color and
  the scene eases in; reloads continue the animation in place, bridged by a
  canvas ghost frame, with no visible change and no split frames.
- Chrome's own mono new-tab icon in the tab (favicon API, lightened in dark
  mode); Tarn's icon never appears in the tab, even mid-reload. Settings >
  Tab icon: Chrome (default) or None, which never changes at all.
- Robustness: still-gradient fallback when WebGL is unavailable or slow,
  serialized settings writes, off-main-thread ghost encoding, clock wrap for
  long-lived tabs, self-healing warm process.
- Take-over page that switches off other new-tab extensions (optional
  `management` permission) and restores them when Tarn is turned off.

### Removed

- The number keys no longer switch wallpapers (typing a number changed it
  by surprise). The raw settings editor is only in development builds.

### Fixed

- The Everything example setup shows each widget once, with no duplicates.
- Shortcut keys show a + between keys (⌘ + K, ⌥ + 1-9).
- Search on the Advanced page finds that page's own settings.
- A renamed Timer shows its new name, and an empty Weather tile opens its
  place picker while arranging widgets.
- The Outline clock no longer draws stray lines inside 2, 6 and 9.
- Weather: long or negative temperatures (-40°, 118°) fit every tile size,
  and the small tile keeps its icon in view.
- Focus timer: lengths up to 9 hours fit the small tile; typing accepts
  leading zeros ("0009"), ignores letters, reads "1.30" as 1:30, and caps
  anything longer at 9 hours.
- Calendar: its heading matches the other widgets (and shows a name you
  give it), a week across two months says so ("Sep – Oct"), weekday
  letters sit right above the dates, the week is centered in its tile, and
  the small tile's month starts with a capital in every language.
