# Contributing to Tarn

Thanks for helping. Tarn values clean, small, well-reasoned changes over
big ones.

## Setup

```bash
npm install
npm run dev
```

Before opening a pull request, run `npm run check`. It type-checks, lints,
runs the tests and builds, which is the same as CI.

## How the code is organized

```
src/
  entrypoints/newtab/   The new tab page (WXT entrypoint).
  app/                  The root <tarn-app> element and first-paint helpers.
  backdrop/             Animated background.
    renderer.ts         WebGL2 loop: sizing, frame cap, pausing, context loss.
    render.worker.ts    Runs the renderer off the main thread.
    tarn-backdrop.ts    <tarn-backdrop>: owns the canvas, picks worker or main thread.
    scenes/             Scenes: one fragment shader + colors each.
  settings/             Typed settings, synced through browser storage.
  styles/               Global CSS and design tokens.
```

## Principles

- **Native first.** Web Components (Lit), plain CSS, raw WebGL2 and the
  standard WebExtension API. Lit is the only runtime dependency. Adding
  another needs a strong reason.
- **Performance is a feature.** Animate only `transform` and `opacity`.
  Never block first paint. Respect `prefers-reduced-motion`.
- **Private by default.** No network requests unless a feature is
  explicitly opt-in and documented.
- **Minimal permissions.** Every manifest permission must be justified in
  the pull request.

## Adding a background scene

1. Add a `Scene` to `src/backdrop/scenes/index.ts`: an id, a name, four
   colors, a base color, speed, resolution and a fragment body defining
   `vec3 scene(vec2 uv, float t)`.
2. Write the shader yourself, or use code under a compatible license with
   attribution. Do not copy shaders from sites or products without a
   license.
3. Keep it cheap: soft scenes should render at `resolution` 0.5 or lower.
4. Render its settings thumbnail from the real shader, picking a good
   moment in `MOMENTS`:
   `CHROME=/path/to/chrome node scripts/scene-previews.mjs`. It writes
   `public/scenes/<id>.webp` (a few KB).

## Style

Google TypeScript style, enforced by ESLint and Prettier (`npm run fix`).
New source files start with the license header:

```ts
/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */
```

By contributing, you agree your contribution is licensed under Apache 2.0.
