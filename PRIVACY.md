# Tarn Privacy Policy

_Last updated: 14 October 2026_

Tarn is a free, open-source new tab page for Chrome, other Chromium
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

Site icons for your bookmarks come from your browser's own icon cache;
Tarn doesn't contact the sites to get them.

**Removing Tarn deletes all of it.** You can also export your setup to a
file in Settings > Advanced > Backup; that file goes only where you save
it.

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
- **Weather** asks for a forecast at most once every 30 minutes per place,
  and only while a Tarn tab is visible. "Use my location" asks your
  browser for your position once, with your permission, and keeps only the
  rounded coordinates.
- **Weather requests leave out cookies and the page they came from.** Like
  any request on the internet, the weather service sees your IP address;
  Tarn adds nothing that identifies you.
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

| Permission                      | Why Tarn needs it                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage                         | Save your settings and widget content.                                                                                                                                       |
| Side panel                      | Show settings next to your tab.                                                                                                                                              |
| Offscreen (Chromium)            | Keep a copy of your settings ready so new tabs open instantly. Nothing leaves the browser.                                                                                   |
| Favicon (Chromium)              | Show site icons for your bookmarks and the tab. Your browser calls this "Read the icons of the websites you visit"; Tarn only reads icons for sites you've added.            |
| Bookmarks                       | Show your browser's bookmarks bar in a Bookmarks widget. Tarn only reads them. Your browser calls this "Read and change your bookmarks" because it has no read-only version. |
| Search                          | Send your searches to your browser's own search engine.                                                                                                                      |
| Management (optional, Chromium) | Asked for only if you ask Tarn to switch off another new-tab extension, and used only for that.                                                                              |
| Geolocation (optional)          | Asked for only if you press "Use my location" in a Weather widget, and used only for that.                                                                                   |

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

## Children

Tarn is suitable for everyone and collects nothing from anyone, including
children under 13.

## Changes to this policy

If Tarn ever changes what it sends or stores, this page is updated first,
with a new date at the top, and the change is noted in the
[changelog](CHANGELOG.md). Any new feature that uses the internet is off
until you turn it on. Every past version of this policy is in the
[project history](https://github.com/Akmalchan/tarn/commits/main/PRIVACY.md).

## Contact

Questions about privacy:
[open an issue](https://github.com/Akmalchan/tarn/issues). To report a
security problem privately, use
[GitHub's security advisory form](https://github.com/Akmalchan/tarn/security/advisories/new).
