# Tarn: notes for AI agents and contributors

Source-available new tab page for every browser, with GPU-rendered backgrounds.
Goal: ultra clean and calm by default, deeply customizable for power users.

This file is the short list of rules. The details live in `docs/`, one doc
per area; **read the area's doc before changing it, and update it in the
same pull request** (map: `docs/README.md`).

| Before you…                                                 | Read                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| do anything                                                 | `docs/architecture.md` (entrypoints, folders, arrival, data, permissions)    |
| add any feature                                             | `docs/research/2026-10-new-tab-research.md` (what users want, five promises) |
| touch anything visible                                      | `docs/design.md`                                                             |
| touch the name, wordmark, `ta` mark, icons or store listing | `docs/brand/BRAND.md` (there is no logo; rejected ideas)                     |
| change the background engine or a scene                     | `docs/wallpapers.md`                                                         |
| change the clock or a face                                  | `docs/clocks.md`                                                             |
| change the board, the layout or a widget                    | `docs/widgets.md`                                                            |
| change the search box                                       | `docs/search.md`                                                             |
| add or change a setting, storage, migrations or backups     | `docs/settings.md`                                                           |
| publish, or change the store listing or a permission        | `docs/publishing.md`                                                         |
| download designs, or change how an id is stored             | `docs/library.md`                                                            |

## Stack (decided, don't change without discussion)

- **Lit + TypeScript (strict)**: Web Components; Lit is the only runtime dependency.
- **WXT**: builds Chromium and Firefox from one codebase (`src/entrypoints/`).
- **Raw WebGL2**: no three.js or shader libraries.
- **Plain CSS** with tokens in `src/styles/global.css`.
- **FSL-1.1-ALv2** (since 2026-10-14; Apache 2.0 before): every source
  file carries the SPDX header (`license.test.ts`). Anyone may use, read,
  fork and contribute; no one may ship a competing product from the code;
  each version becomes Apache 2.0 two years after release. Code published
  before the switch stays Apache 2.0. Keep the copyright clean: no copied
  code, and outside contributions only under CONTRIBUTING.md's terms.
- Google TypeScript style (ESLint + Prettier). `npm run check` must pass.

## Rules

- **Ownership:** write original code. Never copy from proprietary sites or
  apps, including shaders; use them as inspiration only.
- **Network:** none by default. A feature that needs the network is an
  explicit, opt-in decision by the owner; document it in README, PRIVACY.md,
  `docs/architecture.md` and here before building. Approved so far:
  **weather** (2026-10-13; Open-Meteo, or Google with the user's own key;
  rounded coordinates, at most every 30 min while visible; details in
  `docs/widgets.md`) and the **search box** (2026-10-14; the query to the
  browser's default engine on Enter, voice audio to Google while
  listening, an image to Google Lens when given, AI Mode opens Google;
  no web suggestions; details in `docs/search.md`). All requests omit
  credentials and referrer. The planned online library follows
  `docs/library.md`.
- **Permissions:** required `storage`, `offscreen`, `sidePanel`,
  `favicon`, `bookmarks`, `search`; optional `management` (switch off
  another new-tab extension, Chromium) and `geolocation` (weather's "Use my
  location"). Why each, and its install warning: `docs/architecture.md`.
  A new required permission in an update disables Tarn for existing
  users until they accept it, so add later ones as optional, each with a
  stated reason.
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
  as a fixture in the "every past shape" test. Import and restores
  use `replaceSettings` (a full replace, `enabled` kept); Reset is a
  patch of the look only (`resetSettings`), never widgets or their content. Each update first
  saves an automatic backup (settings plus widget content, last 3), and
  Export/Import carry the same backup format.

## Working on Tarn

- Several AI sessions work at once in the same folder. The owner's dev
  build (`npm run dev`, loaded as "Tarn Dev") shows edits live; ship each
  change from its own branch in a git worktree as a squash-merged PR (one
  commit). Say which files you edit before touching them; sync to a
  worktree from an explicit file list, never from `git status`.
- Show the owner real renders (headless Chrome screenshots at 2x), not
  descriptions. Short verdicts; their decisions go into the area's doc
  with the date.
- Add a CHANGELOG line with every user-visible change. A version bump also
  writes that release's What's new notes (`RELEASES` in
  `src/panel/about.ts`, 3 to 5 lines, all 10 languages); the test fails
  without them.

## Commands

- `npm run dev`: browser with live reload
- `npm run check`: typecheck + lint + test + build
- `npm run build` / `npm run build:firefox`
