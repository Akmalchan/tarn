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

The map of the code, and a doc for every area (background, clocks,
widgets, search, settings, design), is in [docs/README.md](docs/README.md),
starting with [docs/architecture.md](docs/architecture.md).

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

## Adding a scene, a clock face or a widget

Each has a checklist in its doc: [docs/wallpapers.md](docs/wallpapers.md),
[docs/clocks.md](docs/clocks.md), [docs/widgets.md](docs/widgets.md).

## Style

Google TypeScript style, enforced by ESLint and Prettier (`npm run fix`).
New source files start with the license header:

```ts
/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */
```

Tarn is licensed under the [Functional Source License](LICENSE)
(FSL-1.1-ALv2), which becomes Apache 2.0 two years after each release. By
submitting a contribution, you confirm that it is your own work, and you
grant Akmal Shovkatov, and anyone Tarn is later transferred to, a perpetual,
worldwide, royalty-free, irrevocable license to use, modify, sublicense
and relicense it under any terms, including the FSL, Apache 2.0 or a
commercial license. You keep the copyright to your contribution.
