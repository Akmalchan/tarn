<p align="center">
  <img src="public/icon/128.png" width="72" height="72" alt="" />
</p>

<h1 align="center">Tarn</h1>

<p align="center"><b>A still, clear start to every tab.</b></p>

<p align="center">
  A source-available new tab page with living, GPU-rendered backgrounds.<br />
  Calm by default. No accounts, no tracking, no network calls unless you
  add the Weather widget.
</p>

---

> _tarn_ (n.): a small, still mountain lake.

## Features

- **Living backgrounds.** Twelve hand-written WebGL2 shaders: Tarn,
  Ember, Bloom, Wave, Aurora, Silk, Sakura, Comet, Koi, Window, Lumen and
  Contour. Hover one in settings to watch it move, with a gauge for how
  much it asks of your computer. Or use your own photos.
- **Clock faces.** Thirteen of them, from Classic to Flip, LCD, Neon,
  Analog and two gothic ones, or no clock at all.
- **Light on your machine.** Renders off the main thread at reduced
  resolution, caps at 30fps, stops completely when the tab is hidden, and
  holds a still frame if you prefer reduced motion.
- **Every browser.** One codebase for Chrome, Edge, Brave, Arc, Opera,
  Vivaldi and Firefox.
- **Ten languages.** English, Spanish, Portuguese (Brazil), French, German,
  Russian, Japanese, Chinese (Simplified), Korean and Turkish, following
  your browser or chosen in settings.
- **One-click switch.** Tarn's toolbar button turns it on or off. If another
  new-tab extension (like Momentum) is in the way, Tarn can switch it off
  for you, and back on when you turn Tarn off.
- **Widgets.** Bookmarks (your browser's bookmarks bar from the first
  tab, then folders and your own icons), notes, tasks, a calendar, a
  timer and weather, on a calm grid you arrange while settings is open.
  Example setups show what a page can look like. Custom widgets: draw
  your own with a few lines of shader code, from live examples or with
  instructions to paste into an AI chat.
- **Search box.** Under the clock, shaped like your browser's own: Enter
  searches with your browser's search engine, typed addresses and your
  bookmarks come up as you type, and voice, Google Lens and AI Mode are
  one switch each in settings. Light, dark, glass, or following your
  computer; or hidden.
- **Private.** Nothing leaves your browser. Settings sync through your
  browser's own account, if you use one. The one exception is the Weather
  widget, and only once you add it and choose a place: it asks Open-Meteo
  (free, no account), or Google with your own API key, for that place's
  forecast, at most every 30 minutes. The search box sends nothing until
  you search. See [PRIVACY.md](PRIVACY.md).

## Install from source

```bash
npm install
npm run build            # Chromium browsers → dist/chrome-mv3
npm run build:firefox    # Firefox → dist/firefox-mv3
```

- **Chrome / Edge / Brave / Arc:** open `chrome://extensions`, enable
  _Developer mode_, click _Load unpacked_, pick `dist/chrome-mv3`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click _Load
  Temporary Add-on_, pick any file in `dist/firefox-mv3`.

## Develop

```bash
npm run dev          # dev server with live reload
npm run check        # typecheck, lint, test and build
```

The first time, load `dist/chrome-mv3-dev` as an unpacked extension
(same steps as above). After that, it reloads on every save. Google Chrome
no longer lets tools sideload extensions automatically, so this one step is
manual.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

## Documentation

Everything about how Tarn works, area by area (the background engine and
every scene, every clock face, every widget, the search box, settings,
design, and the planned online library) starts at
[docs/README.md](docs/README.md). AI agents: read [AGENTS.md](AGENTS.md)
first.

## Product research

What users love and hate about new tab pages, and what that means for Tarn:
[docs/research/2026-10-new-tab-research.md](docs/research/2026-10-new-tab-research.md).

How heavy Tarn is next to Chrome's new tab and 7 popular extensions,
measured: [docs/research/2026-10-new-tab-performance.md](docs/research/2026-10-new-tab-performance.md).

## License

[PolyForm Shield License 1.0.0](LICENSE). Use it, read it, fork it and
contribute freely; just don't ship a competing product from it. Code
published before 14 October 2026 remains under
[Apache 2.0](https://github.com/Akmalchan/tarn/blob/d0dbe7a/LICENSE).
