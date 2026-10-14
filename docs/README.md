# Tarn docs

Start here. Each doc owns one area completely: how it works, where the
code is, the full list of what exists, how to add to it, and what the
owner already decided or rejected. Read the doc for your area before
changing it, and update it in the same pull request as the change.

| Doc                                                                                | Read before you…                                                                                                                 |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)                                                 | …do anything: entrypoints, folders, arrival, data, permissions, network, languages, how sessions work together                   |
| [design.md](design.md)                                                             | …touch anything visible: principles, tokens, components, light and dark, words, how to show the owner designs, what was rejected |
| [brand/BRAND.md](brand/BRAND.md)                                                   | …touch the name, the wordmark, the `ta` mark, icons or store artwork                                                             |
| [wallpapers.md](wallpapers.md)                                                     | …change the background engine or add, change or remove a scene; the full scene library                                           |
| [clocks.md](clocks.md)                                                             | …change the clock or add a face; the full face library                                                                           |
| [widgets.md](widgets.md)                                                           | …change the board, the layout or any widget, or add a widget kind                                                                |
| [search.md](search.md)                                                             | …change the search box, its buttons or looks                                                                                     |
| [settings.md](settings.md)                                                         | …add or change a setting, the panel, storage, migrations or backups                                                              |
| [library.md](library.md)                                                           | …add anything that downloads designs, or change how ids are stored (the planned online library)                                  |
| [design/onboarding-plan.md](design/onboarding-plan.md)                             | …work on first-run, the bookmarks bar, or connecting a calendar                                                                  |
| [research/2026-10-new-tab-research.md](research/2026-10-new-tab-research.md)       | …add any feature: what people want and hate, and Tarn's five promises                                                            |
| [research/2026-10-new-tab-performance.md](research/2026-10-new-tab-performance.md) | …claim anything about speed or battery                                                                                           |

Outside `docs/`:

- `AGENTS.md` (also loaded as `CLAUDE.md`): the rules every change
  follows, in short.
- `README.md`: what Tarn is, for people.
- `CHANGELOG.md`: what changed, for people. Add a line with every
  user-visible change.
- `PRIVACY.md`: what Tarn stores and sends. Update it with any change to
  data or network.

## Keeping docs true

- A doc that disagrees with the code is a bug. Fix whichever is wrong.
- When the owner decides or rejects something, write it down in the
  area's doc with the date and, if useful, their words.
- Keep each fact in one place and link to it, instead of copying it.
- Plain sentences, no marketing. Tables for lists of things.
