/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {
  DEFAULT_SCENE_ID,
  SCENES,
  SCENE_IDS,
  photoScene,
  sceneById,
  scenePicture,
} from '.';

/** The shipped thumbnails and still pictures, as data URLs. */
const images = import.meta.glob<string>(
  ['../../../public/scenes/*.webp', '../../../public/stills/*.webp'],
  {query: '?inline', import: 'default', eager: true},
);
/** A shipped image's size in bytes, 0 if missing. */
const size = (path: string) =>
  ((images[`../../../public${path}`] ?? '').split(',')[1]?.length ?? 0) * 0.75;

describe('scenes', () => {
  it('have unique ids', () => {
    const ids = SCENES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('match the id list the settings check against (ids.ts)', () => {
    expect(SCENES.map(s => s.id)).toEqual(SCENE_IDS);
    expect(SCENES[0]!.id).toBe(DEFAULT_SCENE_ID);
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

  it.each(SCENES)('$id has a thumbnail and a still picture', scene => {
    expect(size(`/scenes/${scene.id}.webp`)).toBeGreaterThan(0);
    const picture = scenePicture(scene);
    expect(picture).toBe(`/stills/${scene.id}.webp`);
    expect(size(picture!)).toBeGreaterThan(0);
    expect(size(picture!)).toBeLessThan(350 * 1024);
  });

  it('keeps the still pictures under about 1 MB together', () => {
    const total = SCENES.reduce((sum, s) => sum + size(scenePicture(s)!), 0);
    expect(total).toBeLessThan(1024 * 1024);
  });

  it('has no still picture for a photo', () => {
    const photo = photoScene('photo:x', {
      base: '#123456',
      tone: 'dark',
      w: 10,
      h: 10,
    });
    expect(scenePicture(photo)).toBeNull();
  });

  it('falls back to the default for unknown ids', () => {
    expect(sceneById('nope').id).toBe(DEFAULT_SCENE_ID);
  });
});
