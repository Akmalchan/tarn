# Backgrounds

Everything about Tarn's living backgrounds ("scenes") in one place: what
each one is, how they're built and kept light, how the settings thumbnails
are made, and what the owner liked and rejected. Read this before changing
or adding a scene. The brand side lives in `docs/brand/BRAND.md`
("Backgrounds: the signature"); the timing rules live in `AGENTS.md`
("Arrival", "Rendering performance").

## The scenes

Twelve scenes, in `src/backdrop/scenes/index.ts`. Their order in
`SCENES` is the order in settings. There are no keyboard shortcuts: the
number keys switched scenes until 2026-10-14, when the owner removed them
(people typed numbers and the wallpaper changed). Each scene's measured
cost lives in `src/backdrop/scenes/load.ts` and drives the load gauge on
its settings card; update it whenever a scene changes.

| #   | Scene   | What it draws                                                                                                                                                                      | Tone  | Speed | Resolution           | Noise                   |
| --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- | -------------------- | ----------------------- |
| 1   | Tarn    | Light moving through still water: triple domain-warped noise in navy, teal and pale blue. The default and the brand's signature.                                                   | dark  | 0.22  | 0.5                  | exact `fbm` (must)      |
| 2   | Ember   | Folding purple-pink-orange color waves under animated film grain.                                                                                                                  | dark  | 0.6   | 0.75                 | `noiseFast`             |
| 3   | Bloom   | Soft pastel mesh gradient pushed around by low-frequency noise.                                                                                                                    | light | 0.18  | 0.35                 | `fbmFast`               |
| 4   | Wave    | Nine luminous sine ribbons and a glowing sheet over deep blue, after the classic console wave.                                                                                     | dark  | 0.35  | 1                    | none                    |
| 5   | Aurora  | Northern lights: two tilted curtains with sharp, bright lower edges and streaky rays, teal fading to violet, over a night sky with soft stars.                                     | dark  | 0.25  | 0.5                  | `fbmFast` + `noiseFast` |
| 6   | Silk    | Slow folds of pale satin: a warped sine height field, lit from the upper left; ice-blue shadows, faintly warm highlights.                                                          | light | 0.2   | 0.4                  | `noiseFast`             |
| 7   | Sakura  | 6.5%                                                                                                                                                                               | 9.1%  | 0.5   | 1                    | `fbmFast`               |
| 8   | Comet   | 4.6%                                                                                                                                                                               | 8.6%  | 0.2   | 1                    | `fbmFast` + `noiseFast` |
| 9   | Koi     | 6.8%                                                                                                                                                                               | 9.4%  | 0.5   | 1                    | `noiseFast` + `noise`   |
| 10  | Window  | 7.5%                                                                                                                                                                               | 9.2%  | 0.6   | 1                    | `fbmFast` + `hash01`    |
| 11  | Lumen   | 6.2%                                                                                                                                                                               | 10.0% | 0.4   | 0.5                  | `fbmFast` + `noiseFast` |
| 12  | Contour | A topographic map whose land slowly reshapes: hairline contours with every fifth bolder, faint relief shading (light from the upper left), cool valleys and warm heights on paper. | light | 0.12  | screen density (≤ 2) | exact `noise` (must)    |

