/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Tarn's widget layout ("bands"), see docs/design/widget-layout.md.
// A pure function: no DOM, so it is cheap to run and easy to test.

export type WidgetSize = 's' | 'm' | 'l' | 'xl';

export interface LayoutItem {
  id: string;
  size: WidgetSize;
}

export interface Placement {
  id: string;
  /** Band (row of the page), 0-based. */
  band: number;
  /** Column inside the band, 0-based. */
  col: number;
  /** 0 = top half of the band, 1 = bottom half. */
  row: 0 | 1;
  w: number;
  h: 1 | 2;
}

export interface BandLayout {
  placements: Placement[];
  /** Width of each band in cells. */
  bands: number[];
  /**
   * Height of each band in cells: 2, or 1 for a band of small and medium
   * widgets laid side by side.
   */
  heights: Array<1 | 2>;
}

/** Hard cap from the design: never more than six cells across. */
export const MAX_COLUMNS = 6;

export const WIDGET_SIZES: readonly WidgetSize[] = ['s', 'm', 'l', 'xl'];

/** Cells a size covers: [columns, rows]. */
export const SPAN: Readonly<Record<WidgetSize, readonly [number, 1 | 2]>> = {
  s: [1, 1],
  m: [2, 1],
  l: [2, 2],
  xl: [4, 2],
};

interface Block {
  w: number;
  /** Two small or two medium widgets stacked (or one that grew). */
  stack: boolean;
  parts: Array<{id: string; col: number; row: 0 | 1; w: number; h: 1 | 2}>;
}

/**
 * Lays widgets out in bands two cells tall, so every row is a clean
 * rectangle:
 *  - large and extra large widgets fill a band's height on their own;
 *  - small widgets stack in pairs in a one-cell column, mediums in pairs in
 *    a two-cell column; a widget left without a partner keeps its size on a
 *    row of its own, and grows to fill the column (small to 1x2, medium to
 *    2x2) only when keeping its size would leave a hole;
 *  - bands fill up: when the next widget doesn't fit, a later one that does
 *    moves up into the gap, so only the last band can be short;
 *  - a band of only smalls and mediums that would leave empty space lies
 *    flat instead, one cell tall.
 * All bands share one column grid; the caller centers the grid. Runs in
 * microseconds; call it only when the widgets or the column limit change.
 */
export function layoutBands(
  items: readonly LayoutItem[],
  columns: number,
): BandLayout {
  const cols = Math.max(2, Math.min(MAX_COLUMNS, Math.floor(columns)));
  const sized = items.map(item => {
    let [w, h] = SPAN[item.size] ?? SPAN.s;
    if (w > cols) [w, h] = SPAN.l;
    return {id: item.id, w, h};
  });
  if (!sized.length) return {placements: [], bands: [], heights: []};
  // Two ways to combine the one-row widgets (smalls and mediums), each a
  // full two-row block: row by row in your reading order ("bricks", e.g. a
  // small and a medium over a medium and a small), or stacked in pairs of
  // the same size. Both are tried, each in your order and with one-cell
  // blocks (the most flexible pieces) saved for last, at every wrap width;
  // the best final shape wins.
  const blockSets = [brickBlocks(sized, cols), pairBlocks(sized)];
  let best: {layout: BandLayout; score: number[]} | null = null;
  for (const [set, blocks] of blockSets.entries()) {
    const widest = Math.max(...blocks.map(b => b.w));
    const orders = [
      blocks,
      [...blocks.filter(b => b.w > 1), ...blocks.filter(b => b.w === 1)],
    ];
    for (const [variant, order] of orders.entries()) {
      for (let width = cols; width >= widest; width--) {
        const groups = fillBands(
          order.map(b => b.w),
          width,
        ).map(band => band.map(index => order[index]!));
        const candidate = arrange(groups, cols, set + variant);
        if (!best || isLess(candidate.score, best.score)) best = candidate;
      }
    }
    // Large widgets in bands of their own, and the one-row widgets in
    // theirs: the one-row ones can then lie flat at their own sizes
    // instead of being stretched to stand beside a large one.
    const large = blocks.filter(b => !b.stack);
    const oneRow = blocks.filter(b => b.stack);
    if (large.length && oneRow.length) {
      for (let width = cols; width >= widest; width--) {
        const fill = (part: Block[]) =>
          fillBands(
            part.map(b => b.w),
            width,
          ).map(band => band.map(index => part[index]!));
        const candidate = arrange(
          [...fill(large), ...fill(oneRow)],
          cols,
          set + 1,
        );
        if (!best || isLess(candidate.score, best.score)) best = candidate;
      }
    }
  }
  return best!.layout;
}

