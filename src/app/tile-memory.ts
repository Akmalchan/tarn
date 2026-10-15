/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

// Where the widgets were, kept per tab, so a reload can frost the scene
// behind them from its very first live frame. Without this the ghost frame
// shows the frost, the first live frames don't, and the widgets blink.

const KEY = 'tarn.tiles';

interface Remembered {
  width: number;
  height: number;
  rects: number[];
  radius: number;
}

export function rememberTiles(rects: number[], radius: number): void {
  try {
    const value: Remembered = {
      width: window.innerWidth,
      height: window.innerHeight,
      rects,
      radius,
    };
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked: a reload just fades the frost in instead.
  }
}

/** The tiles from before a reload, if the window is still the same size. */
export function rememberedTiles(): {rects: number[]; radius: number} | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const {width, height, rects, radius} = raw as Partial<Remembered>;
    if (width !== window.innerWidth || height !== window.innerHeight)
      return null;
    if (
      !Array.isArray(rects) ||
      rects.length % 4 !== 0 ||
      rects.length > 4 * 64 ||
      !rects.every(n => typeof n === 'number' && Number.isFinite(n)) ||
      typeof radius !== 'number'
    ) {
      return null;
    }
    return {rects, radius};
  } catch {
    return null;
  }
}
