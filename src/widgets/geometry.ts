/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {layoutBands, type LayoutItem} from '../layout/bands';

// Where each tile sits on the board, in CSS pixels. Pure, so the board and
// drag-to-reorder share one source of truth, and it's easy to test.

/** Tile and gap sizes, the same on every screen (docs/design/widget-layout.md). */
export const CELL = 136;
export const GAP = 24;
export const PITCH = CELL + GAP;

export interface TileBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardLayout {
  /** In the widgets' order (the reading and tab order). */
  tiles: TileBox[];
  width: number;
  height: number;
}

export function placeTiles(
  items: readonly LayoutItem[],
  columns: number,
): BoardLayout {
  const {placements, bands, heights} = layoutBands(items, columns);
  // Each band starts below the ones before it (2 cells tall, or 1).
  const top: number[] = [];
  let y = 0;
  for (const h of heights) {
    top.push(y);
    y += h * PITCH;
  }
  const order = new Map(items.map((item, i) => [item.id, i]));
  // Every band shares one column grid and starts at its left edge, so tiles
  // line up from band to band; the caller centers the grid.
  const tiles = placements
    .map(p => ({
      id: p.id,
      x: p.col * PITCH,
      y: top[p.band]! + p.row * PITCH,
      width: p.w * PITCH - GAP,
      height: p.h * PITCH - GAP,
    }))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return {
    tiles,
    width: Math.max(0, Math.max(0, ...bands) * PITCH - GAP),
    height: bands.length ? y - GAP : 0,
  };
}

/** `items` with the one whose id is `id` moved to `index`. */
export function moveTo<T extends {id: string}>(
  items: readonly T[],
  id: string,
  index: number,
): T[] {
  const from = items.findIndex(item => item.id === id);
  if (from < 0) return [...items];
  const rest = items.filter((_, i) => i !== from);
  const to = Math.max(0, Math.min(rest.length, index));
  return [...rest.slice(0, to), items[from]!, ...rest.slice(to)];
}

/**
 * While a tile is dragged: the position in the order where dropping it
 * would put it nearest the pointer. Tries every position (a few dozen tiny
 * layouts at most) and keeps the one whose slot is closest to where the
 * dragged tile's center is now, in board coordinates.
 */
export function nearestIndex(
  items: readonly LayoutItem[],
  id: string,
  columns: number,
  centerX: number,
  centerY: number,
): number {
  let best = items.findIndex(item => item.id === id);
  let bestDistance = Infinity;
  for (let index = 0; index < items.length; index++) {
    const tile = placeTiles(moveTo(items, id, index), columns).tiles.find(
      t => t.id === id,
    );
    if (!tile) continue;
    const dx = tile.x + tile.width / 2 - centerX;
    const dy = tile.y + tile.height / 2 - centerY;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance - 1) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}
