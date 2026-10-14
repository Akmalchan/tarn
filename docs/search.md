# Search box

The search box under the clock, shaped and behaving like the browser's
own new-tab search box. All of it is `src/search/tarn-search.ts`; its
settings live in `src/settings/schema.ts` (`SearchSettings`) and on the
Search page of the settings panel (`src/panel/tarn-panel.ts`,
`renderSearch`).

Read this before changing the search box, its buttons, its looks or its
settings.

## What it does

| Part    | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                  | Network                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Enter   | Searches with the browser's **default engine** through `chrome.search.query` (Firefox: `browser.search.search`), in the same tab. Tarn never picks or changes the engine; Chrome's rules forbid that anyway.                                                                                                                                                                                                                              | Only the search itself          |
| Typing  | A dropdown: a typed address first ("Open site"), then up to 6 matching bookmarks (`bookmarks.search`, offline, with favicons from `/_favicon/`), then "Search the web", then AI Mode when it's on. Arrow keys, Enter and Escape work like Chrome's.                                                                                                                                                                                       | None                            |
| Mic     | Listens right in the box: the mic turns red and pulses, a voice line (4 bars from Web Audio levels) replaces the search icon, "Speak now", then the words as they're heard; when speech ends it searches. Press the red mic to finish, Escape to cancel. Errors (nothing heard, no microphone, failed) show in the box for 4 s. Uses the browser's speech recognition, which in Chrome is Google's (the same as google.com voice search). | Audio to Google while listening |
| Lens    | Opens a Google Lens box on the page ("Search any image with Google Lens"): drop, pick or paste an image, or paste an image link. Only then is the image sent: a form post to `lens.google.com/v3/upload` (field `encoded_image`), or `lens.google.com/uploadbyurl?url=` for a link; results open in the tab. These endpoints are what Google's own pages use and are undocumented; if Google changes them, this button needs a fix.       | The image, when given           |
| AI Mode | A pill like Chrome's "AI Mode" button; opens Google's AI Mode (`google.com/search?udm=50&q=`) with the question. One service on purpose (owner, 2026-10-14). Off by default: no AI unless switched on.                                                                                                                                                                                                                                    | Opens the site                  |

No web suggestions while typing: they would send every keystroke to a
search company.

## Looks

`settings.search.style`, on the Search page as **Look**:

- **Auto** (default): follows the computer's light or dark mode, exactly
  like Chrome's own box (white `#fff` with a soft shadow, or `#303134`).
- **Light** / **Dark**: fixed.
- **Glass**: frosted like the widgets. When there are widgets, the box's
  rectangle is added to the scene's frosted shapes (`searchGlassRect` in
  `src/app/tarn-app.ts`, sent with the board's tile report; the board's
  `refresh()` re-sends when the look changes), so it costs nothing extra.
  With no widgets it uses CSS blur (`glass="css"`). Open, it turns solid
  so the dropdown reads.

Size and place: 46 px tall, radius 23; 616 px wide (four widget columns)
so its edges line up with the tiles, 296 px when the page has 2 columns
(under 664 px wide). 32 px under the clock, 40 px above the widgets
(`tarn-app.ts`). Dropdown rows are 34 px, icons and text lined up with
the box's own.

## Settings

`SearchSettings` (`schema.ts`, normalized by `normalizeSearch`, mirrored
for first paint by `app/mirror.ts`):

| Field   | Values                                                                                  | Default |
| ------- | --------------------------------------------------------------------------------------- | ------- |
| `show`  | boolean                                                                                 | `true`  |
| `style` | `auto` `light` `dark` `glass`                                                           | `auto`  |
| `voice` | boolean                                                                                 | `true`  |
| `lens`  | boolean                                                                                 | `true`  |
| `ai`    | `off` `google` (`chatgpt` `claude` `perplexity` are accepted for later but not offered) | `off`   |

The Search page has no search field of its own (owner: a search field
for the search box was silly). Rows: Search box Show/Hide, Look, then
Voice, Google Lens and AI Mode On/Off, with a note on what each sends.

## Permissions

- `search` (required): the default-engine search.
- `bookmarks` (required, for the Bookmarks widget too): bookmark
  suggestions.
- The microphone: Chrome asks the first time the mic is pressed.

## Owner decisions

- Look like the browser's own box (2026-10-14: "make it as similar as
  possible"); the first glass design "looks terrible".
- Lens opens on the page, not in a new site.
- The voice screen as a full-screen overlay was rejected ("I don't want
  a whole screen being closed"); listening stays in the box.
- No choosing an AI service for now.
- Rows slim like Google's; the last row must stay inside the rounded
  corner (`overflow: hidden` on the list).

## Files

- `src/search/tarn-search.ts`: the element, dropdown, voice, Lens box.
- `src/app/tarn-app.ts`: placement, margins, glass rectangle.
- `src/panel/tarn-panel.ts`: `renderSearch`, `STYLE_NAMES`, the home row.
- `src/settings/schema.ts`: `SearchSettings`, `SEARCH_STYLES`,
  `SEARCH_AIS`, `normalizeSearch`.
- `src/i18n/messages/*.ts`: `search.*` and `panel.search.*`.
