# Wallpapers

Everything about Tarn's backgrounds in one place: the engine that draws
them, the sixteen living scenes, the user's own photos, the settings UI,
what each scene costs, and what the owner liked and rejected. It replaced
`docs/wallpapers.md` (2026-10-14).

The brand side is in `docs/brand/BRAND.md` ("Backgrounds: the
signature"). The timing and performance rules are summarized in
`docs/architecture.md` ("Arrival in detail") and this file; this file
explains how the code meets them.

## Summary

- A wallpaper is a **scene**: one fragment shader plus a little data
  (`src/backdrop/scenes/types.ts`). Sixteen are built in; a user's photo
  is a scene too (`photo:<id>`).
- `<tarn-backdrop>` owns a full-screen canvas. In production it hands the
  canvas to a worker (`OffscreenCanvas`), where `Renderer` draws with raw
  WebGL2. In dev it renders on the main thread.
- The renderer owns everything except the picture: the loop, pace (active
  or calm), the quality governor, pausing when hidden, reduced motion,
  the frosted glass behind widgets, photo decoding and the reload ghost.
- A scene never stops while visible. Hidden tabs draw nothing.
- First paint never waits for the GPU or async storage. A new tab eases
  the scene in; a reload continues it from the exact moment it left.

### Read this before...

| Task                                    | Read first                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Adding or changing a scene              | "Scenes", "The library", "Owner's taste", "How to add or change a scene"                             |
| Touching arrival, reload or first paint | "How it works" and `architecture.md` "Arrival in detail"; the numbers there were measured, keep them |
| Touching the loop, pace or quality      | "Pace", "Quality governor" and `architecture.md` "Performance"                                       |
| Anything about frost behind widgets     | "Frosted glass"                                                                                      |
| Photos, video, or any non-shader source | "User photos"; video should follow the same path                                                     |
| Settings cards, thumbnails, gauge       | "Settings UI"                                                                                        |
| Visual direction of a new scene         | "Owner's taste" and `docs/brand/BRAND.md`; never propose rainbow or prism effects again              |

## How it works end to end

```
 new tab page (tarn-app)                      settings side panel (tarn-panel)
 ───────────────────────                      ─────────────────────────────────
 first-paint.js (blocking, classic script)    cards: scenePreview() thumbnails
   start color / ghost canvas                 (still thumbnails, no live preview)
         │                                    gauge: loadLevel()
         ▼
 <tarn-backdrop scene remember awake>
   ResizeObserver, visibility, reduced motion, input (pace), ghost saves
         │ RendererCommand (protocol.ts)      ▲ WorkerEvent: firstFrame,
         ▼                                    │ sceneShown, unavailable, clock, ghost
 render.worker.ts  (production)   or   Renderer on the main thread (dev)
         │
         ▼
 Renderer (renderer.ts)
   tick(): pace rate, governor, clock
   draw():
     scene program = glsl.ts PRELUDE + scene.fragment
       no tiles ─────────────────────────────────────────► canvas
       tiles ──► FrameTarget texture ──► mipmaps ──► glass pass ──► canvas
         │
         ▼
 OffscreenCanvas, composited by the page as the <canvas> in tarn-backdrop
```

### The pieces

- **`<tarn-backdrop>`** (`src/backdrop/tarn-backdrop.ts`, `TarnBackdrop`).
  Properties: `scene` (an id), `remember` (the new tab page: continue the
  animation and save ghosts), `awake` (keep the active pace; the app sets
  it while the settings side panel is open). The takeover page uses it
  with `scene="tarn"` and no `remember`.
- **Worker or main thread** (`startRenderer`). Production calls
  `transferControlToOffscreen()` and starts `render.worker.ts`. Dev renders
  on the main thread, because Chrome kills an extension new tab that
  starts a worker from the WXT dev server's `http://localhost` origin.
  `worker.onerror` counts as "unavailable".
- **Protocol** (`src/backdrop/protocol.ts`). Commands: `resize`, `scene`,
  `visible`, `reducedMotion`, `tiles`, `pace`; plus `init` and `ghost`
  requests. Scenes travel whole, resolved by the page, because a worker
  cannot read the `tarn.photos` localStorage index. `applyCommand` maps a
  command onto the `Renderer`, so local and worker paths share one code
  path.
- **Renderer** (`src/backdrop/renderer.ts`, `Renderer`). WebGL2 context
  with `alpha`, no antialias/depth/stencil, `powerPreference: 'low-power'`,
  `preserveDrawingBuffer: false`. One empty VAO; the noise texture bound
  once on unit 0; the glass frame texture on unit 1; a photo on unit 2.
  Programs are compiled once per scene id and cached. The full-screen
  triangle comes from `gl_VertexID` (no buffers). It never draws before
  the real size is known (`sized`), so a 300x150 frame never shows.
- **Context loss** is handled: `webglcontextlost` stops the loop and drops
  all GL objects; `webglcontextrestored` re-creates them and redraws.

### The animation clock

- Seconds of animation time, advanced only while frames are drawn
  (`tick`), so a hidden tab resumes exactly where it stopped. The shader
  gets `uTime = clock * scene.speed`.
- Start value (`startRenderer`): on reload, the painted ghost's moment
  (`paintedGhostClock()`); otherwise the last saved moment plus the time
  since (`resumeClock()`, `tarn.clock` in localStorage, valid for 30
  minutes); otherwise the wall clock modulo 7200 s. Opening tabs
  therefore continues the motion instead of restarting it.
- One step is capped at 100 ms (`MAX_STEP_MS`), so stalls never jump.
- A hidden tab wraps the clock once it passes 24 h of animation time
  (`CLOCK_WRAP_AFTER_S`), before float32 shader time loses precision.
- The renderer reports the clock (`onClock`) when it starts or stops and
  once a second while running, with the wall time it was read, the
  governor level and the current pace rate. The page extrapolates the
  moment on screen from that (`currentClock`) without polling.

### Arrival: opening a new tab

1. `src/entrypoints/first-paint.ts` is a classic blocking script in the
   new tab's `<head>`. It calls `prepareFirstPaint()`
   (`src/app/first-paint.ts`), which marks `data-arrival` (`open` or
   `resume`, from the navigation type) and sets the root background inline
   to the browser's default new-tab color (`START_COLORS`: Chrome
   `#ffffff` / `#3c3c3c`, Firefox `#f9f9fb` / `#2b2a33`, by
   `prefers-color-scheme`).
2. The app module is render-blocking (`blocking="render"`), so the clock
   and widgets are laid out synchronously from localStorage mirrors.
3. `<tarn-backdrop>` is transparent until revealed; its canvas starts at
   opacity 0 and `scale(1.035)`.
4. `firstUpdated` races the first live frame against `unavailable` and a
   2.5 s timer (`STILL_AFTER_MS`).
