# Settings

Everything about Tarn's settings: what is stored and how it stays safe
across versions and computers, and the settings panel where people
change it. Read this before adding or changing any setting, or anything
in the panel.

## Where settings live

| What                                                                                                                      | Where                              | Synced                             | Code                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| Settings (wallpaper, clock and its color, widgets list, search box, weather source and units, language, tab icon, on/off) | `storage.sync`, key `settings.v1`  | Yes, through the browser's account | `src/settings/store.ts`                                 |
| Widget content (notes, tasks, bookmarks, timer, weather place)                                                            | `storage.local`, `widget.<id>`     | No                                 | `src/widgets/data.ts`                                   |
| Photos                                                                                                                    | IndexedDB                          | No                                 | `src/wallpapers/store.ts`                               |
| Google Weather key                                                                                                        | `storage.local`                    | No, and never exported             | `src/weather/config.ts`                                 |
| Your own tab icon                                                                                                         | localStorage `tarn.tabIcon.custom` | No                                 | `src/panel/tarn-panel.ts`, `src/app/first-paint.ts`     |
| Mirrors for first paint (scene, base color, home settings, widget content, icons, tile rects, ghost)                      | localStorage / sessionStorage      | No                                 | `src/app/mirror.ts`, `first-paint.ts`, `tile-memory.ts` |
| Automatic backups (last 3)                                                                                                | `storage.local`, `backups.auto`    | No                                 | `src/settings/backup.ts`                                |
| First-run tip still to show (fresh install only, removed once done)                                                       | `storage.local`, `tip.settings`    | No                                 | `src/app/first-run.ts`                                  |

The schema is `src/settings/schema.ts`: the `Settings` type, its
defaults (`DEFAULT_SETTINGS`), the start setup (`START_WIDGETS`) and
`normalizeSettings`, which turns anything stored (missing, old,
hand-edited, from a newer version) into valid settings. Stored data is
never trusted.

## Never lose a setup

Settings sync between computers that can run different Tarn versions.
The rules (pinned by `src/settings/protection.test.ts`):

- **Saves are patches.** `saveSettings` rewrites only the fields a change
  touches; values, widgets and fields this version doesn't know are kept,
  just not shown. Writes are serialized, so a tab and the panel can't
  drop each other's change.
- **Reading never rewrites.** An unknown wallpaper or clock shows the
  default; an unknown widget is skipped but keeps its place.
- **Renaming or moving a stored value** bumps `SETTINGS_VERSION`
  (`src/settings/migrate.ts`) with a migration step, plus the old shape
  as a fixture in "every past shape still loads". Never rename an id.
- **Removed ids map forward** (`REPLACED_SCENES`).
- **Import and restores** use `replaceSettings` (a full replace,
  `enabled` kept). **Reset** is a patch (`resetSettings`, `RESET_KEYS` in
  `store.ts`): wallpaper, tab icon, clock, clock color, search box and
  weather go back to the defaults; the widgets, what's in them (bookmarks,
  notes), the language and anything a newer Tarn stored stay (owner,
  2026-10-14: "it won't be for bookmarks"). It saves a backup first, for
  Undo.
- **Each update saves a backup first** (settings plus widget content,
  last 3), shown in Advanced as Previous Setups. Export/Import use the
  same format (`format: 'tarn-backup'`).
- **Future library items** (`lib:` ids) follow the same rules; see
  `docs/library.md`.

## Adding a setting

1. Add it to `Settings` in `schema.ts`, with a default and a normalizer
   branch. Add it to the "keeps valid values" test in
   `settings.test.ts`.
2. If first paint needs it, mirror it in `app/mirror.ts`.
3. Pick its place in the panel with rule 1 below: home only if most
   people will change it; otherwise an existing page, or Advanced.
4. Give the row a filled glyph (`src/ui/glyphs.ts`) and a `data-target`.
5. Add a `SEARCH_INDEX` entry pointing at that page and id.
6. Every word through `t()`, in all 10 catalogs (`src/i18n/messages/`).
7. If it can be exported, make sure `replaceSettings` carries it.

