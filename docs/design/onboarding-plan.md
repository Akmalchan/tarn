# Onboarding plan (deferred)

Decisions and proposals the owner set aside on 2026-10-13 for the
onboarding phase. Nothing here is built yet; read it before starting
first-run work.

## 1. Bookmarks in Favorites on the first new tab

- Chrome never shows an extension the user's bookmarks without the
  `bookmarks` permission. There is no other route (no API, no file the
  page can read).
- **Optional** (today): Tarn asks with a prompt when the user presses "Use
  my bookmarks" (`src/widgets/bookmarks.ts`), copies the bookmarks bar
  once and gives the permission back.
- **Required** (proposed): the permission goes in the manifest. The install
  dialog gains one line, "Read and change your bookmarks", and Tarn never
  prompts: the first new tab already shows the user's own bookmarks bar in
  Favorites, live. An unpacked zip shows no warning at all.
- **Decide before the Chrome Web Store launch.** Adding a required
  permission later disables Tarn for existing users until they approve it.
- **Decided 2026-10-14: required.** Built: a Bookmarks widget without
  content of its own shows the bar, live, until the user changes it.

## 2. A live bookmarks bar

- Chrome shows its bookmarks bar only on its own new tab by default, so it
  disappears on any extension's new tab (Tarn, Momentum, Bonjourr), and no
  extension can turn it back on. Workaround today: Cmd/Ctrl+Shift+B,
  "Always show bookmarks bar".
- Proposal: a slim Tarn bar across the top that mirrors Chrome's bar live
  (`bookmarks.onChanged`), with site icons and folders as dropdowns. A
  switch in settings, off by default; it keeps the permission while on.

## 3. Connecting a calendar

The second network feature after weather: it needs the owner's approval
under the Network rule in `AGENTS.md`.

- **v1, a private calendar link:** a "Connect calendar" button on the
  calendar widget in edit mode. The user picks Google, Outlook or Apple,
  follows three short steps to copy the private iCal link, and pastes it;
  the browser asks once for access to that site (optional host
  permission). The link is a secret: `storage.local` only, never synced or
  exported. Refreshed at most every 30 minutes while a tab is visible,
  cached for first paint. Events show as dots, the next one on the small
  tile, the week's on the medium, a clicked day's on the large.
- **v2, "Sign in with Google":** one click via `chrome.identity`, at Web
  Store time. Reading calendars is a sensitive scope: Google must verify
  the app first (privacy policy, demo video, a few weeks), and until then
  it is capped at 100 test users behind an "unverified app" warning.
  `getAuthToken` works in Chrome only.
