# How widgets are laid out

The rules for the clock and widgets on Tarn's new tab, and why.

Try it: [Tarn Grid Prototype](https://claude.ai/artifact/VDhBDwfCENLt38LDbbND5Z).
Open it full screen and resize the window.

## The rules

1. **Same size on every screen.** Tiles are 136px squares with 24px between
   them. The clock is 112px. Nothing grows or shrinks with the window. Only
   a phone-sized window gets a smaller clock.
2. **Four widget sizes:** small (1×1), medium (2×1), large (2×2) and extra
   large (4×2). Same as iPhone and iPad widgets.
3. **6, 4 or 2 tiles across**, whatever fits the window. Always an even
   number: most widgets are two tiles wide, and with 3 or 5 columns most
   rows ended in a one-tile gap (measured: 61% and 34% of rows). If extra
   large doesn't fit, it shows as large.
4. **Every row is a clean rectangle, two tiles tall. No holes.**
   - Large and extra large fill the row's height on their own.
   - Two smalls stack on top of each other. Two mediums do too.
   - A small or medium with no partner grows to fill the space.
   - A row of only smalls and mediums that would leave empty space (for
     example two stacked smalls in a narrow window) lies flat instead: side
     by side in a row one tile tall, each at its own size.
5. **Rows fill up.** As few rows as possible, and every row full. When the
   next widget doesn't fit, later widgets that do move up into the gap, and
   pairs of smalls (the most flexible pieces) can wait for the end. Only the
   last row can be short. Measured over 7,000 random layouts: no gaps at 2 or
   4 columns; at 6, a gap before the last row in 3.7% of rows, always with
   three or more extra large widgets (two never fit side by side).
6. **One grid for every row.** All rows share the same columns and start at
   the left edge, so tiles line up from row to row, like the iPad home
   screen. The grid as a whole is centered on the page. (Centering each row
   on its own pushed short rows half a tile off the grid.)
7. **The clock and widgets sit together, a little above the middle**, on
   any screen. With lots of widgets, the page scrolls.
8. **The clock is not a widget.** It sits on top, and you can show or hide
   it.
9. **Your order is kept** as far as it can be without leaving gaps. Widgets
   only move to fill a gap, and a layout that keeps your order wins any
   tie.

## Why earlier tries looked wrong

A tall widget next to short ones in the same row always leaves holes and
messy edges. The layouts that looked good only did so by luck, when the
widgets happened to fill a rectangle.

| Try                               | Problem                                |
| --------------------------------- | -------------------------------------- |
| Free placement (AuraTab)          | Breaks on any other window size        |
| Grid across the whole page        | A few widgets stick to one side        |
| Small block in the middle         | Bunched up, holes when sizes mix       |
| Whole page scales with the screen | Sizes change between screens           |
| Rows with mixed heights           | Holes under short widgets              |
| **Two-tile rows (chosen)**        | Clean rectangles, same look everywhere |

The old Layout Lab also tricked us. It shrank big screens down to small
pictures, so they looked emptier than they really are. On a real 27"
monitor a tile is actually a bit bigger than on a laptop.

## What other products do

- **Nobody scales tiles with the window.** Chrome (112px tiles), Firefox
  (96px), Bonjourr and Mac widgets all keep one size.
- **Chrome's new tab** shows at most 5 shortcuts per row, splits them into
  even rows, and centers them
  ([source](https://raw.githubusercontent.com/chromium/chromium/main/ui/webui/resources/cr_components/most_visited/most_visited.ts)).
- **iPad widgets** use the same four sizes, with a gap about 22% of a tile
  ([Apple](https://developer.apple.com/design/human-interface-guidelines/widgets)).
  Tarn's 24px gap is 18%: 16px felt cramped, 30px felt scattered.
- **Opera** limits tiles to 6 per row, and people said it looked tiny on big
  screens. Tarn's tiles are big and the background is the main thing, so 6
  per row looks intentional.
- **Avoid:** sizes that are a percentage of the window (nightTab), widgets
  pinned to corners that drift apart on wide screens (Tabliss, Momentum), and
  unlimited columns (Vivaldi).

## How it's built

Only built-in browser features. No libraries.

- **Layout:** `src/layout/bands.ts` is one small function. It takes the
  widgets and the number of columns, and returns where each one goes.
  - Takes about 12 microseconds for 9 widgets, 42 for 30 (it tries every
    row width and two orders, then keeps the best shape).
  - Tested on thousands of random layouts: no overlaps, no holes, nothing
    missing.
- **Placing tiles:** `src/widgets/tarn-board.ts` puts each tile in place
  with `transform`.
  - When widgets move or change size, they glide over (the FLIP technique),
    animating only transform and opacity.
  - The page's tab order follows your widget order.
- **When it recalculates:** only when widgets change, or when the window
  crosses one of 5 fixed widths. Nothing runs while you just look at the
  page.
- **The clock** updates once a minute. A hidden tab doesn't update it at
  all.
- **Widgets fit their tile:** each tile is a size container, so a widget
  can show more in a large tile and less in a small one (CSS container
  queries).
- **Widget content** (notes, sites, timer) is kept in local storage, apart
  from the synced settings. Removing a widget keeps its content.

## The frosted glass

Widgets look like frosted glass over the moving background.

Chrome's built-in blur (`backdrop-filter`) is expensive here. It re-blurs
the moving background every frame. Measured on an M4, with 9 widgets over
a moving background:

| Tiles                               | How busy the compositor is |
| ----------------------------------- | -------------------------- |
| No tiles                            | 2.0-2.3%                   |
| See-through, no blur                | 2.2-2.4%                   |
| Chrome's blur                       | **7.3-8.7%**, all the time |
| **Blur drawn by Tarn's background** | **2.0-2.4%**               |

So Tarn's background draws the frost itself (`src/backdrop/glass.ts`):

1. The page tells the background where the tiles are.
2. The background draws a frame into a texture, and the graphics card makes
   smaller, softer copies of it (mipmaps).
3. Inside the tiles, it shows the soft copy with a touch of white.

The cost is the same as no blur. With no widgets, none of this runs. If
WebGL is off, the tiles use Chrome's blur instead, which is cheap there
because nothing moves.

## What's next

1. Snapshots and export for settings, so nothing is ever lost.
2. More widgets.

Done: drag to reorder while the settings panel is open, with keyboard
support (arrow keys, Home, End) and screen-reader announcements.

## Open questions

- Is it OK that a small widget can move up to stack under an earlier one?
- On a 1440 × 900 laptop, 9 widgets plus the big clock scroll a little.