## The settings panel

The panel lives in the browser's side panel next to the new tab
(`src/panel/tarn-panel.ts`); every change applies to open tabs at once.
While it is open, the tab is in edit mode (widgets drag, resize, rename;
Bookmarks and Weather show their own controls).

Decided with the owner on 2026-10-12, after comparing tabs against a list
in a live prototype: [Tarn Settings Panel](https://claude.ai/artifact/6mQoz7iAkLC3wiomqzW1Yn).

![The panel: home and Widgets in light, home and Advanced in dark](design/settings-panel-preview.png)

### The shape: a list that goes deeper

One scrolling list, like the system settings on a phone. The first screen
shows the few things most people change; each section ends in a row that
opens a page with the rest. There are no tabs and no close button.

```
Settings (home)
├── Search field                   finds every setting, on any page
├── Wallpaper                      the 3 most recent picks + "Show All"
│   └── Wallpapers                 Add Photo…, Your Photos, the live scenes
│                                  (name on the left, a load gauge on the
│                                  right; still thumbnails)
├── Clock                          a card: the 2 most recent faces, None,
│                                  "Show All" (panel/recent.ts)
│   └── Clock                      Color (Auto, Light, Dark), then every
│                                  face (docs/clocks.md)
├── Widgets ›                      on your tab (size, rename, remove), then
│                                  Add a widget (rows with a grip: drag onto
│                                  the page, or click)
├── Search ›                       the search box: Show/Hide, Look, Voice,
│                                  Google Lens, AI Mode (docs/search.md)
├── Language ›                     Same as browser + 10 languages
├── Temperature units              Auto / °C / °F, right on home
├── Advanced ›
├── Reset Settings                 red, centered; asks first in a dialog
│                                  (Cancel / Reset), then Undo
└── Signature                      wordmark, "for <browser>",
                                   Version · What's new (a dot after an
                                   update), Privacy · Source code · Rate
                                   Tarn (store installs only)

Advanced
    ├── Tab icon                   the browser's own / None / Your own image
    ├── Weather                    provider (Open-Meteo or Google + key)
    ├── Keyboard                   shortcuts On/Off and the list (no icons)
    ├── Backup                     export, import (settings + widget
    │                              content)
    ├── Previous Setups            saved before each update; restore one
    ├── settings.json              raw settings, development builds only
    ├── Example setups             five ready-made pages (up to 9 widgets),
    │                              with Undo
    └── About                      version, What's new ›, Rate Tarn,
                                   Send feedback, Licenses, copy
                                   diagnostics

What's new
    └── one section per release, newest first: 3 to 5 short notes
```

## Rules

1. **Home holds what most people change.** Today that's the wallpaper,
   the clock and widgets. Anything else goes one level down.
2. **Show a few, then "Show All".** A picker shows three choices and a
   fourth tile, "Show All" (a background, blurred and faded, with a grid icon), that opens a page
   with all of them (`HOME_SCENES`, `HOME_FACES` in the panel). The three
   are the most recent picks (`panel/recent.ts`; the clock keeps None as
   its third); a pick already shown never reshuffles the card. Backgrounds
   are big 16:10 tiles on the page, the main tool; the clock is a card of
   square tiles under them. Sub-pages are just the grid: no preview, the
   tab next to the panel already shows the result. The current choice is
   always among the tiles. The first screen never grows just because the
   catalog does.
3. **Pictures, not names.** Scenes and clock faces are picked from
   thumbnails drawn on the user's real background.
4. **Advanced is last and is called Advanced.** Not "Developer": it holds
   the tab icon, weather source, keyboard, backup and example setups,
   which normal people need sometimes too.
5. **Search finds everything.** Every setting has an entry in
   `SEARCH_INDEX` with the page it lives on. Picking a result opens that
   page and highlights the row. `/` focuses search; Escape clears it. On
   Wallpapers, Clock, Widgets, Language and Advanced the field filters
   that page's choices or sections instead (`SCOPED_SEARCH`; Advanced
   matches its `SEARCH_INDEX` entries, each with `words` in English and
   `also`, the labels of its rows, in the current language). Search,
   Custom widgets and What's new have no field (`NO_SEARCH_FIELD`; owner,
   2026-10-14: nothing to search there).