5. `reveal()` on a live frame: opacity over 700 ms (`REVEAL_MS`) and the
   scale settles to 1 over 1100 ms (`SETTLE_MS`), both
   `cubic-bezier(0.22, 1, 0.36, 1)`. At the same moment the host's
   background turns from the browser color to the scene's `base` in 250 ms
   (`DARKEN_MS`), so the half-faded scene is never washed in gray.
6. Events: `tarn-revealed` `{inPlace, live}` (controls appear) and
   `tarn-settled` `{live}`, which fires right away (`WIDGETS_AT_MS = 0`;
   the owner wants widgets as soon as possible). While the canvas settles,
   `followSettle` re-sends the tiles every frame at the inverse scale, so
   the frost stays exactly behind widgets.
7. After the settle the host gets `ready`.

With reduced motion the canvas only fades (400 ms, `FADE_MS`), no settle.

### Arrival: reload (the ghost)

A page cannot hold its first paint for async work, so Chrome presents one
frame of the new page before the live scene exists. That frame is a ghost.

- **Saving** (only with `remember`). `scheduleSaves()` asks the renderer for
  a ghost every `180 / (speed * rate)` ms, clamped to 250-1000 ms, times
  `1 + governor level` (a stepped-down device saves less often). Also on
  `beforeunload` (`saveMoment`). `pagehide` and going hidden save the
  clock only. A ghost is skipped when the scene and moment equal the last
  one (a stopped photo or reduced-motion scene saves once).
