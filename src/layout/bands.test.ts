/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import {
  WIDGET_SIZES,
  columnsFor,
  layoutBands,
  type LayoutItem,
  type WidgetSize,
} from './bands';

const items = (...sizes: WidgetSize[]): LayoutItem[] =>
  sizes.map((size, i) => ({id: `w${i}`, size}));

/** Fails unless every band is a full 2-row rectangle with no overlaps. */
function expectCleanBands(list: LayoutItem[], columns: number): void {
  const {placements, bands, heights} = layoutBands(list, columns);
  expect(placements.map(p => p.id).sort()).toEqual(list.map(i => i.id).sort());
  bands.forEach((width, band) => {
    expect(width).toBeLessThanOrEqual(Math.min(6, Math.max(2, columns)));
    const grid = Array.from({length: heights[band]!}, () =>
      Array(width).fill(0),
    );
    for (const p of placements.filter(q => q.band === band)) {
      for (let r = p.row; r < p.row + p.h; r++) {
        for (let c = p.col; c < p.col + p.w; c++) {
          expect(grid[r]![c]).toBe(0);
          grid[r]![c] = 1;
        }
      }
    }
    expect(grid.flat().every(Boolean)).toBe(true);
  });
}

describe('layoutBands', () => {
  it('lays nothing out for no widgets', () => {
    expect(layoutBands([], 6)).toEqual({
      placements: [],
      bands: [],
      heights: [],
    });
  });

  it('stacks two smalls in one column beside a large', () => {
    const {placements, bands} = layoutBands(items('l', 's', 's'), 6);
    expect(bands).toEqual([3]);
    expect(placements).toContainEqual(
      expect.objectContaining({id: 'w1', col: 2, row: 0, h: 1}),
    );
    expect(placements).toContainEqual(
      expect.objectContaining({id: 'w2', col: 2, row: 1, h: 1}),
    );
  });

  it('keeps a widget without a partner at its own size', () => {
    // A lone small or medium beside a large one isn't stretched to the
    // band's height: it keeps the size you chose, on a row of its own.
    const {placements} = layoutBands(items('l', 's', 'm'), 6);
    expect(placements.find(p => p.id === 'w1')).toMatchObject({w: 1, h: 1});
    expect(placements.find(p => p.id === 'w2')).toMatchObject({w: 2, h: 1});
    const lone = layoutBands(items('l', 's', 'l'), 6);
    expect(lone.placements.find(p => p.id === 'w1')).toMatchObject({
      band: 1,
      w: 1,
      h: 1,
    });
  });

  it('lays smalls side by side when stacking would leave a gap', () => {
    // Two columns: a large fills one band; the two smalls would stack in a
    // one-cell column with an empty column beside them.
    const {placements, bands, heights} = layoutBands(items('l', 's', 's'), 2);
    expect(bands).toEqual([2, 2]);
    expect(heights).toEqual([2, 1]);
    expect(placements.find(p => p.id === 'w2')).toMatchObject({
      band: 1,
      col: 1,
      row: 0,
    });
  });

  it('lays a lone small flat instead of growing it tall', () => {
    const {placements, heights} = layoutBands(items('s', 's', 's'), 6);
    expect(heights).toEqual([1]);
    expect(placements.every(p => p.h === 1 && p.w === 1)).toBe(true);
  });

  it('fills a band with later widgets that fit, keeping gaps at the end', () => {
    // In order, the small would start a band of 5 next to an extra large.
    // Saving it for last fills both bands: extra large + large, twice.
    const {bands} = layoutBands(items('s', 'xl', 'xl', 'l', 'l'), 6);
    expect(bands).toEqual([6, 6, 1]);
  });

  it('lays smalls and mediums as bricks, row by row in your order', () => {
    // [S][ M ]
    // [ M ][S]
    const {placements, bands} = layoutBands(items('s', 'm', 'm', 's'), 6);
    expect(bands).toEqual([3]);
    const at = (id: string) => placements.find(p => p.id === id);
    expect(at('w0')).toMatchObject({row: 0, col: 0, w: 1, h: 1});
    expect(at('w1')).toMatchObject({row: 0, col: 1, w: 2, h: 1});
    expect(at('w2')).toMatchObject({row: 1, col: 0, w: 2, h: 1});
    expect(at('w3')).toMatchObject({row: 1, col: 2, w: 1, h: 1});
  });

  it('puts a brick beside a large widget', () => {
    const {placements, bands} = layoutBands(items('l', 'm', 's', 's', 'm'), 6);
    expect(bands).toEqual([5]);
    expect(placements.every(p => p.h === 1 || p.id === 'w0')).toBe(true);
  });

  it('still stacks pairs when that avoids stretching a widget', () => {
    // A small on each side of a large: pairing keeps both at 1x1.
    const {placements} = layoutBands(items('s', 'l', 's'), 6);
    expect(placements.filter(p => p.w === 1).every(p => p.h === 1)).toBe(true);
  });

  it('never goes past six cells across', () => {
    const {bands} = layoutBands(items('xl', 'xl', 'xl'), 12);
    expect(Math.max(...bands)).toBeLessThanOrEqual(6);
  });

  it('balances bands instead of leaving a lone leftover', () => {
    // 4 + 2 + 1 + 2 + 2 + 1 cells: 6 + 6, not 6 + 6 with a straggler.
    const {bands} = layoutBands(
      items('xl', 'l', 's', 's', 'l', 'm', 'm', 's', 's'),
      6,
    );
    expect(bands).toEqual([6, 6]);
  });

  it('shows extra large as large when fewer than 4 columns fit', () => {
    const {placements} = layoutBands(items('xl'), 2);
    expect(placements[0]).toMatchObject({w: 2, h: 2});
  });

  it('keeps every band a clean rectangle for random layouts', () => {
    let shortBands = 0;
    let totalBands = 0;
    let seed = 7;
    const random = () =>
      (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let n = 1; n <= 24; n++) {
      for (let k = 0; k < 40; k++) {
        const list = items(
          ...Array.from(
            {length: n},
            () => WIDGET_SIZES[Math.floor(random() * 4)]!,
          ),
        );
        for (const columns of [2, 3, 4, 5, 6]) expectCleanBands(list, columns);
        // Tarn only uses even column counts (see columnsFor).
        for (const columns of [2, 4, 6]) {
          // Only the last band may be short, unless nothing could fill it.
          const {bands} = layoutBands(list, columns);
          const grid = Math.max(...bands);
          const short = bands.slice(0, -1).filter(width => width < grid);
          shortBands += short.length;
          totalBands += bands.length;
        }
      }
    }
    // A gap before the last band happens only when nothing can fill it
    // (several extra large widgets: two never fit side by side in 6).
    expect(shortBands / totalBands).toBeLessThan(0.03);
    // ~1 s locally; CI runners can take 5+ s for its ~5000 layouts.
  }, 30_000);
});

describe('columnsFor', () => {
  it('fits an even number of cells, between 2 and 6', () => {
    expect(columnsFor(300, 136, 24)).toBe(2);
    expect(columnsFor(5 * 160 - 24, 136, 24)).toBe(4);
    expect(columnsFor(4 * 160 - 24, 136, 24)).toBe(4);
    expect(columnsFor(3000, 136, 24)).toBe(6);
  });
});
