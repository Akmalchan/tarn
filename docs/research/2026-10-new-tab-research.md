# What people want from a new tab page (research, October 2026)

Why this exists: Tarn should be built on what real users ask for and
complain about, not on guesses. Re-read this before adding any feature.

**Method.** Hacker News threads (via the Algolia API), GitHub issue trackers
sorted by reactions (Tabliss, Bonjourr, nightTab, Mue, daily.dev), Chrome Web
Store and Firefox Add-ons reviews, and tech press. Mostly 2024–2026; older
sources are marked.

**Gaps.**

- Reddit could not be read.
- No public data on which widgets people actually use; usage is inferred from
  requests, votes and reviews.
- No published battery or CPU measurements for animated new tabs.

## What people hate (most frequent first)

1. **Unwanted content pushed onto the page:** sponsored tiles, news feeds,
   shopping, animated Doodles.
   - Firefox re-enabled sponsored tiles users had turned off
     ([HN, 2024](https://news.ycombinator.com/item?id=41497051)).
   - Firefox tested a shopping feed on the new tab
     ([HN, 2024](https://news.ycombinator.com/item?id=42191110)).
   - Edge pushes its MSN feed
     ([Windows Latest, 2025](https://windowslatest.com/2025/06/18/microsoft-edge-tests-ai-overhauled-msn-feed-with-ads-but-you-can-turn-it-off)).
   - Brave shows sponsored images on every 4th tab
     ([Brave community](https://community.brave.app/t/brave-origin-should-not-have-new-tab-page-ads/652466)).
   - Google's animated Doodle is called distracting
     ([HN, 2026](https://news.ycombinator.com/item?id=48587539)).
2. **Losing links and settings after an update or restart.** This is the top
   trust-killer.
   - The most-upvoted Tabliss issue is "resets to default settings"
     ([#268](https://github.com/joelshepherd/tabliss/issues/268), 104 thumbs
     up).
   - Bonjourr "links disappeared after 20.1.1" (#458, 2024); its reviews say
     "every update loses all your favorites".
   - Momentum reviews: "the extension set itself back without reason" (2026).
   - nightTab: settings reset after restart (#488, 2026).
3. **Distraction.** Many people open a tab only to type.
   - "Backgrounds, sounds, weather, news – that's all junk/noise to me"
     ([HN, 2024](https://news.ycombinator.com/item?id=42237258)).
   - A blank-page extension has 100K users
     ([Empty New Tab Page](https://chromewebstore.google.com/detail/empty-new-tab-page/dpjamkmjmigaoobjbekmfgabipmfilij)).
4. **Paywalls, upsells and required accounts.**
   - Momentum: "monthly subscription for an html page", "they want you to
     create an account … why?"
     ([AMO 1-star reviews](https://addons.mozilla.org/en-US/firefox/addon/momentumdash/reviews/?score=1)).
   - Toby's capped free tier; start.me's ads.
5. **Slow loads and the white flash.**
   - nightTab "flash of white when opening a new tab", still open
     ([#443](https://github.com/zombieFox/nightTab/issues/443)).
   - Anori, the same complaint
     ([HN, 2024](https://news.ycombinator.com/item?id=40084543)).
6. **Things that can't be turned off.** Removal guides for Chrome's AI Mode,
   Ask AI and Create image buttons say a hidden `chrome://flags` switch is the
   only reliable fix
   ([piunikaweb, 2026](https://piunikaweb.com/2026/09/28/how-to-remove-chrome-ai-mode-create-image-buttons/)).
   Chrome's removed most-visited tiles keep coming back.
7. **Ignoring the user's own search engine.** "Let me use the search engine I
   configured instead of shoving Google down my throat."
   - Tabliss reviews.
   - Mue #1152 (2026).
8. **No focus control.** Users want to start typing immediately. Chrome
   deliberately keeps focus in the address bar on extension new tabs
   ([nightTab #479](https://github.com/zombieFox/nightTab/issues/479)).
9. **Abandonment and broken integrations.**
   - Tabliss: "not maintained anymore", "wallpapers frequently just aren't
     loaded" (2024–2026).
   - Bonjourr: weather and backgrounds breaking (#784, #794, 2026).
   - Anything that depends on a third-party network service eventually rots.
10. **Privacy and permission creep.**
    - Broad "read and change all your data" permissions.
    - Weather widgets sending location.
    - Extensions sold and turned malicious.
    - Humble New Tab is praised because it "doesn't require ungodly
      permissions"
      ([reviews, 2025](https://chromewebstore.google.com/detail/humble-new-tab-page/mfgdmpfihlmdekaclngibpjhdebndhdj/reviews)).

Runner-up: extensions taking over the new tab when that isn't their main job
([daily.dev #216](https://github.com/dailydotdev/daily/issues/216), 2020).

## What people want

1. **Hand-picked quick links, not auto "most visited".** This is the most
   consistent request across every source.
   - Humble New Tab is loved for its bookmark columns.
   - Vivaldi's Speed Dial is praised as "a UI for whatever bookmark folder you
     select".
2. **Instant first paint, no flash, in the right light or dark color.**
3. **A real "nothing" mode:** background and clock only, no logo, no search box.
4. **Backup, export and sync without an account.**
   - Tabliss backup #257.
   - nightTab export #163.
   - Bonjourr Gist sync #789.
   - Mue sync #1146.
5. **The browser's own search engine, or no search box at all.**
6. **Custom CSS and custom HTML widgets** for power users (Bonjourr #634,
   #780).
7. **Keyboard access:** shortcuts for links, number keys, focus control
   (Bonjourr #262, #768).
8. **Follow the system's light and dark theme.**
9. **Most-requested new widgets:** calendar, RSS, to-do (Bonjourr #529, #647;
   Tabliss #19).
10. **Works offline:** cached link icons, nothing broken without a network
    (Bonjourr #417, #924).

Also requested:

- Drag-and-drop, resizable widgets.
- A lock against accidental edits (Bonjourr #903).
- Short onboarding: "too much tutorial, I noped almost instantly."

## Which widgets matter (inferred)

- **Used daily:**
  - Quick links.
  - Clock and date.
  - Search, but only with the user's engine.
  - To-do and focus timer.
  - The background itself, the main source of praise (Bonjourr: 400K users,
    4.9 stars).
- **Mixed:**
  - Weather: often requested, but it breaks most often and raises location
    privacy questions.
  - Greetings.
- **Ignored or disliked:**
  - News and feeds: "if I put Reddit and HN on my home tab I would never get
    anything done"
    ([HN, 2022](https://news.ycombinator.com/item?id=33351585), older).
  - Quotes ([jon.bo, 2024](https://jon.bo/posts/new-tab/)).
  - Most-visited thumbnails.
  - Anything sponsored.

## What makes people uninstall

1. Data or settings lost after an update.
2. Paywall on basics, or a forced account.
3. Abandonment, or integrations that stop loading.
4. Ads or sponsored content.
5. Changing the search engine, homepage or startup page.
6. Slowness or a flash on open.
7. CPU and lag spikes. Momentum's timer reportedly drove a CPU to 100 °C
   (2024).
8. Feeling distracting.

Note: Chrome shows its own "Customize Chrome" button on extension new tabs.
Users blame the extension for it (Mue #1079, 2025), though Chrome lets you
hide it.

## AI on the new tab

Mostly negative or indifferent; no evidence of demand.

- Chrome's AI Mode and Ask AI buttons generated removal guides.
- Firefox's "AI browser" plan drew enough backlash that Mozilla promised an
  AI kill switch
  ([TechRadar](https://techradar.com/computing/firefox-responds-to-ai-backlash-by-promising-a-kill-switch-for-turning-off-controversial-new-features)).
- Edge's Copilot new tab got focus-hijacking complaints
  ([PCWorld](https://www.pcworld.com/article/2795524/heres-what-the-new-copilot-mode-within-edge-looks-like.html)).
- "ChatGPT on your new tab" extensions have only about 300–1K users each.
  Compare Momentum at 2M, Bonjourr at 400K, and a blank page at 100K.

**Conclusion:** no AI by default. At most, an opt-in widget that hands off to
the user's chosen AI service.

## Gaps no current product fills well

1. **Never lose data:** versioned settings, automatic local snapshots,
   one-click export and import, no account.
2. **A calm default that stays calm:** no feeds, ads or AI, and a promise
   never to switch anything on for the user. Every big browser keeps breaking
   this.
3. **Correct first paint:** matching the browser's color, no flash. Tarn has
   already done this.
4. **Beauty with a published battery budget:** nobody publishes energy
   numbers.
5. **Widgets that need no network:** clock, notes, to-do, timer, links with
   locally cached icons. Anything networked is opt-in and degrades
   gracefully.
6. **Respect the browser:** its search engine, never the homepage, an honest
   focus choice.
7. **A page about intent:** "what I'm working on", not a feed
   ([jon.bo](https://jon.bo/posts/new-tab/)).
8. **A power layer that stays hidden:** custom CSS, hotkeys, a command
   palette, multiple pages, a settings lock.
9. **Zero setup, no tutorial.**

## What this means for Tarn

**North star: a calm, beautiful start that never betrays you.**

1. **Calm by default, forever.** No feeds, ads or AI unless turned on, and
   nothing ever switched on for the user.
2. **Never lose anything.** Snapshots plus export and import, no account.
3. **Respect the browser.** Its search engine, its homepage, its focus rules.
4. **Beautiful, measurably light.** Publish real performance numbers.
5. **Power kept out of sight.** Shortcuts, custom CSS and a command palette
   exist without cluttering the page.

**Default page:** the living background, a large clock and date, and
optionally a few pinned links. Nothing else.

**Widget order, by evidence:**

1. Quick links: your picks, icons via the favicon permission, no network.
2. Search with the browser's own engine.
3. Notes and to-do.
4. Focus timer.
5. Calendar (opt-in).
6. Weather (opt-in, degrades gracefully).

**Skip:** news feeds, quotes, most-visited thumbnails.