- **Capture** (`Renderer.ghost`, `readSmall`): draws, then shrinks the
  frame on the GPU with halving `blitFramebuffer` steps (each averages 2x2
  pixels) to 320 px wide (`GHOST_WIDTH`), and reads only that back through
  a pixel buffer and a fence, so the worker never waits on the GPU. It
  strips alpha, flips the rows to top-down, base64-encodes raw RGB and
  adds the mean color. Raw, so the next page needs no image decode. (Until
  2026-10-14 it read the whole frame back and scaled it on the CPU: about
  80% of the worker's time.)
- **Storage** (`rememberGhost`): sessionStorage `tarn.ghost`
  `{scene, width, height, data, clock, color}`, per tab. The renderer
  comment puts a ghost at about 190 KB.
- **Painting** (`prepareFirstPaint` on `resume`): `rememberedGhost()`
  validates everything (scene equals `tarn.scene`, sides at most 512 px,
  length matches) and `paintGhost()` writes it into a CPU-backed 2D canvas
  appended to `<html>`, synchronously. A canvas is one texture, so it
  never shows half drawn; a CSS background image was rastered in tiles
  and caught showing a split frame. The root background becomes the
  ghost's mean color (or `tarn.base` with no ghost).
- **Hand-over**: the live scene starts at exactly the ghost's moment
  (`data-ghost-clock`, read once, so a ghost written at the last second
  by the old page can't mismatch). `reveal()` shows the canvas in place
  with no transition, and `releaseGhost()` removes the ghost 500 ms later
  (`GHOST_RELEASE_MS`), because a worker frame can reach the screen a
  frame or two after it reports being drawn.
- **Widgets' frost on reload**: the board's last rectangles are kept in
  sessionStorage `tarn.tiles` (`src/app/tile-memory.ts`) and sent to the
  renderer before its first live frame, at full strength, only if the
  window size is unchanged. Without this the ghost shows frost, the first
  live frames don't, and widgets blink.

Measured over 24 reloads (4 scenes, dev and prod): mean frame-to-frame
change 0.3-2.1 / 255, the same as normal motion (`architecture.md`).

### Switching scenes

`crossfadeTo` (on a `scene` property change): the canvas fades to 0 over
400 ms while the host background moves to the new `base`; then the scene
is sent; the canvas fades back in once `sceneShown` arrives (a photo may
take a moment to decode), capped at 2 s, plus two frames.

### Pace

`src/backdrop/pace.ts` decides, `Renderer.tick` applies.

- `active`: full speed. `calm`: 40% speed (`PACE_RATE`), after 60 s
  without input (`CALM_AFTER_MS`). `awake` (settings open) forces active.
- Input that counts: `pointermove` with a real change of screen position
  (Chrome sends synthetic moves under a resting cursor), `pointerdown`,
  `keydown`, `wheel`. Another app being in front does not count.
- The speed eases: time constant 3 s down (about 10 s to calm), 0.5 s up
  (`EASE_DOWN_S`, `EASE_UP_S`).
- The frame rate follows the speed, less than in proportion: the factor
  is `2/3 + (max(rate, 0.4) - 0.4) / 1.8`, so 1 at full speed and 2/3 at
  calm. At the governor's top level that is 30 fps and 20 fps; at a lower
  level it is 2/3 of that level's fps.
- Between frames the loop sleeps on a timer and rejoins
  `requestAnimationFrame` 12 ms before a frame is due (`scheduleNext`),
  instead of waking at every display refresh. Measured: 30.3 frames/s,
  gaps 32-36 ms.
- When tiles move between frames, the next display frame redraws (frost
  keeps up) without advancing the clock or feeding the governor.

### Quality governor

`src/backdrop/quality.ts`, `QualityGovernor`.

| Level | Resolution multiplier | fps |
| ----- | --------------------- | --- |
| 0     | 1                     | 30  |
| 1     | 0.8                   | 30  |
| 2     | 0.64                  | 24  |
| 3     | 0.5                   | 20  |

- The canvas size is `css size * scene.resolution * level.scale`
  (`applySize`).
- Windows of 45 frames. A frame is late at 1.5x its interval. More than 25%
  late steps down one level; a window under 3% late is clean, and 14 clean
  windows in a row (about 20 s) try one level up. Failing within 4 windows
  of stepping up marks that level as out of reach (`ceiling`). Gaps over
  250 ms are pauses, not load.
- Only frames at full speed (`rate > 0.98`) are recorded.
- Start level from hints (`initialQualityLevel`): +1 for 4 cores or fewer,
  +1 for 4 GB memory or less.

### Hidden tabs

`visibilitychange` sends `visible: false`; the renderer stops its loop and
draws nothing. Nothing advances, so hidden tabs cost no CPU or GPU time.
GL resources (context, programs, frame texture, photo texture) stay
allocated; freeing them is planned (see "Planned work").

### Reduced motion

`prefers-reduced-motion: reduce` (watched live): the renderer draws one
frame and stops, like a photo, and reports a stopped clock (one ghost, not
one a second). The reveal is a plain 400 ms fade. The settings hover
preview does not play. The board shows frost at full strength at once.

### Fallbacks

- **No WebGL2**: `onUnavailable` → the host shows `sceneStill(scene)`, a
  CSS gradient built from the scene's four colors (`:host([still])`),
  fires `tarn-revealed` with `live: false`, and `tarn-settled` after
  700 ms. Widgets then use CSS glass (`glass="css"`, `backdrop-filter`).
- **Slow GPU or stuck worker**: after 2.5 s the still shows; a late live
  frame then fades in over it.
- **Shader compile or link failure**: logged (`[tarn] shader compile
failed`), the frame is skipped, no first frame is reported, so the 2.5 s
  still path takes over.
- **Unknown or missing scene id**: `sceneById` returns Tarn.

## Scenes

### The Scene type

`src/backdrop/scenes/types.ts`. Scenes are data; the renderer owns the
rest.

| Field        | Meaning                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Stored in the `scene` setting. Never rename without a `REPLACED_SCENES` entry.                                                   |
| `name`       | Shown on the card as is (a proper noun, not translated through `t()`).                                                           |
| `fragment`   | GLSL ES 3.00 that defines `vec3 scene(vec2 uv, float t)`; appended after the prelude.                                            |
| `colors`     | Exactly four hex colors, `uColors[0..3]`. Use them instead of literals, so the still fallback (`sceneStill`) and the card match. |
| `base`       | Page color before the first frame and behind fades; mirrored to `tarn.base` for reload. Also decides the tone.                   |
| `speed`      | Multiplier on the animation clock. Also sets how often the ghost is saved. Must be > 0 for built-in scenes.                      |
| `resolution` | Render scale per CSS pixel (then times the governor's scale). Not per device pixel: 0.75 on a 2x screen is 0.375 of its pixels.  |
| `photo`      | Only for photos: `{width, height}` of the original.                                                                              |
| `tone`       | Optional override of the tone from `base` (photos carry their own).                                                              |

**Tone** (`sceneTone`): relative luminance of `base` above 0.35 is
`light`. Light scenes get dark text (the app sets `tone` on itself) and a
stronger frost (`uFrost` 0.28 instead of 0.09).

### The shader prelude

`src/backdrop/scenes/glsl.ts` (`PRELUDE`, `fragmentSource`). Every scene
gets:

- Uniforms: `uResolution` (canvas pixels), `uTime` (clock times speed),
  `uColors[4]`, `uNoise` (the baked noise texture, unit 0). Photos also
  declare `uPhoto` and `uPhotoSize`.
- `main()`: `uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y`,
  so `uv` is centered and aspect-corrected (y spans -0.5..0.5, x about
  ±0.8 on 16:10). It calls `scene(uv, uTime)` and adds ±0.5/255 dither
  against banding: interleaved gradient noise in float math (it was an
  integer hash per pixel, about a third of a big frame's cost; changed
  2026-10-14).
- `hash(uvec2)` and `hash01(vec2)`: integer hash per cell.
- Gradient noise, roughly in [-0.7, 0.7], two ways:
  - `noise` / `fbm` (4 octaves): computed per pixel, exact.
  - `noiseFast` / `fbmFast`: one filtered fetch from a 512x512 R16F
    texture (`src/backdrop/noise-texture.ts`: 32 cells, 16 texels per
    cell, `REPEAT`, `LINEAR`), baked on the CPU by an exact port of the
    GLSL hash (`hashGlsl`), tested texel by texel
    (`noise-texture.test.ts`). Several times cheaper on weak GPUs.

Which to use:

- Gentle noise (soft color fields, grain, haze): the fast pair.
- Heavily domain-warped scenes: test both. Tarn needed exact `fbm` at 0.5
  (chained warps amplified the texture's ~0.001 differences into a flatter
  pattern, measured 2026-10-11), but at 0.35 with fewer warp octaves the
  fast pair looks the same (2026-10-14), and it avoids per-pixel integer
  hashing, which weak GPUs (Raspberry Pi) do slowly.
- Thin lines (Contour) can't use the bilinear texture: its kinks show in
  every line. Contour carries its own smooth float-hash gradient noise.
- The fast texture repeats every 32 noise cells. Keep frequencies low
  enough that a repeat never fits on screen.

### Resolution

Soft scenes look the same at a fraction of the pixels; detailed ones need
real pixels. Current values: Contour `min(devicePixelRatio, 1.5)` (lines are
sized in pixels with `fwidth`; at 2 they look the same and cost ~75 MB
more GPU memory on a 2x screen, #51); 1 for Comet; 0.75 for Wave;
0.75 Ember; 0.5 Tarn, Aurora, Lumen; 0.4 Silk; 0.35 Bloom. Photos also
use `min(devicePixelRatio, 2)`.

### Moments

The clock decides what a scene shows, so the same moment always shows the
same picture. That is what makes the ghost and resuming work. The
thumbnail moments are in `MOMENTS` (`scripts/scene-previews.mjs`).

## Frosted glass

`src/backdrop/glass.ts` (`GLASS_FRAGMENT`, `MAX_TILES = 24`) and
`Renderer.drawGlass`.

Why: CSS `backdrop-filter` re-blurs the moving canvas every frame
(measured compositor ~2% → ~8%). Tarn owns the scene, so it draws the
frost itself.

How:

1. With at least one tile and strength above 0, the scene renders into a
   texture with a full mip chain (`frameTarget`, `texStorage2D`) instead
   of the screen. With no tiles it draws straight to the canvas.
2. `generateMipmap` builds soft copies every frame.
3. The glass pass draws the screen: outside every tile, the sharp frame;
   inside, a 9-tap tent filter on a coarse mip level (blur 26 CSS px),
   mixed toward white by `uFrost`. Tiles are rounded rectangles
   (signed distance, `uRadius`), with a one-pixel anti-aliased edge;
   `uStrength` follows the widgets' fade.

Where the rectangles come from:

```
tarn-board.report()  ─ tarn-tiles {rects, strength, radius: 24} ─►  tarn-app.onTiles
                                                                       + searchGlassRect()
                                                                       │ (only if live)
                                                                       ▼
                     renderer.setTiles ◄─ tiles command ◄─ backdrop.setTiles / sendTiles
                                                                       │
                                     tile-memory.rememberTiles ◄───────┘ (strength 1 or empty)
```

- `TarnBoard.report()` (`src/widgets/tarn-board.ts`) measures every
  `.tile` in viewport CSS pixels, skipping a tile being dragged or
  resized (it is a nearly solid card). Strength eases in over 200 ms
  (`APPEAR_MS`), or is 1 with `instant` (reload) or reduced motion. It
  sends nothing when nothing moved (rounded to half pixels), so the scene
  doesn't redraw for it. It runs on resize, on page scroll (the app's
  `onScroll`, once per frame), during FLIP animations and drags.
  `refresh()` forces a report even if no tile moved.
- `tarn-app.onTiles` (`src/app/tarn-app.ts`) adds the glass search box's
  frame from `searchGlassRect()` (only when search is shown with the
  `glass` style; the box's 46 px, without its dropdown), so it follows the
  same settle and scroll. The app calls `board.refresh()` when the search
  box's look changes. It passes an empty list when the live scene isn't
  on screen, and remembers the rectangles for the next reload.
- `TarnBackdrop.sendTiles` divides positions and radius by the canvas's
  current settle scale around the window center.
- `Renderer.setTiles`: while looping it marks `tilesMoved` and wakes the
  loop; when stopped (photo, reduced motion) it draws at once.

Rules:

- The search box gets shader glass only when the live scene is on screen
  and widgets exist (its rectangle rides on the board's `tarn-tiles`);
  otherwise it, and the board when not live, use CSS glass
  (`glass="css"`, `backdrop-filter: blur(24px) saturate(1.3)`).
- The search box uses the tiles' 24 px radius, so its 46 px frame reads
  as a pill.
- Never fade a tile container with opacity: it breaks CSS glass in the
  still fallback.
- At most 24 rectangles reach the shader; more are dropped.

## User photos

Added 2026-10-13. A photo is selected through the usual `scene` setting as
`photo:<id>` and drawn by the same renderer.

Storage (`src/wallpapers/store.ts`), on this computer only, never synced
or sent anywhere:

- `addWallpaper(file)`: refuses non-images (`notImage`) and files over
  50 MB (`tooLarge`) before decoding; decodes with EXIF orientation
  (`cantOpen` on failure). Stores, in IndexedDB `tarn-wallpapers`:
  - `images` store: the original file untouched, and a display copy
    (WebP 0.92, at most 3840 px on the long edge);
  - `info` store: id (`photo:` + UUID), name (from the file name, at most
    60 characters), created time, size, mean color (from a 16x16 copy) as
    `base`, tone (same luminance rule as scenes), and a thumbnail (WebP
    0.8, at most 480 px).
- Listing never loads the big images (separate stores).
- `deleteWallpaper` returns the record so Settings can offer Undo
  (`restoreWallpaper`).
- `photoMirror()`: localStorage `tarn.photos`, `{base, tone, w, h}` per
  photo, rebuilt from IndexedDB on every add, list, delete and restore
  (`syncMirror`), so it heals if cleared. Readers never trust its shape.

Rendering:

- `photoScene(id, entry)` (`scenes/index.ts`): `PHOTO_FRAGMENT` (cover fit,
  y flipped), speed 0, resolution `min(devicePixelRatio, 2)`, four colors
  equal to `base`, the photo's size and tone.
- First paint knows the photo's base color synchronously:
  `mirrorSettings` writes `sceneById(scene).base` to `tarn.base`, and
  `sceneById` reads the mirror.
- `Renderer.loadPhoto` decodes the display copy in the worker (IndexedDB
  works there) with `createImageBitmap` at the size the screen needs
  (cover size, never upscaled, `resizeQuality: 'high'`), uploads it once
  (RGBA8, unit 2), and draws. Until then `ready()` is false and the
  previous frame or base color stays. A window that grows past 90% of the
  decoded width decodes again. Switching to another scene frees the
  texture.
- A photo never moves: one frame, then nothing until tiles or size
  change. Measured idle: page ~0% CPU, graphics ~1.7% (vs 8-11% for a
  shader).
- Missing photo (synced setting from another computer, or deleted):
  `sceneById` returns Tarn when the mirror has no entry, and the renderer
  switches to the default scene when the image is gone.
  `normalizeSettings` keeps a `photo:` id even if this computer lacks it.

## Settings UI

`src/panel/tarn-panel.ts`.

- **Home page**: a Wallpaper section with three cards (`HOME_SCENES`;
  `pickShown` keeps the current choice visible without reshuffling) and a
  "Show All" card that opens the `backgrounds` page.
- **Backgrounds page**: "Add Photo…" (file input, several files at once;
  the last one added becomes the wallpaper), "Your Photos" (with a delete
  badge per photo and an Undo toast), then the live scenes (headed "Live"
  when photos exist). The page search filters by name. A `storage` event
  on `tarn.photos` reloads the list when another page changed it.
- **Card** (`sceneButton`): thumbnail, name, load gauge. Selecting
  (`selectScene`) mirrors settings for first paint at once and saves.
- **Thumbnails**: `scenePreview(scene)` layers `/scenes/<id>.webp` over
  `sceneStill(scene)`, so a card is never blank. Photos use their own
  thumbnail over their base color (`art`); a photo not on this computer
  shows the default scene's art.
- **No live preview.** Cards stay still (the owner removed the hover
  preview on 2026-10-14: not needed, and a second GL context).
- **Load gauge** (`src/backdrop/scenes/load.ts`, `loadLevel`): the
  scene's measured GPU work per frame in `SCENE_LOAD` (ms, see "Measured
  cost"). Under 0.03 ms is `light`, under 0.12 `medium`, otherwise
  `heavy` (shown as "higher"). Photos are `still`; an id without a row is
  `medium`. The needle angles are in `GAUGE_ANGLES`.

### Thumbnails: how to regenerate

The cards show real frames, not CSS gradients (the gradients only hinted
at the scenes and "looked off").

- `scripts/scene-previews.mjs` bundles `scripts/scene-preview-page.ts` with
  Vite, runs it in headless Chrome over the DevTools protocol, and draws
  each scene with the real shaders and noise texture at 2x, then scales
  down.
- Output: `public/scenes/<id>.webp`, 320x200 (twice a ~160x100 card), WebP
  quality 0.8. On disk now (2026-10-14): 1.7-14.9 KB each, about 98 KB for
  all sixteen; the fine-line scenes (Topology, Matrix, Night Sky) are
  the largest.
- `MOMENTS` picks the moment (seconds of animation clock) each thumbnail
  shows. Pick one that shows the scene at its best. An id missing from
  `MOMENTS` uses 20.

```bash
CHROME=/path/to/chrome node scripts/scene-previews.mjs
```

To compare candidate moments without touching `public/`, pass
`id@seconds` arguments; files go to `OUT` (default: the system temp
folder):

```bash
OUT=/tmp/x CHROME=/path/to/chrome node scripts/scene-previews.mjs aurora@20 aurora@100
```

## The library

Order in `SCENES` (`src/backdrop/scenes/index.ts`) is the order in
settings. The default is Tarn (`DEFAULT_SCENE_ID`). There are no keyboard
shortcuts: number keys switched scenes until 2026-10-14, when the owner
removed them (people typed numbers and the wallpaper changed).

| #   | id            | Name        | What it draws                                                                                                                                                                                                                                                                                                                                       | Tone  | Speed | Resolution             | Noise                                                                                          |
| --- | ------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | `tarn`        | Tarn        | Light moving through still water: triple domain-warped noise in navy, teal and pale blue, slow and tempered (highlights capped). The default and the brand's signature.                                                                                                                                                                             | dark  | 0.18  | 0.35                   | `fbmFast` (3 octaves on the warps, 4 on the surface)                                           |
| 2   | `ember`       | Ember       | Folding purple-pink-orange color waves under fine film grain that changes every frame, even at calm pace.                                                                                                                                                                                                                                           | dark  | 0.6   | 0.75                   | `noiseFast`, `hash01` grain                                                                    |
| 3   | `bloom`       | Bloom       | Soft pastel mesh gradient pushed around by low-frequency noise.                                                                                                                                                                                                                                                                                     | light | 0.18  | 0.2                    | texture noise, 3 octaves                                                                       |
| 4   | `wave`        | Wave        | Three twisting ribbons of light at three depths (far dim, middle sharp, near out of focus), each a translucent sheet with bright rims and fine strands with light running along them, over a lit swell in deep blue; sparkles and soft motes; the top and middle stay calm.                                                                         | dark  | 0.35  | 0.75                   | `noiseFast`                                                                                    |
| 5   | `aurora`      | Aurora      | Northern lights: two parallel arcs that take turns being lit, folding ribbons whose edge-on folds glow brighter, thin streaky rays bunching there, teal rising to violet; a night sky with slowly twinkling stars.                                                                                                                                  | dark  | 0.25  | 0.4                    | `noiseFast` (5 fetches per pixel)                                                              |
| 6   | `silk`        | Silk        | Slow folds of pale satin: a warped sine height field, lit from the upper left; ice-blue shadows, faintly warm highlights. Slope computed analytically (one evaluation).                                                                                                                                                                             | light | 0.2   | 0.33                   | `noiseFast`                                                                                    |
| 7   | `lumen`       | Lumen       | Light through haze: shafts from an opening above that sway, widen and dim on their own, haze rolling through, pulses running down the beams, dust in three depths glinting only in the light.                                                                                                                                                       | dark  | 0.4   | 0.5                    | `fbmFast`, `noiseFast`, `hash01`                                                               |
| 8   | `contour`     | Contour     | A topographic map whose land slowly reshapes: hairline contours with every fifth bolder, faint relief shading (light from the upper left), cool valleys and warm heights on paper.                                                                                                                                                                  | light | 0.12  | screen density (≤ 1.5) | its own float-hash gradient noise (C2, no integer math); finest octave a B-spline texture read |
| 9   | `clouds`      | Clouds      | Skimming over a sea of soft cumulus under a clear blue sky: camera-facing slices of noise (volumetric billboards) drift toward the viewer and recycle at the back; round, bumpy puff tops, near ones big and soft. A look-alike of Vanta's Clouds 2, written from scratch.                                                                          | light | 0.35  | 0.33                   | `noiseFast`                                                                                    |
| 10  | `topology`    | Topology    | Fine silk threads streaming along a slowly drifting flow: level lines of a smooth stream function, bunched into bright bundles with dark gaps, two layers at slightly different angles. Each pixel sums its two nearest threads with a smooth 1.5 px edge, so hairlines stay smooth. Olive and lime on deep teal; a look-alike of Vanta's Topology. | dark  | 0.075 | screen density (≤ 1.5) | float-hash gradient noise (4 evaluations), no textures                                         |
| 11  | `canopy`      | Canopy      | A cyberpunk loading screen: a canopy of lit points seen from a slow glide above it, cyan up close fading to magenta toward a hazy magenta horizon on indigo-black; a soft band of brighter rows sweeps away every 89 s. Each depth row reads its own hill height, so far points stay round (inspired by ThreeUI's Pine Canopy).                     | dark  | 0.45  | 1                      | `noiseFast`, float loop counters                                                               |
| 12  | `convergence` | Convergence | Three soft streams of light cross the screen on a rotated, flowing S-curve, each split like light through a prism: teal leading, amber trailing, warm white where they overlap (inspired by ThreeUI's Stream Convergence).                                                                                                                          | dark  | 0.7   | 0.35                   | none (analytic)                                                                                |
| 13  | `ribbons`     | Ribbons     | Seven flat translucent vector ribbons that twist and drift across a deep field; analytic sine curves with exact slopes, edges anti-aliased in pixels (inspired by animated SVG wave backgrounds).                                                                                                                                                   | dark  | 0.25  | 0.75                   | none (analytic)                                                                                |
| 14  | `fringe`      | Fringe      | One glowing sine band whose color channels part toward the screen's edges, as a lens does: red, green and blue sliding apart around a white core, swinging wider at the edges so it stays below the clock.                                                                                                                                          | dark  | 1     | 0.4                    | none (analytic)                                                                                |
| 15  | `nightsky`    | Night Sky   | A deep sky with a soft, slowly drifting Milky Way (violet core, grey-teal ends, dust that lives only in the band), stars in four twinkling layers, and now and then a shooting star.                                                                                                                                                                | dark  | 0.25  | 1                      | `noiseFast`, float-only cell hash                                                              |
| 16  | `matrix`      | Matrix      | Digital rain in three depth layers: each column's drops are analytic trails (no feedback buffer); glyphs are strokes on a 2x3 lattice chosen by a hash, an invented katakana-like script; bright heads, green trails.                                                                                                                               | dark  | 1     | 1                      | float-only cell hash                                                                           |

### Data

| id            | base      | colors (`uColors[0..3]`)                | Thumbnail moment (s) |
| ------------- | --------- | --------------------------------------- | -------------------- |
| `tarn`        | `#05080f` | `#04070d` `#0d2740` `#1f6178` `#a9cfe0` | 5                    |
| `ember`       | `#06050a` | `#06050a` `#3a0d5e` `#d4336f` `#ffb46b` | 3                    |
| `bloom`       | `#d9d3f2` | `#b9a8f5` `#8cc8f2` `#f7b9d6` `#fff1d0` | 30                   |
| `wave`        | `#071230` | `#050d24` `#173f8f` `#4f8dff` `#d6e7ff` | 12                   |
| `aurora`      | `#03070d` | `#02050b` `#08141f` `#3ed6a6` `#8d7ce0` | 100                  |
| `silk`        | `#e2eaf0` | `#9ab4c8` `#dce6ee` `#fcfdfe` `#efb497` | 40                   |
| `lumen`       | `#05080d` | `#030509` `#0c1622` `#ffd9a1` `#7fb8c9` | 20                   |
| `contour`     | `#f1eee7` | `#f4f1ea` `#dfe7ec` `#3d5468` `#e9b99c` | 20                   |
| `clouds`      | `#b9c2d6` | `#08507a` `#8fc0da` `#7685b0` `#e2e6ef` | 30                   |
| `topology`    | `#002222` | `#002222` `#89964e` `#c9d48a` `#5c7a4c` | 15                   |
| `canopy`      | `#07061a` | `#07061a` `#d0207f` `#1fd6ff` `#d4f8ff` | 35                   |
| `convergence` | `#03070c` | `#03070c` `#10a8c0` `#fff0d0` `#ff7a2e` | 10                   |
| `ribbons`     | `#0b1622` | `#0b1622` `#24588f` `#3aae9f` `#e9876b` | 20                   |
| `fringe`      | `#0a0a0c` | `#0a0a0c` `#ff2a10` `#1aff60` `#1040ff` | 120                  |
| `nightsky`    | `#08041a` | `#070318` `#0a0912` `#58887a` `#8274a8` | 40                   |
| `matrix`      | `#020a06` | `#010805` `#0a4d22` `#2ee86f` `#dcffe8` | 45                   |

### Measured cost

**The gauge** reads `SCENE_LOAD` in `scenes/load.ts`: the scene's own
drawing work in ms per frame on the GPU, at 1920x1200 CSS pixels times
its resolution, M4, headless Chrome for Testing 155 (ANGLE Metal), median
of 7 interleaved rounds with the GPU otherwise quiet; scenes drawn at
screen density (Contour, Topology) at 1.5 (`opt/bench-all.mjs`
in the session scratchpad: each shader through the real prelude, timed
with GPU timer queries). Light < 0.03, medium < 0.12, heavy above
(2026-10-14).

Why GPU ms and not CPU %: the CPU cost of showing 30 frames a second is
the same for every scene (a blank shader costs as much as Tarn, below),
so CPU percentages put all scenes within a point or two of each other and
the old gauge was mostly noise. The shader's own work is what a slow GPU
feels (a Raspberry Pi 5 is roughly 30-60x slower than the M4), and it
spreads the scenes over a factor of 40.

| Scene       | GPU ms/frame | Gauge  |
| ----------- | ------------ | ------ |
| Bloom       | 0.007        | light  |
| Convergence | 0.010        | light  |
| Silk        | 0.011        | light  |
| Tarn        | 0.012        | light  |
| Fringe      | 0.013        | light  |
| Aurora      | 0.014        | light  |
| Clouds      | 0.014        | light  |
| Lumen       | 0.036        | medium |
| Ember       | 0.037        | medium |
| Wave        | 0.049        | medium |
| Ribbons     | 0.050        | medium |
| Canopy      | 0.079        | medium |
| Matrix      | 0.084        | medium |
| Night Sky   | 0.087        | medium |
| Contour     | 0.164        | heavy  |
| Topology    | 0.191        | heavy  |

CPU, for reference (older runs: M4, headed 1440x900, active pace, 8 s per
scene, `SystemInfo.getProcessInfo`; page / GPU process, % of one core):
every scene measured 4.1-8.3% / 7.7-11.3%, Ember the highest because of
its grain at 0.75 resolution.

Notes:

- Most of the GPU number is compositing 30 frames a second, not the
  shader, so scenes differ little. Ember is the heaviest (grain at 0.75).
- With macOS's GPU utilization on a 2x screen: Tarn 34%, the detailed
  scenes (Sakura, Comet, Koi, Window) 36-43%.
- After a minute without input every scene drops to calm (40% speed,
  2/3 of the quality level's fps: 20 at the default 30). Measured idle (M4, headed Chrome, page / graphics): active
  4.1-5.8% / 7.5-10.6%; calm, at 15 fps before the move to 20, 2.7% /
  5.8%. Hidden tabs cost nothing.
- Memory says more than GPU CPU%. On M4 at 2x, one tab: Tarn's process
  about 100 MB plus the GPU process about 175-185 MB for most scenes
  (Contour at 1.5x about 260 MB; it was 335 MB at 2x). Chrome's own new
  tab: about 77 MB + 76 MB. Each extra open Tarn tab adds about 13 MB to
  the process (8 tabs: 190 MB / 291 MB). The one-tab process figure has
  grown from about 78 to 102 MB across versions (measured on built
  history, 2026-10-14).
- **Where the cost really is (2026-10-14).** A blank shader in the same
  engine costs the same CPU as Tarn (page about 5%, GPU process about 11%
  on the M4): the cost is the pipeline of 30 frames a second (worker,
  OffscreenCanvas commit, compositing), not the scene. Profiled: the
  page's main thread is about 0.07% busy; the worker was 2% busy, 80% of
  it the ghost readback (now 0.4%). Scene shader cost matters on weak
  GPUs: ms per frame at 1920x1200 CSS x resolution (`opt/bench.mjs` in
  the session scratchpad; a Raspberry Pi 5 GPU is roughly 30-60x slower):
  Tarn 0.081 → ~0.027, Bloom 0.018 → ~0.005, Wave 0.084 → ~0.045,
  Aurora 0.049 → ~0.027, Silk 0.039 → ~0.011, Contour 0.211 → 0.162 (its
  floor at 1.5x is pixel count); Sakura 0.46, Koi 0.32, Window 0.30,
  Comet 0.27, Ember 0.05, Lumen 0.05 unchanged. On the M4 the bench
  bottoms out near 0.03 ms (tile rendering skips covered work), so small
  numbers are noisy.
- `load.test.ts` pins Tarn as light, Matrix as medium and Contour as heavy;
  changing their numbers may need the test updated.

### Replaced and removed scenes

`REPLACED_SCENES` in `src/settings/schema.ts` maps a stored id to the
nearest current scene in `normalizeSettings`, so whoever picked one keeps
a similar background instead of the default:

| Stored id   | Becomes    |
| ----------- | ---------- |
| `rain`      | `nightsky` |
| `nebula`    | `nightsky` |
| `dunes`     | `contour`  |
| `mist`      | `contour`  |
| `sora`      | `aurora`   |
| `fireflies` | `nightsky` |
| `sakura`    | `bloom`    |
| `koi`       | `tarn`     |
| `window`    | `nightsky` |
| `comet`     | `nightsky` |

Any other unknown id becomes the default (`tarn`).

## Owner's taste and decisions

From the owner, in their words where it matters.

### Principles

- **Calm and slow.** Slow, continuous motion, no sudden changes. The
  water-like Tarn scene is the signature and the owner loves it (it is
  what store art should show).
- **But motion you notice within seconds.** "Not animating enough" means
  nothing visibly changes within a few seconds. Lumen's shafts now sway
  and dim on their own every few seconds, haze rolls, light pulses down
  the beams.
- **Realism over cute props.** The owner called Comet's row of little
  houses with power lines "very much Claude coded". A mirrored mountain
  lake with clustered shore lights and long reflections reads as real.
- **Quality comes from resolution and detail.** At 0.5 the owner called
  Koi "very low quality"; half resolution reads as low quality on
  detailed scenes. Detailed scenes (Sakura, Comet, Koi, Window) render at
  1 and carry real detail. Soft scenes (Tarn, Bloom, Silk, Aurora, Lumen)
  stay low because they look the same.
- **Avoid two scenes of the same family.** An ink-marbling scene
  (Suminagashi) came out as a second "lines on paper" next to Contour and
  was swapped for Koi.
- **Rejected for good:** prism and rainbow scenes, iridescent "pearl"
  effects, rainbow glow around UI (two prism attempts rejected on
  2026-10-11). Don't propose spectral or rainbow effects again.
- **Never stop a visible scene.** A version that glided to a full stop
  after 3 minutes idle was rejected ("id love it to see still running").
- **No felt low frame rate.** A hard 30 to 10 fps step was "hard lag"; a
  smooth ease to 15 fps at half speed still felt low. Calm is now 40%
  speed at 20 fps, so each frame moves less than at full speed.
- **Don't slow down when another app is in front.** On a wide display
  Tarn stays in view beside other windows. Only a hidden tab stops.
- **Don't speed up the arrival.** The 0.7 s fade and 1.1 s settle stay; a
  faster version (0.45 s, settle 0.65 s) felt flashy (2026-10-12). But
  widgets come in with the scene's first frame: waiting for the fade felt
  "so late".
- **Thumbnails must look like the real thing.** Real frames, tiny files.
- **Light first** (BRAND.md): a light scene when the system is light,
  with the dark scene as its twin, never flashing the wrong one. Not
  built yet; the default is Tarn (dark) everywhere.

### History

- 2026-10-11: two prism scenes rejected.
- 2026-10-13: Aurora and Silk added (PR #14). The owner asked for
  "something new" (mentioning Luma as a vibe) and loved both. Silk was
  brightened later that day (deeper shadows, stronger warm highlights).
  Photos added the same day.
- 2026-10-14: the owner found Mist, Dunes, Rain and Nebula "too basic,
  just moving something" and asked for something "more serious and
  better", Luma-like, plus a few anime-like ones. They were replaced by
  eight new scenes. The owner's verdicts: Contour "fine" (then made
  sharp), Sora and Fireflies "ass" (removed), Lumen "not animating
  enough", Koi "very low quality", Window "looks weird", Comet's bottom
  "low quality", Sakura "kinda good". All five were reworked. Number-key
  scene switching was removed the same day.

Later on 2026-10-14 the owner removed Sakura, Koi and Window ("they are
bad"), leaving nine scenes; their ids map to Bloom, Tarn and Comet.

Later still on 2026-10-14 the owner asked for eight more, pointing at
Vanta's Clouds 2 and Topology, ThreeUI's Pine Canopy ("very solid
cyberpunk loading screen vibe") and Stream Convergence, two animated SVG
wave backgrounds, a chromatic-aberration sine wave, a canvas night sky
and a Matrix rain, all "very optimized". They were built as original
look-alikes, studied from screenshots only: Clouds, Topology, Canopy,
Convergence, Ribbons, Fringe, Night Sky and Matrix. Ember's grain had
looked lower in quality since the calm pace: it was tied to scene time,
which slows to 40%, so it froze; it now changes every frame. The gauge
moved from CPU % to measured GPU ms the same day.

The owner's verdict the same evening: Fringe, Night Sky and Matrix
"fucking sick". Comet removed (its id and the ids that pointed to it now
map to Night Sky). Canopy "why is it green? I said cyberpunk": recolored
to cyan and magenta neon on indigo-black, slower (1 to 0.45). Topology
slower (0.15 to 0.075) and "I can see pixels": it drew 1-pixel hairlines
at CSS resolution, which a 2x screen magnified into stair steps; it now
renders at screen density (≤ 1.5) with smooth 1.5 px thread edges, which
doubles its cost (0.10 to 0.19 ms, gauge "higher"). Convergence slower
(1.4 to 0.7) with a new palette, teal and amber, picked from seven
rendered options. Ribbons "a little weird... that small flying stuff is
too extra": the dashed strands under the ribbons were removed.

### Rejected scenes

| Scene        | Why                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Prism (x2)   | Rainbow and spectral effects; rejected for good                                                  |
| Mist         | "Too basic, just moving something"                                                               |
| Dunes        | Same                                                                                             |
| Rain         | Same (replaced by Window)                                                                        |
| Nebula       | Same (replaced by Comet)                                                                         |
| Sora         | Anime sky; noise clouds read as snowy mountains, then as plastic balloons                        |
| Fireflies    | Judged "ass"                                                                                     |
| Suminagashi  | Ink marbling; duplicated Contour's "lines on paper"; swapped for Koi                             |
| Comet's town | A row of houses with power lines, "very much Claude coded"; replaced by a mirrored mountain lake |

### Tuning lessons

Render frames and look at them; numbers alone didn't catch these.

Aurora:

- A uniform glow above a curtain's lower edge makes the darker sky below
  read as a mountain or the ground. Keep the glow streaky (rays with a low
  floor) so the sky between rays is as dark as below.
- Bending the band into an arc looked like a planet's horizon from space.
  A straight, slightly tilted band reads as sky.
- Stars from a hash grid must be drawn as soft round points inside each
  cell; filled cells show as blocky squares at full screen.

Silk: it needed stronger normals and fewer, longer folds than the first
try; weak shading read as a blurry cloud, and three equal sine waves
looked busy.

The 2026-10-14 eight (each took several rendered rounds):

- **Anime clouds are painted, not simulated.** Noise-shaped masses read
  as snowy mountains; one smooth height field of domes read as plastic
  balloons. What worked better: scalloped discs (`abs(sin)` lobes on the
  radius) shaded like balls and posterized into three bands, drawn back
  to front, plus lighting by tower (sunward side brighter, base in
  shadow) so small puffs don't each shout with a crescent. Keep the
  middle of the sky open for the clock and widgets. (Sora was still
  removed.)
- **A drop on glass is a lens.** Sample the background at `uv - offset`
  (a shrunk, flipped view of a wider area); drawing the background
  sharper inside drops made them dark holes.
- **Thin lines need exact noise.** The fast texture noise has kinks its
  bilinear filter can't hide; contour lines showed every one.
- **Thin lines need real pixels.** `resolution` is per CSS pixel, so 0.75
  on a 2x screen is 0.375 of its pixels and lines go soft. Contour uses
  the screen's density (up to 2, like photos) and sizes lines in pixels
  (`fwidth`), so minor lines are true hairlines.
- **No derivatives after an early return.** `fwidth` in a function that
  returns early is undefined at the boundary and drew faint dotted lines;
  use a pixel size from `uResolution` instead.
- **A rainy city reads as bokeh, not buildings.** Building blocks with
  window grids looked pixelated through the blur; layered bokeh discs
  with brighter rims look like a photo.
- **Silhouettes need a real shape language.** Bumpy crowns and wave-like
  treelines looked like clip art; tiered pines, reeds and a mirrored lake
  made the night scene.

## How to add or change a scene

1. Read "Owner's taste" and `docs/brand/BRAND.md`. Write the shader
   yourself: never copy shaders from sites or apps; use them as
   inspiration only.
2. Add the `Scene` to `SCENES` in `src/backdrop/scenes/index.ts`; its
   position is its place in settings. Use `uColors` for color, pick
   `base` so `sceneTone` gives the right tone, choose the noise per
   "The shader prelude", and the lowest `resolution` that looks right
   (soft: 0.5 or lower; detailed: 1; pixel-sized lines: screen density).
   `src/settings/schema.ts` needs nothing for a new scene: the setting is
   validated against `SCENES`.
3. Look at it while tuning: render candidate frames with the preview
   script (`id@seconds`), then check it full screen in the dev build, in
   motion, for at least a minute (calm pace included).
4. Check it with widgets (the frost should look right over it), with the
   glass search box, in light and dark system themes, and with reduced
   motion (the single still frame should be a good one).
5. Pick its moment in `MOMENTS` (`scripts/scene-previews.mjs`) and
   regenerate `public/scenes/` (all of them, or just its id without
   `@`).
6. Measure its cost the same way as the table (switch scenes from
   settings, sample `SystemInfo.getProcessInfo` CPU per process, active
   pace) and add or update its row in `SCENE_LOAD`
   (`src/backdrop/scenes/load.ts`). `load.test.ts` fails without a row.
7. Run `npm run check`. `scenes.test.ts` checks four colors, hex `base`,
   resolution in (0, 1], speed > 0, the `scene()` signature and unique
   ids. (Contour's `min(devicePixelRatio, 2)` passes only because the test
   environment's ratio is 1.)
8. Update this file (library, data, cost, taste), `README.md` (the scene
   list in Features) and `CHANGELOG.md`.

Changing an existing scene: same steps 3-8. Regenerate its thumbnail and
re-measure; the gauge must reflect the change.

Removing or renaming a scene: add the old id to `REPLACED_SCENES` with
its nearest scene, delete its `.webp`, its `MOMENTS` and `SCENE_LOAD`
entries, and update the docs. Never reuse a removed id for a different
scene.

## Planned work

Not built yet:

- **Free hidden tabs' GPU memory.** After about 30 s hidden, release the
  tab's GL resources and restore through the ghost when it shows again
  (today a hidden tab keeps its context, programs and textures).
- **A lighter glass copy for Contour.** It renders at 1.5x since #51; a
  half-size copy for the glass would save more GPU memory.
- **A low-resolution height field** (engine): scenes like Contour could
  draw their land at 1/8 size into a texture and read it with a smooth
  B-spline at full size; the frame would still sit at the pixel-count
  floor.
- **A battery saver.**
- **Light/dark twins** that follow the system theme (BRAND.md: light
  first). Bloom, Silk and Contour are the light scenes so far.
- **Video backgrounds**, following the photo path: original in
  IndexedDB, ease in on open, ghost on reload, never block first paint on
  async storage.

## Files map

| File                                         | What it does                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/backdrop/tarn-backdrop.ts`              | `<tarn-backdrop>`: canvas, worker or local renderer, arrival, crossfade, pace input, ghost saves, still fallback |
| `src/backdrop/renderer.ts`                   | `Renderer`: WebGL2 loop, clock, pace easing, governor hook, scene and glass passes, photos, ghost capture        |
| `src/backdrop/render.worker.ts`              | Runs the `Renderer` on an `OffscreenCanvas` in a worker (production)                                             |
| `src/backdrop/protocol.ts`                   | Page ↔ renderer messages and `applyCommand`                                                                      |
| `src/backdrop/pace.ts`                       | `decidePace` / `nextPaceCheckMs`: active or calm after 60 s without input                                        |
| `src/backdrop/quality.ts`                    | `QualityGovernor` and `initialQualityLevel`: resolution and fps steps                                            |
| `src/backdrop/glass.ts`                      | Glass pass shaders and `MAX_TILES`                                                                               |
| `src/backdrop/noise-texture.ts`              | Bakes the 512x512 R16F noise texture from an exact port of the GLSL hash                                         |
| `src/backdrop/scenes/types.ts`               | The `Scene` type                                                                                                 |
| `src/backdrop/scenes/glsl.ts`                | Full-screen vertex shader and the fragment prelude (uniforms, hash, noise, fbm, dither)                          |
| `src/backdrop/scenes/index.ts`               | The sixteen scenes, `SCENES`, `sceneById`, `sceneTone`, `sceneStill`, `scenePreview`, `photoScene`               |
| `src/backdrop/scenes/load.ts`                | `SCENE_LOAD` measurements and `loadLevel` for the gauge                                                          |
| `src/backdrop/*.test.ts`, `scenes/*.test.ts` | Noise texture, pace, quality, scene shape and load tests                                                         |
| `src/app/first-paint.ts`                     | Blocking first paint: start color, arrival, ghost read/paint/save, clock and scene mirrors                       |
| `src/entrypoints/first-paint.ts`             | The classic blocking script that calls `prepareFirstPaint`                                                       |
| `src/app/tile-memory.ts`                     | Widget rectangles per tab, so a reload frosts from its first live frame                                          |
| `src/app/mirror.ts`                          | `mirrorSettings`: scene, base color and home layout into localStorage for first paint                            |
| `src/app/tarn-app.ts`                        | Hosts the backdrop; `onTiles`, `searchGlassRect`, `liveScene`, tone attribute                                    |
| `src/widgets/tarn-board.ts`                  | Measures tiles and fires `tarn-tiles` (`report`, `refresh`); CSS glass fallback                                  |
| `src/wallpapers/store.ts`                    | User photos in IndexedDB, the `tarn.photos` mirror, add/list/delete/restore                                      |
| `src/settings/schema.ts`                     | `scene` setting, `REPLACED_SCENES`, `normalizeSettings`                                                          |
| `src/panel/tarn-panel.ts`                    | Wallpaper cards, Show All page, photos, gauge                                                                    |
| `scripts/scene-previews.mjs`                 | Renders thumbnails in headless Chrome; `MOMENTS`                                                                 |
| `scripts/scene-preview-page.ts`              | The page it runs: one frame per scene at 2x, as WebP                                                             |
| `public/scenes/<id>.webp`                    | The thumbnails                                                                                                   |
