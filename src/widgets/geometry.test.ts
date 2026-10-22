/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import type {LayoutItem, WidgetSize} from '../layout/bands';
import {
  GAP,
  PITCH,
  keepPlace,
  moveTo,
  nearestOrder,
  placeTiles,
  stableOrder,
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
    expect(width).toBe(3 * PITCH - GAP);
    expect(height).toBe(2 * PITCH - GAP);
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

describe('keepPlace', () => {
  const ids = (list: readonly {id: string}[] | null) => list?.map(w => w.id);

  it('keeps a held widget where the preview has it in a new list', () => {
    const preview = items('s', 's', 's', 's');
    const held = moveTo(preview, 'w0', 2);
    // The new list: w3 gone, a new w9 at the front.
    const next: LayoutItem[] = [{id: 'w9', size: 'm'}, ...preview.slice(0, 3)];
    expect(ids(keepPlace(next, held, 'w0'))).toEqual(['w9', 'w1', 'w0', 'w2']);
  });

  it('gives null when the held widget was removed', () => {
    expect(keepPlace(items('s'), items('s', 's'), 'w1')).toBeNull();
  });
});

describe('stableOrder', () => {
  it('keeps tiles in place and adds new ones at the end', () => {
    expect(stableOrder([], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    // A move: the page order stays.
    expect(stableOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(stableOrder(['a', 'b', 'c'], ['d', 'c', 'a'])).toEqual([
      'a',
      'c',
      'd',
    ]);
  });
});
