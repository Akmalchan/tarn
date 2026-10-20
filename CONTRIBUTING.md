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

- `src/entrypoints/`: the new tab, the settings side panel, the toolbar
  popup and the background worker.
- `src/backdrop/`: the WebGL2 renderer and every wallpaper scene.
- `src/widgets/`: the clock, the board and each widget.
- `src/panel/`: settings. `src/settings/`: the stored settings, with
  migrations and backups.
- `src/i18n/`: every visible word, in ten languages.

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

## Before you start something big

Open an issue first for a new wallpaper, clock face, widget or permission,
so we can agree on it before you spend the time.

## Style

Google TypeScript style, enforced by ESLint and Prettier (`npm run fix`).
New source files start with the license header:

```ts
/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */
```

Tarn is licensed under the [PolyForm Shield License 1.0.0](LICENSE). By
submitting a contribution, you confirm that it is your own work, and you
grant Akmal Shovkatov, and anyone Tarn is later transferred to, a perpetual,
worldwide, royalty-free, irrevocable license to use, modify, sublicense
and relicense it under any terms, including PolyForm Shield, Apache 2.0 or a
commercial license. You keep the copyright to your contribution.