interface Sized {
  id: string;
  w: number;
  h: 1 | 2;
}

/**
 * One-row widgets stacked in pairs of the same size: two smalls in a
 * one-cell column, two mediums in a two-cell column. A widget left without
 * a partner grows to fill its column (small to 1x2, medium to 2x2).
 */
function pairBlocks(items: readonly Sized[]): Block[] {
  const blocks: Block[] = [];
  let openSmall: Block | null = null;
  let openMedium: Block | null = null;
  for (const {id, w, h} of items) {
    if (h === 2) {
      blocks.push({w, stack: false, parts: [{id, col: 0, row: 0, w, h}]});
    } else if (w === 1) {
      if (openSmall) {
        openSmall.parts.push({id, col: 0, row: 1, w: 1, h: 1});
        openSmall = null;
      } else {
        openSmall = {
          w: 1,
          stack: true,
          parts: [{id, col: 0, row: 0, w: 1, h: 1}],
        };
        blocks.push(openSmall);
      }
    } else if (openMedium) {
      openMedium.parts.push({id, col: 0, row: 1, w: 2, h: 1});
      openMedium = null;
    } else {
      openMedium = {
        w: 2,
        stack: true,
        parts: [{id, col: 0, row: 0, w: 2, h: 1}],
      };
      blocks.push(openMedium);
    }
  }
  if (openSmall) openSmall.parts[0]!.h = 2;
  if (openMedium) openMedium.parts[0]!.h = 2;
  return blocks;
}

/**
 * One-row widgets laid row by row, in reading order: each run of smalls and
 * mediums between taller widgets becomes as few two-row "brick" blocks as
 * possible, the first widgets filling the top row and the rest the bottom
 * one. A run that can't be split into full bricks is stacked in pairs.
 */
function brickBlocks(items: readonly Sized[], cols: number): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < items.length;) {
    if (items[i]!.h === 2) {
      const {id, w, h} = items[i]!;
      blocks.push({w, stack: false, parts: [{id, col: 0, row: 0, w, h}]});
      i++;
      continue;
    }
    let end = i;
    while (end < items.length && items[end]!.h === 1) end++;
    const run = items.slice(i, end);
    blocks.push(...(splitIntoBricks(run, cols) ?? pairBlocks(run)));
    i = end;
  }
  return blocks;
}

/**
 * The fewest consecutive bricks that cover `run` exactly, or null when it
 * can't be done. A brick needs an even total width and a prefix that fills
 * exactly half of it (the top row); it may be at most `cols` wide.
 */
function splitIntoBricks(run: readonly Sized[], cols: number): Block[] | null {
  const n = run.length;
  // fewest[i]: fewest bricks covering run[0..i); from[i]: where the last starts.
  const fewest = [0, ...Array<number>(n).fill(Infinity)];
  const from = Array<number>(n + 1).fill(-1);
  for (let end = 1; end <= n; end++) {
    for (let start = 0; start < end; start++) {
      if (fewest[start] === Infinity) continue;
      if (!brick(run.slice(start, end), cols)) continue;
      if (fewest[start]! + 1 < fewest[end]!) {
        fewest[end] = fewest[start]! + 1;
        from[end] = start;
      }
    }
  }
  if (fewest[n] === Infinity) return null;
  const bricks: Block[] = [];
  for (let end = n; end > 0; end = from[end]!) {
    bricks.unshift(brick(run.slice(from[end]!, end), cols)!);
  }
  return bricks;
}

function brick(run: readonly Sized[], cols: number): Block | null {
  const total = run.reduce((sum, item) => sum + item.w, 0);
  const half = total / 2;
  if (total % 2 !== 0 || half > cols) return null;
  const parts: Block['parts'] = [];
  let col = 0;
  let row: 0 | 1 = 0;
  for (const {id, w} of run) {
    if (row === 0 && col + w > half) return null;
    parts.push({id, col, row, w, h: 1});
    col += w;
    if (row === 0 && col === half) {
      row = 1;
      col = 0;
    }
  }
  return {w: half, stack: true, parts};
}

interface Shape {
  group: Block[];
  flat: boolean;
  width: number;
}

/**
 * Turns groups of blocks into placed bands, and scores the result (lower is
 * better): fewest empty cells before the last band, then fewest widgets
 * grown beyond their size, then fewest bands, then your order kept
 * (`reordered` counts changes made before this), then the fullest last band.
 */
