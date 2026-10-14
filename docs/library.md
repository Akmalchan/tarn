# The online library (planned)

A future place to get more wallpapers, clock designs and widget setups
than the ones built into Tarn. Nothing here is built yet. This doc sets
the rules now, so that when the library ships nobody's setup breaks,
whatever version of Tarn each of their computers runs.

Read this before adding anything that downloads designs, before
changing how settings store a wallpaper, clock or widget, and before
renaming any id.

## The promise

People keep everything they have, always:

- A Tarn that doesn't know a library item keeps it untouched, shows a
  calm fallback, and never overwrites it. Another computer, or a later
  version, still has it.
- Nothing is downloaded until someone opens the library and picks
  something. After that it works offline.
- Removing the library, or going back to an older version, loses
  nothing: the setup comes back when a version that knows the item
  returns.

The first point already holds today and is pinned by tests
(`src/settings/protection.test.ts`, "library items from a later Tarn
survive this one").

## How Tarn already protects a setup

These rules live in `src/settings/` (see AGENTS.md, "Never lose a
setup") and are what the library builds on:

1. **Saves are patches.** `saveSettings` rewrites only the fields a
   change touches. A value this version doesn't understand (a scene,
   a clock, a widget kind, a whole new field) stays as it was.
2. **Reading is forgiving.** `normalizeSettings` turns anything stored
   into valid settings for display: an unknown scene shows the default
   scene, an unknown clock the default clock, an unknown widget is
   skipped. The stored value is not changed by reading.
3. **Widgets keep their place.** A widget this version can't draw keeps
   its position next to the widget it followed, and its unknown fields.
4. **Content is separate.** A widget's content lives in `storage.local`
   under `widget.<id>`, apart from the synced settings. Removing a widget
   keeps its content. Backups include every `widget.*` key, known kind
   or not.
5. **Versions only go up.** `SETTINGS_VERSION` and `migrate.ts` move old
   shapes forward; a version never writes a lower number than it read.
6. **Backups are automatic.** Each update saves the setup first (last 3
   kept), and Export/Import carry settings plus widget content.

## Ids

Every wallpaper, clock and widget kind has an id, and ids are forever:
never rename or reuse one. Three namespaces:

| Namespace | Example                     | What it is                              | Where it lives                                 |
| --------- | --------------------------- | --------------------------------------- | ---------------------------------------------- |
| plain     | `tarn`, `neon`, `notes`     | Built into Tarn, ships in the extension | the code                                       |
| `photo:`  | `photo:3f2c9a1e-…`          | A user's own picture                    | IndexedDB on this computer (`src/wallpapers/`) |
| `lib:`    | `lib:northlight/aurora-pro` | A library item                          | IndexedDB on this computer, re-downloadable    |

Library ids are `lib:<publisher>/<item>`, lowercase letters, digits and
hyphens. Widget entry ids stay `^[a-z0-9-]{1,40}$` (`WIDGET_ID`), for
example `lib-stocks-1`; it's the widget _kind_ that is `lib:stocks`.

A removed built-in maps to its nearest replacement instead of vanishing
(`REPLACED_SCENES` in `settings/schema.ts`); do the same for library
items that get withdrawn.

## What the library can carry

Chrome Web Store policy forbids running downloaded code (JavaScript or
WebAssembly) in Manifest V3 extensions. So the library carries data,
never code:

| Kind       | From the library                                                                                                                   | Still ships in updates                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Wallpapers | Photos and videos (like the user's own photos), and **presets** for built-in scenes: colors, speed, moment                         | New shader scenes. Treat GLSL as code: a new scene is an extension update.                             |
| Clocks     | **Designs** built from a fixed vocabulary: font (from the library, OFL or original only), weight, color, glow, outline, date style | New kinds of rendering (flip cards, analog hands, segments)                                            |
| Widgets    | **Setups** and content: a bookmarks pack, a notes template, a ready-made page (like Example setups)                                | New widget kinds (code). A `lib:` widget kind can only point at a kind the extension already contains. |

## Storage

- **Synced settings hold ids only**, never files: sync has an 8 KB per
  item quota and must stay small.
- **Files** (images, video, fonts, preset JSON) go to IndexedDB on each
  computer, the same way photos do (`src/wallpapers/store.ts`), with a
  small index mirrored in localStorage so first paint knows the base
  color and tone at once.
- **Another computer** that syncs a `lib:` id it doesn't have shows the
  fallback, and offers to download it the next time the user opens
  settings. It never downloads on its own.
- **Backups** include the ids (in settings). Files are re-downloaded by
  id; an "include library files" option can come later, like photos.

## The catalog

A static, signed catalog served from a CDN (no account, no tracking):

```json
{
  "format": "tarn-library",
  "version": 1,
  "items": [
    {
      "id": "lib:northlight/aurora-pro",
      "kind": "wallpaper",
      "type": "preset",
      "base": "aurora",
      "title": {"en": "Aurora Pro", "de": "Aurora Pro"},
      "author": "Northlight",
      "license": "CC0-1.0",
      "minTarn": "1.4.0",
      "files": [{"path": "aurora-pro.json", "sha256": "…", "bytes": 812}],
      "preview": "aurora-pro.webp"
    }
  ]
}
```

- `minTarn`: an older Tarn hides items it can't show, instead of
  failing.
- `sha256` on every file; a file that doesn't match is dropped.
- Titles in Tarn's languages, falling back to English.
- Only original, CC0 or OFL work, with the author credited in the item
  (owner rule: only Google or truly free assets).

## Network

The library is a network feature, so it follows the Network rule in
AGENTS.md: off until the user opens it, explained in README and
PRIVACY.md before it ships, and owner-approved. Browsing fetches only
the catalog and previews; picking an item downloads its files once.
Requests carry no cookies, no referrer and nothing about the user.

## Before shipping the library

1. Owner approval for the network feature, documented in AGENTS.md,
   README.md and PRIVACY.md.
2. Accept `lib:` ids at display time (scene, clock, widget kind) with
   the same fallback as a missing photo: `sceneById`, first paint
   (`rememberedScene`, base color), clock face, and widget rendering.
   Keep `lib:` out of the built-in type unions (`ClockStyle`,
   `FACE_NAMES` and the like) and add a separate library type.
3. IndexedDB store for library files, modeled on `src/wallpapers/`.
4. Catalog fetch, verify, cache; the settings UI to browse, preview,
   install and remove.
5. Extend the protection tests for every new stored field.
6. Update this doc, the area docs (wallpapers, clocks, widgets) and
   CHANGELOG.
