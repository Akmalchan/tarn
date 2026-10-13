# Privacy

Tarn collects nothing. It has no accounts, no analytics, no ads and no
tracking. It makes no network requests of its own, with one exception you
choose: the Weather widget (below).

## What stays in your browser

- **Settings** (background, clock, widgets, tab icon) are saved in your
  browser's extension storage. If you're signed in to your browser with sync
  turned on, your browser syncs them between your devices; Tarn never sees
  or sends them anywhere.
- **Your photos**, if you add your own wallpaper, are saved on this
  computer only, in the browser's storage for Tarn. They're never synced
  or uploaded.
- **Widget content** (your favorite sites, notes, timer) is saved on this
  computer only.
- **Site icons** for your favorites are read from your browser's own icon
  cache, without contacting the sites.

Removing Tarn removes all of it.

## Weather

Only if you add a Weather widget, or turn on weather beside the clock, and
choose a place:

- **City search:** what you type in the place search is sent to Open-Meteo
  (open-meteo.com) to find matching places, even if Google gives your
  forecasts.
- **Forecasts:** the chosen place's coordinates, rounded to about a
  kilometer, are sent to the weather provider: Open-Meteo by default, or
  Google's Weather API if you pick it in Settings > Advanced and add your
  own Google API key. Nothing else is sent: no account, no cookies, no
  page you visit. Like any request on the internet, the provider also sees
  your IP address; Tarn adds nothing that identifies you.
- **How often:** at most once every 30 minutes per place, only while a Tarn
  tab is visible. The last forecast is kept on this computer so new tabs
  show it at once.
- **Your location:** "Use my location" asks your browser for your position
  once, with your permission, and keeps only the rounded coordinates.
- **Your Google API key** stays on this computer: it's never synced, never
  included in a backup file, and only sent to Google's Weather API.

Open-Meteo's and Google's own privacy policies cover what they do with a
request. Removing the Weather widget stops all of it.

## Permissions

- **Storage:** to save your settings and widget content.
- **Side panel:** to show settings next to your tab.
- **Offscreen:** keeps a copy of your settings ready so new tabs open
  instantly. Nothing leaves the browser.
- **Favicon** (Chromium browsers): to show your browser's own new-tab icon
  in the tab and your favorites' icons. The browser describes this as "Read
  the icons of the websites you visit"; Tarn only reads icons for the tab and
  for sites you add.
- **Management** (optional, Chromium browsers): asked for only if you ask
  Tarn to switch off another new-tab extension, and used only for that.
- **Geolocation** (optional): asked for only if you press "Use my location"
  in a Weather widget, and used only for that.

## Links

The Privacy and Source code links in settings open GitHub in a new tab when
you click them. "Copy diagnostics" copies the version, browser and settings
to your clipboard, so you decide whether to share them.

## Questions

Open an issue at <https://github.com/Akmalchan/tarn/issues>.
