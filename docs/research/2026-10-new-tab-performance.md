# How heavy are new tab pages? (October 2026)

We measured what Tarn, Chrome's own new tab, and 7 popular new tab
extensions cost while you just look at the page. The question: is Tarn
light, and where does its cost come from?

## How we measured

- **Machine:** MacBook with an Apple M4, Chrome for Testing 155, a visible
  1440 × 900 window.
- **Extensions:** downloaded from the Chrome Web Store on 2026-10-12, each
  run alone in a fresh, throwaway browser profile.
- **Each run:** open a new tab, let it load for 8 seconds, then measure 10
  seconds of doing nothing. Every subject ran 3 times; the table shows the
  middle value.
- **CPU numbers** are % of one CPU core, split by Chrome's processes:
  - _Page_ (renderer): the page's own work, including Tarn's background
    animation, which runs in a worker.
  - _Graphics_ (GPU process): drawing frames to the screen.
- Momentum and Mue showed their first-run welcome screens (Momentum asks
  for your name), so they were measured on those.
- The scripts and raw data are kept outside the repo (scratchpad
  `ext-bench/`).

## Results

| New tab                      | Page CPU | Graphics CPU | Work while idle             | Memory (JS) | Network at load (outside servers) |
| ---------------------------- | -------- | ------------ | --------------------------- | ----------- | --------------------------------- |
| **Tarn** (moving background) | 5.9%     | 11.6%        | none                        | 6.2 MB      | 0                                 |
| **Tarn + 4 widgets**         | 5.7%     | 12.0%        | none                        | 7.1 MB      | 0                                 |
| Chrome's own new tab         | 5.8%     | 8.1%         | ~32 style updates/s         | 7.9 MB      | 4                                 |
| Momentum                     | 0.8%     | 2.9%         | none                        | 10.7 MB     | 2 (incl. analytics)               |
| Bonjourr                     | 0.5%     | 2.5%         | 1 clock update/s            | 2.0 MB      | 1                                 |
| Tabliss                      | 0.7%     | 1.8%         | none                        | 4.7 MB      | 2                                 |
| Infinity New Tab             | 0.5%     | 1.9%         | none                        | 18.4 MB     | 62                                |
| Earth View (Google)          | 0.3%     | 1.9%         | none                        | 7.0 MB      | 4 (incl. analytics)               |
| daily.dev                    | 0.8%     | 2.1%         | none                        | 57.9 MB     | 115                               |
| Mue                          | 0.4%     | 2.9%         | slideshow in welcome screen | 9.3 MB      | 0                                 |

How noisy it is:

- Graphics numbers are steady, within about 1 point between runs.
- Page CPU under 1.5% is close to measurement noise, so differences there
  mean little.
- Tarn's page CPU ranged 4.9-7.5%.

## What it means

1. **Tarn's cost is the moving background, nothing else.**
   - The page itself is idle: 0.4% busy, no layout or style work.
   - Widgets add almost nothing: about +0.4 graphics points and 1 MB of
     memory.
   - All the cost is the animation, about 6% for the page (drawing the
     scene) and about 12% for graphics.
   - Every other extension shows a still photo, which costs about 2-3%
     graphics.
2. **Even so, Tarn is about as heavy as Chrome's own new tab.**
   - Same page CPU (5.9% vs 5.8%), somewhat more graphics (11.6% vs 8.1%).
   - Chrome's page is not idle either: its search box animation causes
     about 32 style updates a second.
3. **Tarn is the only one besides Mue with zero outside network requests.**
   - Momentum and Earth View send analytics on every new tab.
   - Infinity loads 62 outside resources, daily.dev 115.
   - Earth View downloads an 814 KB image list on every new tab.
4. **Tarn is small.** About 500 page elements, versus about 34,000 for
   Bonjourr and 92,000 for Infinity. daily.dev holds 58 MB of memory.
5. **Opening speed:** first paint about 56-68 ms (Tarn), versus 72-108 ms
   for most others, 204 ms for daily.dev and 640 ms for Momentum.
   - Tarn's first frame is deliberately the browser's own color, and the
     scene eases in after it.
   - Tools like Lighthouse don't record a "first contentful paint" for Tarn,
     because its content fades in from transparent. They would score it
     wrongly; measure first paint instead.

## Re-run on 2026-10-13 (first pilot build)

Same method and machine, same extension downloads, with the build given
to the first pilot (0.1.0): a fresh install, so Tarn shows its start
setup (clock plus 4 widgets). _Tarn, calm_ is the same page measured
after 75 s without input, when the scene has eased to its calm pace.

| New tab              | Page CPU | Graphics CPU | Layouts + style updates (10 s idle) | Memory (JS) | Network at load (outside servers) |
| -------------------- | -------- | ------------ | ----------------------------------- | ----------- | --------------------------------- |
| **Tarn**             | 6.1%     | 12.4%        | 0                                   | 7.0 MB      | 0                                 |
| **Tarn, calm**       | 4.0%     | 8.8%         | 0                                   | 4.4 MB      | 0                                 |
| Chrome's own new tab | 5.0%     | 7.9%         | 338                                 | 7.9 MB      | 4                                 |
| Momentum             | 0.8%     | 2.5%         | 0                                   | 10.9 MB     | 2                                 |
| Bonjourr             | 0.7%     | 2.7%         | 20                                  | 2.0 MB      | 1                                 |
| Tabliss              | 0.9%     | 2.0%         | 0                                   | 4.7 MB      | 2                                 |
| Infinity New Tab     | 0.8%     | 2.0%         | 0                                   | 18.4 MB     | 62                                |
| Earth View (Google)  | 0.7%     | 1.9%         | 0                                   | 7.5 MB      | 4                                 |
| daily.dev            | 44.7%    | 34.9%        | 1441                                | 58.1 MB     | 113                               |
| Mue                  | 0.5%     | 3.1%         | 1                                   | 9.3 MB      | 0                                 |

- Tarn is unchanged from the first run (5.9% / 11.6%), now with 4
  widgets on screen. Its page main thread is 0.36% busy.
- The calm pace saves about a third of both numbers.
- daily.dev was far heavier than on 2026-10-12 (0.8%): its feed now
  animates while idle.
- First paint: Tarn 60-72 ms, the others 52-92 ms. Chrome's "first
  contentful paint" is not meaningful for Tarn: its content fades in from
  transparent, and Chrome records it seconds later.

## What to do next

- **The background animation is Tarn's one real cost.** Ideas to make it
  lighter, to try separately:
  - Slow it down when the page hasn't been touched for a while, and pause it
    after a few minutes.
  - Draw fewer frames for slow scenes.
  - Lower its resolution further on battery.
- Measure again on a weaker laptop (an Intel MacBook or a Chromebook), where
  the gap between a moving and a still background will be bigger.
