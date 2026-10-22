/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {AUTO_SCENE, sceneFor} from '../backdrop/scenes/ids';
import {DEFAULT_SETTINGS, normalizeSettings} from './schema';
import {
  SETTINGS_KEY,
  keepOldDefaultScene,
  olderThan,
  storedSettings,
} from './store';

// The default wallpaper follows light and dark (owner, 2026-10-20); people
// updating from before that keep the Tarn they saw.

describe('the default wallpaper', () => {
  it('is Silk on a light page and Tarn on a dark one, until one is picked', () => {
    expect(DEFAULT_SETTINGS.scene).toBe(AUTO_SCENE);
    expect(sceneFor(AUTO_SCENE, false)).toBe('silk');
    expect(sceneFor(AUTO_SCENE, true)).toBe('tarn');
    expect(sceneFor('ember', false)).toBe('ember');
    expect(normalizeSettings({scene: AUTO_SCENE}).scene).toBe(AUTO_SCENE);
    expect(normalizeSettings({scene: 'nope'}).scene).toBe(AUTO_SCENE);
  });
});

describe('an update from before 1.0.1', () => {
  beforeEach(() => fakeBrowser.reset());

  it('compares versions', () => {
    expect(olderThan('1.0.0', [1, 0, 1])).toBe(true);
    expect(olderThan('0.1.0', [1, 0, 1])).toBe(true);
    expect(olderThan('1.0.1', [1, 0, 1])).toBe(false);
    expect(olderThan('1.2', [1, 0, 1])).toBe(false);
    expect(olderThan('junk', [1, 0, 1])).toBe(false);
  });

  it('keeps Tarn where no wallpaper was ever picked', async () => {
    await fakeBrowser.storage.sync.set({
      [SETTINGS_KEY]: {version: 1, clock: 'minimal'},
    });
    await keepOldDefaultScene('1.0.0');
    expect(await storedSettings()).toMatchObject({
      scene: 'tarn',
      clock: 'minimal',
    });
  });

  it('keeps Tarn even with nothing stored', async () => {
    await keepOldDefaultScene('1.0.0');
    expect((await storedSettings()).scene).toBe('tarn');
  });

  it('leaves a picked wallpaper, and later updates, alone', async () => {
    await fakeBrowser.storage.sync.set({[SETTINGS_KEY]: {scene: 'ember'}});
    await keepOldDefaultScene('1.0.0');
    expect((await storedSettings()).scene).toBe('ember');
    await fakeBrowser.storage.sync.clear();
    await keepOldDefaultScene('1.0.1');
    await keepOldDefaultScene(undefined);
    expect(await fakeBrowser.storage.sync.get(SETTINGS_KEY)).toEqual({});
  });
});
