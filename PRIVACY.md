# Tarn Privacy Policy

_Last updated: 20 October 2026_

Tarn is a free new tab page, with its source code public, for Chrome, other Chromium
browsers and Firefox, made by [The Tarn Authors](AUTHORS). This policy
explains what Tarn does with your information. The short answer: almost
nothing, and never without you asking.

## In short

- **Tarn has no server.** No accounts, no analytics, no ads, no tracking,
  no crash reports. The Tarn Authors never receive any of your
  information.
- **Your setup stays in your browser.** Settings, photos, bookmarks and
  notes are saved by your browser, on your computer.
- **Tarn connects to the internet only when you use a feature that
  needs it:** searching, voice search, Google Lens, AI Mode and the
  Weather widget. Each is described below, and each can be turned off.
- **Nothing is sold or used for advertising,** or for anything other
  than the feature you used.

## What Tarn keeps, and where

| What                                                                     | Where it's kept                  | Leaves your computer?                                              |
| ------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------ |
| Settings (wallpaper, clock, widgets, search, language)                   | Your browser's extension storage | Only through your browser's own sync, if you've turned it on       |
| Your photos, if you add your own wallpaper                               | This computer                    | No                                                                 |
| Widget content (bookmarks, folders, icons you pick, notes, tasks, timer) | This computer                    | No                                                                 |
| Automatic backups (your last 3 setups, saved before each update)         | This computer                    | No                                                                 |
| The last weather forecast, so new tabs show it at once                   | This computer                    | No                                                                 |
| Your Google API key, if you add one for weather                          | This computer                    | Only to Google's Weather API; never synced, never in a backup file |
| Your own tab icon, if you pick one (Chromium)                            | This computer                    | No                                                                 |
| Other extensions Tarn switched off for you, to turn them back on         | This computer                    | No                                                                 |

Site icons for your bookmarks come from your browser's own icon cache;
Tarn doesn't contact the sites to get them.

**Removing Tarn deletes what it keeps on this computer.** Settings your
browser synced to your account can stay there: Firefox keeps an
extension's synced data on purpose, so a reinstall brings it back, and
Chrome may too. To remove them, clear your synced data in your browser's
sync settings. Extensions Tarn switched off for you stay off after Tarn
is removed; turn them back on in your browser's extensions page.

You can also export your setup to a file in Settings > Advanced > Backup;
that file goes only where you save it.

## When something leaves your computer

Only these features send anything, and only when you use them.

| When you…                                     | What's sent                                            | To                                                        |
| --------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Press Enter in the search box                 | What you typed                                         | Your browser's own search engine, as from the address bar |
| Press the microphone                          | Your voice, while it's listening                       | Your browser's speech service (in Chrome, Google)         |
| Drop, pick or paste an image into Google Lens | That image, or its link                                | Google Lens                                               |
| Open AI Mode                                  | Your question                                          | Google                                                    |
| Search for a place in a Weather widget        | What you type there                                    | Open-Meteo                                                |
| Have a Weather widget with a place chosen     | That place's coordinates, rounded to about a kilometer | Open-Meteo, or Google's Weather API if you choose it      |

A few details:

- **Suggestions** while you type come only from your own bookmarks, on
  this computer. Nothing you type is sent before you search.
- **Tarn never picks or changes your search engine.**
- **Voice** starts only when you press the button, and your browser asks
  for the microphone the first time.
- **Weather** asks for a forecast about once every 30 minutes per place,
  and only while a Tarn tab is visible; sooner to try again after a
  failed request, or right after you change its units or provider. "Use
  my location" asks your browser for your position once, with your
  permission, and keeps only the rounded coordinates.
- **Weather requests leave out cookies.** The weather service can tell a
  request came from Tarn (your browser names the extension that sent it)
  and, like any request on the internet, sees your IP address; Tarn adds
  nothing that identifies you. Your Google API key goes in a request
  header, not in the address. In Google Cloud, restrict the key to the
  Weather API.
