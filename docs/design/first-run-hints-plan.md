# First-run hints (2026-10-14)

**Decided 2026-10-14: style A only, built** ("looks the coolest and Apple
style, all needed info there, and highlights the hidden settings
button"). Hint 2 (bookmarks bar) is not built. Code:
`src/app/first-run.ts`, `src/app/tarn-settings-button.ts`. Preview:
`first-run-hints-preview.png` (real new tab, headless Chrome, hints
injected).

## What happens today on install

- `onInstalled` with `reason: 'install'` does nothing visible
  (`src/entrypoints/background.ts`). No tab opens. The user sees Tarn the
  next time they open a new tab.
- The first new tab shows the start setup (Bookmarks, Notes "Welcome to
  Tarn", Weather, Timer) and Chrome's own "Keep this change?" bubble.
- **The one gap:** the only way into settings is a gear at 38% opacity in
  the bottom-right corner. Nothing tells a new user it's there, or that
  widgets move while settings are open.

## The tension

Promise 1 (`docs/design.md`) says no tips by default, and the research
quote is "too much tutorial, I noped almost instantly." So this has to be
an exception the owner signs off, kept as small as possible:

- **2 hints, ever.** Never on updates, never on a second computer that
  already has synced settings.
- **One at a time, one per new tab.** No tour, no overlay, no dimming.
- **Waits for the first mouse move**, so it never competes with Chrome's
  bubble or the arrival.
- **Retires itself:** done on its button, on doing the thing (opening
  settings), or after 3 tabs ignored.

## The hints

| #   | Where                           | Words (en)                                                                                                                            | When                                          |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Card above the gear, gear awake | **Make it yours.** Wallpapers, clock faces and widgets live here. While settings are open, drag widgets to move them. [Open settings] | First new tab after install                   |
| 2   | Small glass pill, top center    | Browser bookmarks bar gone? ⌘ + ⇧ + B brings it back on every tab. [Got it]                                                           | Chrome only, a later tab after hint 1 is done |

Styles rendered: A coach card (recommended), B white toast (too loud), C a
dot and a "Settings" label (quietest, says where but not what), D the
bookmarks pill.

## Optional: open a tab on install

`reason === 'install'` → open one new tab, so installing shows Tarn at
once instead of "nothing happened". Common, mildly pushy. Owner's call.

## As built

- **State:** `storage.local` key `tip.settings` (`{shown}`), set by the
  background on `install` only when no synced settings exist; removed
  when done. Per computer, never synced or exported. No settings field.
- **UI:** inside `<tarn-settings-button>`, which already knows when the
  panel opens. CSS blur like the gear's own hover, not shader glass.
  Opacity and transform only; nothing renders before the first mouse
  move or key.
- **Dev build:** `npm run dev` shows it on every new tab, for review.
- **Not built:** hint 2, "Show tips again", opening a tab on install.
