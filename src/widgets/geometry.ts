/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {layoutBands, type LayoutItem} from '../layout/bands';

// Where each tile sits on the board, in CSS pixels. Pure, so the board and
// drag-to-reorder share one source of truth, and it's easy to test.

/** Tile and gap sizes, the same on every screen (docs/widgets.md). */
export const CELL = 136;
export const GAP = 24;
export const PITCH = CELL + GAP;
/** How far from the pointer a widget counts as "near" while dragging. */
const SEARCH_RADIUS = PITCH * 2.5;

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

/** `items` with the two whose ids are `a` and `b` trading places. */
export function swap<T extends {id: string}>(
  items: readonly T[],
  a: string,
  b: string,
): T[] {
  const out = [...items];
  const i = out.findIndex(item => item.id === a);
  const j = out.findIndex(item => item.id === b);
  if (i < 0 || j < 0) return out;
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/**
 * While a tile is dragged: the order that puts it nearest the pointer.
 * Candidates: landing before, after, or in place of (a swap) each widget
 * near the pointer. Swaps reach spots that moving alone can't (measured:
 * 51 -> 56-58 spots in a 9-widget layout). Each candidate is laid out and
 * the one whose slot is closest to the dragged tile's center wins. The current order is kept unless another is closer by
 * `stickiness` px, so the layout never flips back and forth.
 */
export function nearestOrder<T extends LayoutItem>(
  items: readonly T[],
  id: string,
  columns: number,
  centerX: number,
  centerY: number,
  stickiness = 0,
): T[] {
  const distance = (order: readonly T[]) => {
    const tile = placeTiles(order, columns).tiles.find(t => t.id === id);
    if (!tile) return Infinity;
    return Math.hypot(
      tile.x + tile.width / 2 - centerX,
      tile.y + tile.height / 2 - centerY,
    );
  };
  // Only spots near the pointer can win, so only widgets near it are tried:
  // landing before, after, or in place of each of them. This keeps the
  // search to a handful of layouts per frame however many widgets there are.
  const tiles = placeTiles(items, columns).tiles;
  const near = tiles
    .filter(
      t =>
        t.id !== id &&
        Math.hypot(t.x + t.width / 2 - centerX, t.y + t.height / 2 - centerY) <
          SEARCH_RADIUS,
    )
    .map(t => t.id);
  const candidates: T[][] = [];
  for (const other of near) {
    const index = items.findIndex(item => item.id === other);
    candidates.push(moveTo(items, id, index));
    candidates.push(moveTo(items, id, index + 1));
    candidates.push(swap(items, id, other));
  }
  // Past every widget (or before the first): the ends of the order.
  candidates.push(moveTo(items, id, 0), moveTo(items, id, items.length - 1));
  let best: T[] = [...items];
  let bestDistance = Infinity;
  for (const order of candidates) {
    const d = distance(order);
    if (d < bestDistance - 0.5) {
      bestDistance = d;
      best = order;
    }
  }
  return bestDistance + stickiness < distance(items) ? best : [...items];
}

/**
 * Like `nearestOrder`, but only moving the widget within the order: the
 * index it would land at. Kept for callers that only need a position.
 */
export function nearestIndex(
  items: readonly LayoutItem[],
  id: string,
  columns: number,
  centerX: number,
  centerY: number,
  /** Keep the current slot unless another is closer by this much (px). */
  stickiness = 0,
): number {
  const current = items.findIndex(item => item.id === id);
  const distanceAt = (index: number) => {
    const tile = placeTiles(moveTo(items, id, index), columns).tiles.find(
      t => t.id === id,
    );
    if (!tile) return Infinity;
    return Math.hypot(
      tile.x + tile.width / 2 - centerX,
      tile.y + tile.height / 2 - centerY,
    );
  };
  let best = current;
  let bestDistance = Infinity;
  for (let index = 0; index < items.length; index++) {
    const distance = distanceAt(index);
    if (distance < bestDistance - 0.5) {
      bestDistance = distance;
      best = index;
    }
  }
  if (best === current) return current;
  return bestDistance + stickiness < distanceAt(current) ? best : current;
}
