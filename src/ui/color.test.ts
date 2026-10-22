/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {averageHex, hexToRgb, relativeLuminance, toneOfHex} from './color';

describe('hexToRgb', () => {
  it('converts to normalized channels', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(hexToRgb('#FF8000')).toEqual([1, 128 / 255, 0]);
  });

  it('is black for what does not parse', () => {
    expect(hexToRgb('')).toEqual([0, 0, 0]);
    expect(hexToRgb('#zzzzzz')).toEqual([0, 0, 0]);
  });
});

describe('relativeLuminance', () => {
  it('runs from black to white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
    // Green weighs most, blue least.
    expect(relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 10);
    expect(relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 10);
  });
});

describe('toneOfHex', () => {
  it('splits at a luminance of 0.35', () => {
    expect(toneOfHex('#ffffff')).toBe('light');
    expect(toneOfHex('#a0a0a0')).toBe('light');
    expect(toneOfHex('#9f9f9f')).toBe('dark');
    expect(toneOfHex('#05080f')).toBe('dark');
  });
});

describe('averageHex', () => {
  it('averages RGBA pixels into a hex color, ignoring alpha', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 0]);
    expect(averageHex(pixels)).toBe('#800080');
  });
});