- **The Google key stays on each computer.** Choosing Google syncs, the
  key doesn't: a computer without it gets weather from Open-Meteo.
- **Search, Lens and AI Mode open in your tab** like any link you follow,
  so the site sees you the same way it would if you'd gone there yourself.
- **Links** in Tarn (Privacy, Source code, Rate Tarn, Send feedback) open
  only when you click them. Send feedback opens a GitHub issue with
  Tarn's version and your browser filled in; nothing is sent unless you
  submit it there.

Once something reaches Google, Open-Meteo or your search engine, their
privacy policies apply:
[Google](https://policies.google.com/privacy),
[Open-Meteo](https://open-meteo.com/en/terms).

You can hide the search box or turn off voice, Lens and AI Mode in
Settings > Search. Removing every Weather widget stops all weather
requests.

## What Tarn never does

- Read the pages you visit or your browsing history.
- Change or send your bookmarks.
- Run code downloaded from the internet. Everything Tarn runs ships inside
  the extension, and its source is public.
- Show ads, sell data, or share it with anyone.

## Permissions

Your browser shows these when you install Tarn. Here is what each one is
for.

| Permission                      | Why Tarn needs it                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage                         | Save your settings and widget content.                                                                                                                                                                                                                                              |
| Side panel (Chromium)           | Show settings next to your tab.                                                                                                                                                                                                                                                     |
| Offscreen (Chromium)            | Keep a copy of your settings in the browser's local storage, up to date even with no Tarn tab open, so new tabs open instantly with your page. Nothing leaves the browser.                                                                                                          |
| Favicon (Chromium)              | Show site icons for your bookmarks and the tab. Your browser calls this "Read the icons of the websites you visit"; Tarn only reads icons for sites you've added.                                                                                                                   |
| Bookmarks                       | Show your browser's bookmarks bar in a Bookmarks widget, and suggest bookmarks as you type in the search box, on this computer. Tarn only reads them. Your browser calls this "Read and change your bookmarks" because it has no read-only version.                                 |
| Search                          | Send your searches to your browser's own search engine.                                                                                                                                                                                                                             |
| Management (optional, Chromium) | Asked for only if you ask Tarn to switch off another new-tab extension, and used only for that. Tarn lists the extensions that call themselves a new tab page and switches off only the ones you tick; any others stay hidden and unticked unless you choose "Show all extensions". |
| Geolocation (optional, Firefox) | Asked for only if you press "Use my location" in a Weather widget, and used only for that. In Chrome, the browser asks the way it asks a website, at that moment.                                                                                                                   |

## Chrome Web Store disclosure

Tarn's use of information received through browser and Google APIs
adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. Tarn uses that information only to
provide the features described above.

Because the store counts anything that leaves your computer, even at your
request, Tarn's listing discloses two kinds of data: **location** (a
Weather widget's rounded coordinates) and **website content** (an image
you give Google Lens). Neither reaches the Tarn Authors.

In Firefox, Tarn declares the same in Firefox's own data consent, plus
**search terms** (a question for AI Mode, and a place you search for in
a Weather widget), which Firefox shows when you install it.

## Children

Tarn is suitable for everyone and collects nothing from anyone, including
children under 13.

## Changes to this policy

If Tarn ever changes what it sends or stores, this page is updated first,
with a new date at the top, and the change is noted in the
[changelog](CHANGELOG.md). Any new feature that uses the internet is off
until you turn it on. Every version of this policy since Tarn 1.0.0 is in
the [project history](https://github.com/Akmalchan/tarn/commits/main/PRIVACY.md).

## Contact

Questions about privacy:
[open an issue](https://github.com/Akmalchan/tarn/issues). To report a
security problem privately, use
[GitHub's security advisory form](https://github.com/Akmalchan/tarn/security/advisories/new).
