/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {lightPixels} from './site-icon';

/** A 32x32 icon: `paint` gives each pixel's RGBA. */
function icon(
  paint: (x: number, y: number) => [number, number, number, number],
): number[] {
  const data: number[] = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) data.push(...paint(x, y));
  }
  return data;
}

const inCircle = (x: number, y: number) => (x - 16) ** 2 + (y - 16) ** 2 < 144;
const CLEAR: [number, number, number, number] = [0, 0, 0, 0];

describe('lightPixels', () => {
  it('finds a white logo on clear (GitHub, ChatGPT)', () => {
    expect(
      lightPixels(
        icon((x, y) => (inCircle(x, y) ? [255, 255, 255, 255] : CLEAR)),
      ),
    ).toBe(true);
  });

  it('finds a pale gray logo too', () => {
    expect(
      lightPixels(
        icon((x, y) => (inCircle(x, y) ? [236, 236, 236, 255] : CLEAR)),
      ),
    ).toBe(true);
  });

  it('leaves dark and colored logos on white', () => {
    expect(
      lightPixels(icon((x, y) => (inCircle(x, y) ? [24, 23, 23, 255] : CLEAR))),
    ).toBe(false);
    expect(
      lightPixels(
        icon((x, y) => (inCircle(x, y) ? [234, 67, 53, 255] : CLEAR)),
      ),
    ).toBe(false);
  });

  it('leaves a logo on its own white square', () => {
    expect(
      lightPixels(
        icon((x, y) =>
          inCircle(x, y) ? [66, 133, 244, 255] : [255, 255, 255, 255],
        ),
      ),
    ).toBe(false);
  });

  it('ignores an empty image', () => {
    expect(lightPixels(icon(() => CLEAR))).toBe(false);
  });
});
