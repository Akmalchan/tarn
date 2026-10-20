/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {averageColor, hexToRgb} from '../renderer';
import {DEFAULT_SCENE_ID, SCENES, sceneById} from '.';

describe('scenes', () => {
  it('have unique ids', () => {
    const ids = SCENES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SCENES)('$id is well formed', scene => {
    expect(scene.colors).toHaveLength(4);
    for (const color of [...scene.colors, scene.base]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(scene.resolution).toBeGreaterThan(0);
    // Up to 1x, or the screen's density (capped) for hairline scenes.
    expect(scene.resolution).toBeLessThanOrEqual(2);
    expect(scene.speed).toBeGreaterThan(0);
    expect(scene.fragment).toContain('vec3 scene(vec2 uv, float t)');
  });

  it('falls back to the default for unknown ids', () => {
    expect(sceneById('nope').id).toBe(DEFAULT_SCENE_ID);
  });
});

describe('hexToRgb', () => {
  it('converts to normalized channels', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
  });
});

describe('averageColor', () => {
  it('averages RGBA pixels into a hex color', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    expect(averageColor(pixels)).toBe('#800080');
  });
});