function arrange(
  groups: Block[][],
  cols: number,
  reordered: number,
): {layout: BandLayout; score: number[]} {
  const packed = (group: Block[]) => group.reduce((n, b) => n + b.w, 0);
  const grid = Math.max(...groups.map(packed));
  const shapes: Shape[] = groups.map(group => {
    const parts = group.flatMap(b => b.parts);
    const rowWidth = parts.reduce((n, p) => n + p.w, 0);
    const grew = parts.some(p => p.h === 2);
    // A band of only small and medium widgets that would leave empty space
    // (narrower than the grid, or a widget had to grow) lies flat instead:
    // side by side in one row, each at its own size.
    const flat =
      group.every(b => b.stack) &&
      rowWidth <= cols &&
      (packed(group) < grid || grew);
    return {group, flat, width: flat ? rowWidth : packed(group)};
  });
  // Bands that can't be filled go to the bottom, so only the end is short.
  const full = Math.max(...shapes.map(shape => shape.width));
  const ordered = [
    ...shapes.filter(shape => shape.width === full),
    ...shapes.filter(shape => shape.width < full),
  ];
  const moved =
    reordered + (ordered.some((shape, i) => shape !== shapes[i]) ? 1 : 0);
  const widths = ordered.map(shape => shape.width);
  const gaps = widths.slice(0, -1).reduce((n, w) => n + full - w, 0);
  // One-row widgets that had to grow to fill a two-row block (a small made
  // 1x2, a medium made 2x2); bands laid flat keep their real sizes.
  const grown = shapes
    .filter(shape => !shape.flat)
    .flatMap(shape => shape.group)
    .filter(block => block.stack)
    .flatMap(block => block.parts)
    .filter(part => part.h === 2).length;
  // No holes come first (only the last band may be short); then your
  // chosen sizes: a widget is stretched beyond its size only when keeping
  // it would leave a hole, even if keeping it takes another band.
  const score = [gaps, grown, ordered.length, moved, full - widths.at(-1)!];

  const placements: Placement[] = [];
  const bands: number[] = [];
  const heights: Array<1 | 2> = [];
  for (const {group, flat, width} of ordered) {
    const band = bands.length;
    if (flat) {
      let col = 0;
      for (const part of group.flatMap(b => b.parts)) {
        placements.push({id: part.id, band, col, row: 0, w: part.w, h: 1});
        col += part.w;
      }
      heights.push(1);
    } else {
      let used = 0;
      for (const block of group) {
        for (const part of block.parts) {
          placements.push({...part, col: used + part.col, band});
        }
        used += block.w;
      }
      heights.push(2);
    }
    bands.push(width);
  }
  return {layout: {placements, bands, heights}, score};
}

/**
 * Groups blocks (by index) into bands no wider than `width`. The next block
 * in order starts each band, and the later blocks that fill it best join it,
 * so a band is only short when nothing left fits.
 */
function fillBands(widths: readonly number[], width: number): number[][] {
  const left = widths.map((_, i) => i);
  const bands: number[][] = [];
  while (left.length) {
    // The next widget in order always starts the band; the rest of the band
    // is the combination of later widgets that fills it best.
    const first = left[0]!;
    const band = [
      first,
      ...bestFill(widths, left.slice(1), width - widths[first]!),
    ];
    for (const index of band) left.splice(left.indexOf(index), 1);
    bands.push(band);
  }
  return bands;
}

/**
 * The candidates (in order) whose widths add up closest to `room` without
 * going over, preferring earlier ones. A tiny subset sum: room is at most 6.
 */
function bestFill(
  widths: readonly number[],
  candidates: readonly number[],
  room: number,
): number[] {
  if (room <= 0) return [];
  const reach: Array<number[] | null> = Array.from(
    {length: room + 1},
    () => null,
  );
  reach[0] = [];
  for (const candidate of candidates) {
    const w = widths[candidate]!;
    for (let sum = room; sum >= w; sum--) {
      const before = reach[sum - w];
      if (before && !reach[sum]) reach[sum] = [...before, candidate];
    }
  }
  for (let sum = room; sum > 0; sum--) if (reach[sum]) return reach[sum]!;
  return [];
}

function isLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}

/**
 * Columns that fit a container width, for a given cell and gap: 2, 4 or 6.
 * Always even, because most widgets are two cells wide; with 3 or 5 columns
 * most bands would end in a one-cell gap (measured: 61% and 34% of bands).
 */
export function columnsFor(width: number, cell: number, gap: number): number {
  const fit = Math.floor((width + gap) / (cell + gap));
  return Math.max(2, Math.min(MAX_COLUMNS, fit - (fit % 2)));
}
