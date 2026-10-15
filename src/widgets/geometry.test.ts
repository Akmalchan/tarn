/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import type {LayoutItem, WidgetSize} from '../layout/bands';
import {
  PITCH,
  moveTo,
  nearestIndex,
  nearestOrder,
  placeTiles,
  swap,
} from './geometry';

const items = (...sizes: WidgetSize[]): LayoutItem[] =>
  sizes.map((size, i) => ({id: `w${i}`, size}));

describe('placeTiles', () => {
  it('keeps the widgets order and sizes tiles in whole cells', () => {
    const {tiles, width, height} = placeTiles(items('l', 's', 's'), 6);
    expect(tiles.map(t => t.id)).toEqual(['w0', 'w1', 'w2']);
    expect(tiles[0]).toMatchObject({x: 0, y: 0});
    expect(tiles[1]).toMatchObject({x: 2 * PITCH, y: 0});
    expect(tiles[2]).toMatchObject({x: 2 * PITCH, y: PITCH});
    expect(width).toBe(3 * PITCH - 24);
    expect(height).toBe(2 * PITCH - 24);
  });
});

describe('moveTo', () => {
  it('moves one item and keeps the rest in order', () => {
    const list = items('s', 'm', 'l', 'xl');
    expect(moveTo(list, 'w0', 2).map(i => i.id)).toEqual([
      'w1',
      'w2',
      'w0',
      'w3',
    ]);
    expect(moveTo(list, 'w3', 0).map(i => i.id)).toEqual([
      'w3',
      'w0',
      'w1',
      'w2',
    ]);
  });

  it('clamps out-of-range positions and ignores unknown ids', () => {
    const list = items('s', 'm');
    expect(moveTo(list, 'w0', 99).map(i => i.id)).toEqual(['w1', 'w0']);
    expect(moveTo(list, 'nope', 0)).toEqual(list);
  });
});

describe('nearestIndex', () => {
  it('stays put when dropped where it already is', () => {
    const list = items('l', 'l', 'l');
    const {tiles} = placeTiles(list, 6);
    const t = tiles[1]!;
    expect(
      nearestIndex(list, 'w1', 6, t.x + t.width / 2, t.y + t.height / 2),
    ).toBe(1);
  });

  it('moves to the slot under the pointer', () => {
    // Three large widgets in a row; drag the first over the third's slot.
    const list = items('l', 'l', 'l');
    const {tiles} = placeTiles(list, 6);
    const third = tiles[2]!;
    expect(
      nearestIndex(
        list,
        'w0',
        6,
        third.x + third.width / 2,
        third.y + third.height / 2,
      ),
    ).toBe(2);
  });

  it('keeps its slot when the pointer is only a little closer to another', () => {
    const list = items('l', 'l', 'l');
    const {tiles} = placeTiles(list, 6);
    const a = tiles[0]!;
    const b = tiles[1]!;
    // Just past halfway from slot 0 towards slot 1.
    const x = a.x + a.width / 2 + (b.x - a.x) * 0.55;
    const y = a.y + a.height / 2;
    expect(nearestIndex(list, 'w0', 6, x, y, 0)).toBe(1);
    expect(nearestIndex(list, 'w0', 6, x, y, PITCH * 0.3)).toBe(0);
  });
});

describe('swap', () => {
  it('trades two places and leaves the rest', () => {
    const list = items('s', 'm', 'l');
    expect(swap(list, 'w0', 'w2').map(i => i.id)).toEqual(['w2', 'w1', 'w0']);
  });
});

describe('nearestOrder', () => {
  it('lands the dragged widget in the slot under the pointer', () => {
    const list = items('l', 'l', 'l');
    const third = placeTiles(list, 6).tiles[2]!;
    const order = nearestOrder(
      list,
      'w0',
      6,
      third.x + third.width / 2,
      third.y + third.height / 2,
    );
    const landed = placeTiles(order, 6).tiles.find(t => t.id === 'w0')!;
    expect(landed).toMatchObject({x: third.x, y: third.y});
  });

  it('keeps the order when nothing is clearly closer', () => {
    const list = items('l', 's', 's', 'm');
    const own = placeTiles(list, 6).tiles[0]!;
    expect(
      nearestOrder(list, 'w0', 6, own.x + 20, own.y + 20, PITCH * 0.3),
    ).toEqual(list);
  });
});