6. **Changes are live.** No Save button. Removing a widget or resetting
   shows a toast with Undo.
7. **The panel doesn't turn Tarn off.** The owner removed the "Use Tarn
   for new tabs" switch on 2026-10-13 as not needed; the toolbar button
   and the browser's extensions page do that. Import, reset and
   `settings.json` never change `enabled` either.
8. **No fake features.** Nothing in the panel says "Soon". Add a row when
   the feature ships.
9. **Power options stay out of sight.** What only some people want sits
   behind "More" or in Advanced (owner, 2026-10-13: "hide it from basic
   users"); a list stays a list, without extra buttons (owner rejected
   widget cards and a row of example buttons on the Widgets page).

## Look

- **Light first, with a dark twin**, following `prefers-color-scheme`. A
  grouped list: grey page, white rounded groups, hairlines between rows
  inset past the icon.
- **Black and white.** Icon tiles are black with white glyphs (white with
  black in dark). Switches are black when on (white in dark). No brand hue,
  per `docs/brand/BRAND.md`.
- **Filled icons**, drawn for Tarn in `src/ui/glyphs.ts`: one solid shape
  with details cut out, readable at 15px in a 24px tile. Never outline
  icons, never emoji.
- **Chrome's header says "Settings"; the panel shows the wordmark.**
  Chrome draws the side panel header itself, from the extension's icon and
  its manifest `short_name` (no API changes it, and `document.title` is
  ignored; see `SidePanelUtil::GetTitleText` in Chromium). So `short_name`
  is "Settings" ("Dev Settings" in dev, both within the 12-character
  limit), and the extension's `name` stays "Tarn" everywhere else (store,
  install dialog, extensions page). The home page opens on search and ends on the
  signature (`src/ui/wordmark.ts`); sub-pages open with the bar described
  below.
- **Desktop proportions, like macOS System Settings:** 13.5px titles, 12px
  descriptions, 24px icon tiles with 15px glyphs, 10px group corners, a 32px
  search field. Switches are 34×20, like Safari's settings, not phone-sized.
  The sizes are tokens at the top of the panel's styles (`--title`,
  `--icon`, `--row-x`...); change them there, not per row.
- **One line per row; explanations go under the box.** Like iOS and macOS
  settings, a row is an icon, a title and a control or value (Widgets ›
  shows "3"). What a setting does is a short note below its group, not a
  second line in the row. Only "Add a widget" keeps a description line,
  because there it is the point.
- **Widgets are moved on the tab, not in the panel.** While the panel is
  open the tab is in edit mode, and dragging there is direct; the panel
  only sizes and removes them.
- **The signature closes home, centered:** the wordmark faded, "for" and
  the browser's own name (only names a browser reports: "Google Chrome™"
  per BRAND.md, Edge, Opera, Brave, Vivaldi, Firefox; nothing otherwise),
  the version and What's new, then Privacy (`PRIVACY.md`), Source code and
  Rate Tarn links. A plain line, never Google's logo or colors.
- **About (Advanced, last) holds the rest** (`src/panel/about.ts`, owner
  2026-10-14):
  - **What's new** shows each release's notes. An update sets
    `whatsNew.unseen` in storage.local (background `onInstalled`), which
    puts a small ink dot on the signature link and the row until the page
    is opened. A fresh install shows no dot. Never a popup or a badge on
    the new tab.
  - **Rate Tarn** opens the reviews page of the store this copy came from,
    read from its update URL (Chrome Web Store or Edge Add-ons; the item
    id is Tarn's own id there). Development builds and Firefox show no
    row until Firefox is listed.
  - **Send feedback** opens a new GitHub issue with the version and the
    browser filled in. It sits only here, not in the signature, so it
    isn't one click from home (owner: no spam); GitHub also needs a
    sign-in.
  - **Licenses** opens `public/licenses.txt`, bundled so it works offline:
    Tarn's license and everything Tarn ships (Lit, the Material icon, the
    fonts). Add an entry when a dependency, font or icon is added.
