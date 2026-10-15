# Publishing

How Tarn gets to the Chrome Web Store: the one-time developer account,
what each upload needs, and every field of the listing, ready to paste.
Read this before changing the store title or description, the permissions,
or anything the listing promises. Store artwork rules live in
[brand/BRAND.md](brand/BRAND.md#store-and-marketing); what Tarn stores and
sends lives in [PRIVACY.md](../PRIVACY.md). If either changes, update the
matching answer here in the same pull request.

## Developer account (once)

Chrome Web Store developer dashboard > Settings. Decided with the owner on
2026-10-14.

| Field                  | Answer                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publisher display name | **Tarn Labs** (owner, 2026-10-14; shown as "Tarn: Modern New Tab · Tarn Labs"). Rejected: "Icarus Labs" (taken; a falling myth), "Adeptus Administratum" (Games Workshop trademark)             |
| Contact email          | An address the owner reads; it is public on the listing and must be verified before publishing                                                                                                  |
| Trader status          | **Non-trader** (owner, 2026-10-14). Tarn is free and sells nothing, so no address or phone goes public. Switch to trader before Tarn+ or anything else takes money; then both must be published |
| Address                | Only required for traders; leave it                                                                                                                                                             |
| Trusted testers        | Optional: Google accounts that can install a draft before it is public                                                                                                                          |
| Service account        | Not needed (it is for publishing by API)                                                                                                                                                        |

## Each upload

1. Bump `version` in `package.json` (Chrome refuses an upload whose version
   isn't higher than the published one). Move the `[Unreleased]` CHANGELOG
   section under that version, and add the release's notes at the top of
   `RELEASES` in `src/panel/about.ts` (Settings > Advanced > What's new):
   the three to five changes people would notice, each a `whatsNew.v<x_y_z>.*`
   key in all 10 catalogs. `about.test.ts` fails until they're there.
2. `npm run check`, then `npm run zip` → `dist/tarn-<version>-chrome.zip`.
3. Try the zip in a clean Chrome profile: load the unzipped folder,
   open a new tab, open settings, add a Weather widget, turn Tarn off and on.
4. Dashboard > Tarn > Package > Upload new package, then Submit for review.
   Review takes about 1 to 3 days; a new permission or a big description
   change can take longer.

## Store listing tab

**Title and summary come from the manifest** (`public/_locales/*/messages.json`,
`extName` and `extDescription`), so each of the 10 languages gets its own
store title and summary automatically. The rest is typed into the dashboard.

| Field            | Value                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| Title            | **Tarn: Modern New Tab** (owner, 2026-10-14; translated after the colon)                |
| Summary          | "A still, clear start to every tab." (132 characters at most)                           |
| Category         | Make Chrome Yours > Functionality & UI                                                  |
| Language         | English (the other 9 come from `_locales`)                                              |
| Store icon       | `docs/brand/assets/png/store/tarn-store-icon-128.png`                                   |
| Screenshots      | `docs/brand/assets/png/store/screenshot-1…5-*.png` (1280 × 800, upload in number order) |
| Small promo tile | `docs/brand/assets/png/store/promo-small-440.png` (440 × 280)                           |
| Marquee promo    | `docs/brand/assets/png/store/promo-marquee-1400.png` (1400 × 560)                       |
| Official URL     | None (needs a verified domain; add one when Tarn has a website)                         |
| Homepage URL     | https://github.com/Akmalchan/tarn                                                       |
| Support URL      | https://github.com/Akmalchan/tarn/issues                                                |
| Mature content   | No                                                                                      |

Title rules: no Google trademark in it ("Chrome" belongs in the
description only, see BRAND.md), and no keyword lists; Google rejects
both. Rejected for the title on 2026-10-14: "Calm New Tab" (the owner:
something more general), and the search-word versions ("Live Wallpaper
New Tab", "Living New Tab", "New Tab, Still Water", "Quiet New Tab").

### Description

Paste as is: the store shows plain text and keeps the line breaks.

```text
Tarn turns every new tab into a calm, living page: a slow, hand-made
background that moves like still water, a clock, a search box, and the
few things you open every day. Nothing else. No accounts, no ads, no
tracking.

LIVING BACKGROUNDS
• Twelve original scenes drawn on your graphics chip: Tarn, Ember, Bloom,
  Wave, Aurora, Silk, Sakura, Comet, Koi, Window, Lumen and Contour.
• Or your own photos.
• Light on your computer: it pauses when the tab is hidden, slows down
  when you're away, and holds a still frame if you prefer reduced motion.

CLOCK AND SEARCH
• Thirteen clock faces, from Classic to Flip, LCD, Neon and Analog, or no
  clock at all.
• A search box shaped like your browser's own. It searches with your
  browser's search engine and suggests your bookmarks. Voice, Google Lens
  and AI Mode are one switch each.

WIDGETS
• Bookmarks (starts with your bookmarks bar), notes, tasks, a calendar, a
  timer and weather, on a tidy grid you arrange yourself.
• Custom widgets: draw your own with a few lines of shader code, with a
  live preview and examples. Shadertoy code works as is.
• Keyboard shortcuts: Ctrl+K or / to search, Alt + 1-9 to open a bookmark.

YOURS
• Ten languages: English, Español, Português (Brasil), Français, Deutsch,
  Русский, 日本語, 简体中文, 한국어, Türkçe.
• Settings sync through your browser's own account, if you use one.
  Automatic backups before every update, plus export and import.
• One click on the toolbar button turns Tarn off and gives you your
  browser's page back. If another new-tab extension is in the way, Tarn
  can switch it off for you.

PRIVATE BY DESIGN
Tarn has no server, no account and no tracking. It goes online only when
you use something that needs it: searches go to your browser's own search
engine when you press Enter; voice, Google Lens and AI Mode go to Google
only when you press them; and a Weather widget asks Open-Meteo for its
place's forecast, at most every 30 minutes.

The source code is public: https://github.com/Akmalchan/tarn

Works with Google Chrome™, Microsoft Edge, Brave, Arc, Opera, Vivaldi and
Firefox.
```

## Privacy practices tab

### Single purpose

```text
Tarn replaces the new tab page with a calm page: a living background, a
clock, a search box and widgets the user chooses (bookmarks, notes,
tasks, calendar, timer, weather).
```

### Permission justifications

| Permission               | Justification (paste)                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                | Saves the user's settings and widget content (notes, tasks, bookmarks, photos) in the browser.                                                                                 |
| `offscreen`              | Keeps a copy of the settings ready in the browser so a new tab shows the user's page on its very first frame. Nothing leaves the browser.                                      |
| `sidePanel`              | Tarn's settings open in the side panel, next to the new tab, so changes show live.                                                                                             |
| `favicon`                | Shows the browser's own new-tab icon in the tab and the icons of sites the user adds to the Bookmarks widget, read from the browser's icon cache without contacting the sites. |
| `bookmarks`              | The Bookmarks widget starts with the user's bookmarks bar, folders included, and the search box suggests bookmarks. Tarn only reads bookmarks; it never changes or sends them. |
| `search`                 | The search box sends what the user typed to the browser's own default search engine when they press Enter. Tarn never picks or changes the engine.                             |
| `management` (optional)  | Asked for only when the user asks Tarn to switch off another new-tab extension that is taking over their new tab, and used only for that.                                      |
| `geolocation` (optional) | Asked for only when the user presses "Use my location" in a Weather widget; the position is rounded to about 1 km and used only for that widget's forecast.                    |
| Remote code              | **No, I am not using remote code.** All code ships in the package; Tarn never runs downloaded JavaScript or WebAssembly (see `library.md`).                                    |

### Data usage

The store counts data as "collected" when it leaves the device, even at
the user's request. Tick:

- **Location**: the Weather widget sends a place's coordinates, rounded to
  about 1 km, to Open-Meteo (or Google, with the user's own key).
- **Website content**: Google Lens receives an image only when the user
  drops, picks or pastes one into the Lens box.

Leave everything else unticked: Tarn has no accounts, analytics or
tracking, and searches and voice go through the browser itself. Then
certify all three statements (not sold, not used for unrelated purposes,
not used for creditworthiness or lending).

Privacy policy URL: https://github.com/Akmalchan/tarn/blob/main/PRIVACY.md

## Distribution tab

- Payments: free. Visibility: **Public**. Regions: all.
- To stage a first look, publish as **Unlisted** (only people with the link
  can find it), or set trusted testers and keep it private.

## Later

- Firefox Add-ons (`npm run zip:firefox`): needs its own listing and a
  source-code upload, since the build is bundled.
- Edge Add-ons takes the same Chrome zip.
- Add the store link to the README once the listing is live.
