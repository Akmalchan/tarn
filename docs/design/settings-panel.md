# The settings panel

How Tarn's settings are organized, and the rules for adding to them. The
panel lives in the browser's side panel next to the new tab
(`src/panel/tarn-panel.ts`); every change applies to open tabs at once.

Decided with the owner on 2026-10-12, after comparing tabs against a list in
a live prototype: [Tarn Settings Panel](https://claude.ai/artifact/6mQoz7iAkLC3wiomqzW1Yn).

![The panel: home and Widgets in light, home and Advanced in dark](settings-panel-preview.png)

## The shape: a list that goes deeper

One scrolling list, like the system settings on a phone. The first screen
shows the few things most people change; each section ends in a row that
opens a page with the rest. There are no tabs and no close button (the
browser's side panel has its own).

```
Settings (home)
├── Search                         finds every setting, on any page
├── Background                     the first 4 scenes as thumbnails
│   └── All backgrounds ›          appears once there are more than 4
├── Clock                          faces: Classic, Bold, Minimal, None
├── Widgets ›                      on your tab (size, order, remove) + add
├── Tarn                           Use Tarn for new tabs
└── Advanced ›                     always last
    ├── Tab icon                   (Chromium only)
    ├── Keyboard                   the shortcuts that exist
    ├── Backup                     export, import, reset
    ├── settings.json              view and edit the raw settings
    └── About                      version, copy diagnostics
```

## Rules

1. **Home holds what most people change.** Today that's the background,
   the clock, widgets and turning Tarn on or off. Anything else goes one
   level down.
2. **Show a few, then "more".** A section shows up to four choices; the
   rest go behind a row that opens a page (`HOME_SCENES` in the panel). The
   first screen never grows just because the catalog does.
3. **Pictures, not names.** Scenes and clock faces are picked from
   thumbnails drawn on the user's real background.
4. **Advanced is last and is called Advanced.** Not "Developer": it holds
   the tab icon, keyboard, backup and the raw settings file, which normal
   people need sometimes too.
5. **Search finds everything.** Every setting has an entry in
   `SEARCH_INDEX` with the page it lives on. Picking a result opens that
   page and highlights the row. `/` focuses search; Escape clears it.
6. **Changes are live.** No Save button. Removing a widget or resetting
   shows a toast with Undo.
7. **Turning Tarn on or off only happens through its switch.** It goes
   through `setTarnEnabled`; import, reset and `settings.json` never change
   it.
8. **No fake features.** Nothing in the panel says "Soon". Add a row when
   the feature ships.

## Look

- **Light first, with a dark twin**, following `prefers-color-scheme`. A
  grouped list: grey page, white rounded groups, hairlines between rows
  inset past the icon.
- **Black and white.** Icon tiles are black with white glyphs (white with
  black in dark). Switches are black when on (white in dark). No brand hue,
  per `docs/brand/BRAND.md`.
- **Filled icons**, drawn for Tarn in `src/ui/glyphs.ts`: one solid shape
  with details cut out, readable at 17px in a 28px tile. Never outline
  icons, never emoji.
- **No title on the home page.** Chrome draws the side panel's header
  itself: the extension's icon and its manifest `short_name` (falling back
  to `name`), and nothing else can change it (no API, and `document.title`
  is ignored; see `SidePanelUtil::GetTitleText` in Chromium). That header
  already says "Tarn", so home opens straight on search. Sub-pages show
  "‹ Settings" and a 21px title.
- Rows are at least 46px tall; text is the system font.

## Adding a setting

1. Add it to `Settings` in `src/settings/schema.ts`, with a default and a
   normalizer branch (stored data is never trusted).
2. Pick its place with rule 1: home only if most people will change it.
   Otherwise it goes on an existing page, or in Advanced.
3. Give the row a filled glyph (add one to `glyphs.ts` if needed) and a
   `data-target` id.
4. Add a `SEARCH_INDEX` entry pointing at that page and id.
5. If it can be exported, make sure `replaceSettings` carries it.

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
- **The wordmark in the panel:** it sat right under Chrome's own "Tarn"
  header and read twice. A big "Settings" title had the same problem.
- **Renaming Chrome's header to "Settings"** through `short_name`: it would
  also rename Tarn in Chrome's side panel list and pin button, where a bare
  "Settings" looks like Chrome's own settings. "Tarn Settings" is over the
  12-character limit.
- **A clock on/off switch:** the clock is picked by face, and "None" is one
  of the faces.