- **One icon rule for every row.** The icon's box is exactly as tall as a
  title plus one description line, so it sits centered beside one or two
  lines and stays top-left once a description wraps further (or a row holds
  a control under its title, like widget sizes). No per-row exceptions, no
  measuring in script. Controls on the right stay vertically centered.
  Hairlines start where the text does.
- Sub-pages open with an iOS-style bar: "‹ Settings" on the left, the
  page's name centered, search under it.
- **Corners are concentric.** A selected tile's ring sits 4px outside it,
  so a tile inside a 10px card has a 6px radius and its ring traces the
  card's corner. Change the card radius and the tile radius together.
- Clock tiles are square (16:10 on the Clock page), and their clock
  text is sized in container units, so a thumbnail is a true small copy at
  any panel width.
- Text is Google Sans Flex (bundled, see
  `src/styles/global.css`).

## Look

See `docs/design.md` for the panel's tokens and components. The short
version: light first with a dark twin; black-and-white filled icons in
24px tiles; one line per row with notes under the group; concentric
corners; Google Sans Flex; desktop proportions like macOS System
Settings.

## When to switch to tabs

If Tarn grows past about six sections, the home sections can become tabs at
the top. The pages underneath stay exactly the same, so nothing is rebuilt.
Until then the list wins: people don't have to guess which tab holds a
setting, and Advanced stays out of sight.

## Rejected

- **Tabs now:** people have to guess the tab, and four labels barely fit in
  a 330px panel.
- **"Developer" section:** the name scares off normal users. It's
  "Advanced".
- **A close button:** the side panel already has one.
- **"Tarn" in Chrome's header with the wordmark below it:** the name read
  twice. Chrome's header now says "Settings" instead.
- **The ta mark in the panel:** Chrome's header already shows it next to
  "Settings". The panel keeps just the wordmark.
- **The wordmark at the top:** it pushed search down and competed with
  Chrome's "Settings" header. It closes the page instead.
- **"Tarn Settings" as the short name:** 13 characters, over Chrome's
  limit of 12.
- **A clock on/off switch:** the clock is picked by face, and "None" is one
  of the faces.

## Your own photos

"Add Photo…" sits right under the search on Wallpapers. Picked images
(several at once is fine) are stored by `src/wallpapers/store.ts` in
IndexedDB on this computer only: the original untouched, a display copy
(WebP, at most 3840px) and a 480px thumbnail, plus the photo's mean color
and tone. A small index of colors and sizes is mirrored to localStorage
(`tarn.photos`) so first paint knows a photo's color without waiting.

- A photo is chosen through the same `scene` setting, as `photo:<uuid>`.
  Settings sync, photos don't: another computer without the photo shows
  the default scene.
- Adding selects the new photo. The badge on a photo's corner (on hover
  or keyboard focus) deletes it, with Undo; deleting the current photo
  goes back to the default scene.
- The background draws photos still, through the renderer, so they
  arrive, crossfade and ghost on reload like any scene.

## Files

- `src/settings/schema.ts`: types, defaults, normalizers, start setup.
- `src/settings/store.ts`: load, save (patches, serialized), watch,
  replace.
- `src/settings/migrate.ts`: `SETTINGS_VERSION` and migrations.
- `src/settings/backup.ts`: export/import, automatic backups.
- `src/settings/enabled.ts`: on/off (toolbar button, hand-off).
- `src/app/mirror.ts`: the first-paint mirror of settings.
- `src/panel/tarn-panel.ts`: the panel.
- `src/ui/glyphs.ts`: the panel's icons.
- `src/i18n/`: languages and catalogs.
