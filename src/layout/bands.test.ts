/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
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

  it('grows a widget without a partner to fill its column', () => {
    // Next to a large widget, a lone small or medium fills the band's height.
    const {placements} = layoutBands(items('l', 's', 'm'), 6);
    expect(placements.find(p => p.id === 'w1')).toMatchObject({w: 1, h: 2});
    expect(placements.find(p => p.id === 'w2')).toMatchObject({w: 2, h: 2});
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
  });
});

describe('columnsFor', () => {
  it('fits an even number of cells, between 2 and 6', () => {
    expect(columnsFor(300, 136, 24)).toBe(2);
    expect(columnsFor(5 * 160 - 24, 136, 24)).toBe(4);
    expect(columnsFor(4 * 160 - 24, 136, 24)).toBe(4);
    expect(columnsFor(3000, 136, 24)).toBe(6);
  });
});
