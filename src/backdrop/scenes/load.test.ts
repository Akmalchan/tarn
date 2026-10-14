/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {describe, expect, it} from 'vitest';
import {SCENES} from './index';
import {SCENE_LOAD, loadLevel} from './load';

describe('scene load', () => {
  it('has a measurement for every scene', () => {
    for (const scene of SCENES) expect(SCENE_LOAD[scene.id]).toBeDefined();
  });

  it('reads photos as still and spreads the scenes out', () => {
    expect(loadLevel('photo:abc')).toBe('still');
    expect(loadLevel('comet')).toBe('light');
    expect(loadLevel('koi')).toBe('medium');
    expect(loadLevel('ember')).toBe('heavy');
  });
});
