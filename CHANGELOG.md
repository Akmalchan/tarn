# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
