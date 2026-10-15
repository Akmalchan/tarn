/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {
  NOISE_ORIGIN,
  NOISE_SIZE,
  NOISE_TEXELS_PER_CELL,
  createNoiseData,
  hashGlsl,
} from './noise-texture';

/** The shader's computed noise(p), transcribed directly. */
function referenceNoise(px: number, py: number): number {
  const grad = (cx: number, cy: number) => {
    const a = Math.fround(
      Math.fround(hashGlsl(cx, cy)) * Math.fround((Math.PI * 2) / 4294967295),
    );
    return [Math.cos(a), Math.sin(a)] as const;
  };
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (cx: number, cy: number, dx: number, dy: number) => {
    const [gx, gy] = grad(cx, cy);
    return gx * dx + gy * dy;
  };
  const a = dot(ix, iy, fx, fy);
  const b = dot(ix + 1, iy, fx - 1, fy);
  const c = dot(ix, iy + 1, fx, fy - 1);
  const d = dot(ix + 1, iy + 1, fx - 1, fy - 1);
  const u = fade(fx);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * fade(fy);
}

describe('baked noise', () => {
  const data = createNoiseData();
  const at = (x: number, y: number) => data[y * NOISE_SIZE + x]!;

  it('stays in the gradient-noise range', () => {
    let min = Infinity;
    let max = -Infinity;
    for (const v of data) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThan(-0.75);
    expect(max).toBeLessThan(0.75);
    expect(max - min).toBeGreaterThan(0.8);
  });

  // Largest step between neighbouring texels anywhere inside the texture.
  let maxStep = 0;
  for (let y = 0; y < NOISE_SIZE; y++) {
    for (let x = 1; x < NOISE_SIZE; x++) {
      maxStep = Math.max(maxStep, Math.abs(at(x, y) - at(x - 1, y)));
    }
  }

  it('is smooth between neighbouring texels', () => {
    // Steepest gradient-noise slope is ~1.5 per cell; 16 texels per cell.
    expect(maxStep).toBeLessThan(0.15);
  });

  it('tiles seamlessly: wrapping is no bigger a step than any other', () => {
    for (let i = 0; i < NOISE_SIZE; i++) {
      expect(Math.abs(at(0, i) - at(NOISE_SIZE - 1, i))).toBeLessThanOrEqual(
        maxStep,
      );
      expect(Math.abs(at(i, 0) - at(i, NOISE_SIZE - 1))).toBeLessThanOrEqual(
        maxStep * 1.2,
      );
    }
  });

  it('holds exactly the shader noise() inside the baked range', () => {
    // The last band of cells wraps to the first so the texture tiles; that
    // band intentionally differs from the non-repeating computed noise.
    const inside = NOISE_SIZE - NOISE_TEXELS_PER_CELL;
    let seed = 12345;
    const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
    for (let n = 0; n < 2000; n++) {
      const tx = random() % inside;
      const ty = random() % inside;
      const px = (tx + 0.5) / NOISE_TEXELS_PER_CELL - NOISE_ORIGIN;
      const py = (ty + 0.5) / NOISE_TEXELS_PER_CELL - NOISE_ORIGIN;
      expect(at(tx, ty)).toBeCloseTo(referenceNoise(px, py), 5);
    }
  });

  it('is deterministic', () => {
    expect(createNoiseData()).toEqual(data);
  });
});