Aurora and Silk were added on 2026-10-13 (PR #14). The owner asked for
"something new" (they mentioned Luma as a vibe) and loved both. Silk was
brightened later that day (deeper shadows, stronger warm highlights).

On 2026-10-14 the owner found the next four (Mist, Dunes, Rain, Nebula)
"too basic, just moving something" and asked for something "more serious
and better", Luma-like, and a few anime-like ones. They were replaced by
the eight from Sora to Contour. The same day the owner judged those eight: Contour
"fine" (then made sharp), Sora and Fireflies "ass" (removed), Lumen "not
animating enough", Koi "very low quality", Window "looks weird", Comet's
bottom "low quality", Sakura "kinda good". All five were reworked (see
lessons below). A stored `rain`, `nebula`, `dunes` or
`mist` (and the removed `sora`, `fireflies`) map to the nearest scene
(`REPLACED_SCENES` in `settings/schema.ts`).

### Measured cost

M4 MacBook, Chrome for Testing 155, headed 1440×900, active pace (30 fps),
8 s per scene, two rounds. Percent of one CPU core.

| Scene   | Page (renderer) | GPU process |
| ------- | --------------- | ----------- |
| Tarn    | 5.3-5.4%        | 10.4-10.8%  |
| Ember   | 7.9-8.3%        | 10.9-11.3%  |
| Bloom   | 4.7-5.4%        | 10.0-10.1%  |
| Wave    | 6.4-6.7%        | 10.3-10.7%  |
| Aurora  | 4.1-5.6%        | 7.7-10.3%   |
| Silk    | 4.4-5.3%        | 9.1-10.4%   |
| Sakura  | 6.5%            | 9.1%        |
| Comet   | 4.6%            | 8.6%        |
| Koi     | 6.8%            | 9.4%        |
| Window  | 7.5%            | 9.2%        |
| Lumen   | 6.2%            | 10.0%       |
| Contour | 5.1%            | 10.2%       |

Most of the GPU process number is compositing 30 frames a second, not the
shader itself, so scenes differ little. Ember is the heaviest (grain at
0.75 resolution). After a minute without input every scene drops to the
calm pace (40% speed, 20 fps; see `AGENTS.md`), and hidden tabs cost
nothing.

## Anatomy of a scene

A scene is data (`src/backdrop/scenes/types.ts`):

- `id`, `name`.
- `fragment`: GLSL ES 3.00 that defines `vec3 scene(vec2 uv, float t)`.
  `uv` is centered and aspect-corrected (y spans -0.5..0.5, x about
  ±0.8 on a 16:10 screen); `t` is the animation clock times `speed`.
- `colors`: exactly four, available as `uColors[0..3]`. Use them rather
  than literals, so the still fallback and thumbnails match.
- `base`: the page color behind the scene before its first frame and
  during fades. It also decides `sceneTone()` (light or dark text and
  frost strength on widgets).
- `speed`: time multiplier. It also sets how often the reload ghost is
  saved (faster scenes save more often).
- `resolution`: render scale relative to CSS pixels. Soft scenes look the
  same at a fraction of the cost: keep them at 0.5 or lower.

The shared prelude (`scenes/glsl.ts`) gives `hash01`, and gradient noise
two ways: `noise`/`fbm` (exact, per pixel) and `noiseFast`/`fbmFast` (one
texture fetch, baked from the same function). Use the fast pair for gentle
noise. Heavily domain-warped scenes (Tarn) must use the exact pair: warps
amplify the texture's tiny differences into a flatter pattern. The fast
texture repeats every 32 noise cells; keep frequencies low enough that a
repeat never fits on screen. The prelude adds ±0.5/255 dither to hide
banding.

The renderer owns everything else: the loop, pace, pausing when hidden,
reduced motion, the quality governor, the frosted glass behind widgets,
and the reload ghost.

## Settings thumbnails

The pickers in settings show real frames of each scene, not CSS gradients
(the gradients only hinted at the scenes and "looked off"):

- `scripts/scene-previews.mjs` bundles `scripts/scene-preview-page.ts`
  with Vite, runs it in headless Chrome, and draws each scene with the same
  shaders and noise texture, at 2x then scaled down.
- Output: `public/scenes/<id>.webp`, 320×200 (twice a ~160×100 tile),
  WebP quality 0.8, about 1.4-3.8 KB each, ~14 KB for all six.
- `MOMENTS` in the script picks the moment (seconds of animation clock)
  each thumbnail shows. Pick one that shows the scene at its best.
- `scenePreview(scene)` layers the image over `sceneStill(scene)`, so a
  tile is never blank. `sceneStill` remains the no-WebGL fallback.

```bash
CHROME=/path/to/chrome node scripts/scene-previews.mjs
```

To compare candidate moments without touching `public/`, pass
`id@seconds` arguments and an output folder:
`OUT=/tmp/x node scripts/scene-previews.mjs aurora@20 aurora@100`.

## Adding a scene

1. Write the shader yourself (never copy shaders from sites or apps).
   Read the brand rules below first.
2. Add the `Scene` to `SCENES` in `scenes/index.ts`. Its position is its
   place in settings. `src/settings/schema.ts` needs nothing: the setting
   is validated against `SCENES`.
3. Look at it while tuning: render candidate frames with the preview
   script (`id@seconds`), then check it full screen in the dev build, in
   motion.
4. Pick its moment in `MOMENTS` and regenerate `public/scenes/`.
5. Measure its cost against the table above (switch scenes from settings,
   sample `SystemInfo.getProcessInfo` CPU per process) and add its row to
   `scenes/load.ts`.
6. Update this file, `README.md` (the scene list) and `CHANGELOG.md`.

`src/backdrop/scenes/scenes.test.ts` checks every scene automatically
(four colors, a base, valid speed and resolution, the `scene()`
signature, unique ids).

## Taste: what worked and what didn't

From the owner, in their words where it matters:

- **Calm and slow.** Slow, continuous motion, no sudden changes. The
  water-like Tarn scene is the signature and the owner loves it.
- **Rejected for good:** prism and rainbow scenes, iridescent "pearl"
  effects, rainbow glow around UI (two prism attempts rejected on
  2026-10-11).
- **Never stop a visible scene.** A version that glided to a full stop
  after 3 minutes idle was rejected ("id love it to see still running").
- **No felt low frame rate.** A hard 30 to 10 fps step was "hard lag"; a
  smooth ease to 15 fps at half speed still felt low. Now calm is 40%
  speed at 20 fps, so each frame moves less than at full speed.
- **Don't slow down when another app is in front.** On a wide display
  Tarn stays in view beside other windows.
- **Don't speed up the arrival.** The scene's 0.7 s fade and 1.1 s settle
  stay; a faster version felt flashy.
- **Thumbnails must look like the real thing.** Real frames, tiny files.

Tuning lessons from Aurora (render frames and look at them; numbers alone
didn't catch these):

- A uniform glow above a curtain's lower edge makes the darker sky below
  read as a mountain or the ground. Keep the glow streaky (rays with a low
  floor) so the sky between rays is as dark as below.
- Bending the band into an arc looked like a planet's horizon from space.
  A straight, slightly tilted band reads as sky.
- Stars from a hash grid must be drawn as soft round points inside each
  cell; filled cells show as blocky squares at full screen.

Silk needed stronger normals and fewer, longer folds than the first try;
weak shading read as a blurry cloud, and three equal sine waves looked busy.

Lessons from the 2026-10-14 eight (each took several rendered rounds):

- **Anime clouds are painted, not simulated.** Noise-shaped masses read as
  snowy mountains; one smooth height field of domes read as plastic
  balloons. What worked: scalloped discs (`abs(sin)` lobes on the radius)
  shaded like balls and posterized into three bands, drawn back to front,
  plus lighting by tower (sunward side brighter, base in shadow) so small
  puffs don't each shout with a crescent. Keep the middle of the sky open
  for the clock and widgets.
- **A drop on glass is a lens.** Sample the background at
  `uv - offset` (a shrunk, flipped view of a wider area); drawing the
  background sharper inside drops made them dark holes.
- **Thin lines need exact noise.** The fast texture noise has kinks its
  bilinear filter can't hide; contour lines showed every one.
- **Thin lines need real pixels.** `resolution` is per CSS pixel, so 0.75
  on a 2x screen is 0.375 of its pixels and lines go soft. Contour uses the
  screen's density (up to 2, like photos) and sizes lines in pixels
  (`fwidth`), so minor lines are true hairlines. Measured on a 2x screen:
  the same cost as Tarn (page 5.3%, GPU 10.5%).
- **Avoid two scenes of the same family.** An ink-marbling scene
  (Suminagashi) came out as a second "lines on paper" next to Contour and
  was swapped for Koi.
- **Quality comes from resolution and detail.** At 0.5 resolution the
  owner called Koi "very low quality". Detailed scenes (Sakura, Comet, Koi,
  Window) now render at 1 and carry real detail: koi with sheen, eyes and
  rayed fins; a sharp blossom branch over the blur. Measured on a 2x
  screen with macOS's GPU utilization: Tarn 34%, the detailed ones 36-43%.
- **"Not animating enough" means motion you notice within seconds.**
  Lumen's shafts now sway and dim on their own every few seconds, haze
  rolls, light pulses down the beams.
- **No derivatives after an early return.** `fwidth` in a function that
  returns early is undefined at the boundary and drew faint dotted lines;
  use a pixel size from `uResolution` instead.
- **A rainy city reads as bokeh, not buildings.** Building blocks with
  window grids looked pixelated through the blur; layered bokeh discs
  with brighter rims look like a photo.
- **Silhouettes need a real shape language.** Bumpy crowns and
  wave-like treelines looked like clip art; tiered pines, reeds and a
  mirrored lake made the night scene.

## Your own photos

Since 2026-10-13 people can add their own photos (Settings > Wallpapers >
Add Photo…). A photo is a scene like any other (`photo:<id>`), built by
`photoScene()`: still (speed 0), cover-fit, drawn at the screen's pixel
density up to 2x, base color and tone from the photo itself. It's drawn
once and then nothing runs: page ~0% CPU, graphics ~1.7% while idle. The
frosted glass behind widgets works the same; it redraws only when tiles
move. Storage, thumbnails and the panel are in `src/wallpapers/store.ts`
and the settings panel.

## Ideas not built yet

- Light/dark twins that follow the system theme (BRAND.md: light first).
  Bloom and Silk are the light scenes so far.
- Video backgrounds, following the photo path (see `AGENTS.md`).
