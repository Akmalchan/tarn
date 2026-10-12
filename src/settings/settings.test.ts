/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {DEFAULT_SETTINGS, normalizeSettings} from './schema';
import {loadSettings, saveSettings, watchSettings} from './store';

describe('normalizeSettings', () => {
  it.each([undefined, null, 42, 'x', [], {scene: 7}, {scene: 'unknown'}])(
    'falls back to defaults for %j',
    raw => {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    },
  );

  it('keeps valid values', () => {
    expect(
      normalizeSettings({enabled: false, scene: 'wave', tabIcon: 'none'}),
    ).toEqual({enabled: false, scene: 'wave', tabIcon: 'none'});
  });

  it('fixes each field independently', () => {
    expect(
      normalizeSettings({enabled: 'no', scene: 'wave', tabIcon: 'tarn'}),
    ).toEqual({enabled: true, scene: 'wave', tabIcon: 'chrome'});
  });
});

describe('settings store', () => {
  beforeEach(() => fakeBrowser.reset());

  it('returns defaults when nothing is saved', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through storage', async () => {
    await saveSettings({scene: 'ember'});
    await saveSettings({enabled: false});
    expect(await loadSettings()).toEqual({
      enabled: false,
      scene: 'ember',
      tabIcon: 'chrome',
    });
  });

  it('notifies watchers of changes', async () => {
    const listener = vi.fn();
    const stop = watchSettings(listener);
    await saveSettings({scene: 'bloom'});
    expect(listener).toHaveBeenCalledWith({
      enabled: true,
      scene: 'bloom',
      tabIcon: 'chrome',
    });
    stop();
  });
});

describe('concurrent saves', () => {
  beforeEach(() => fakeBrowser.reset());

  it('apply in order without losing either change', async () => {
    await Promise.all([
      saveSettings({scene: 'ember'}),
      saveSettings({tabIcon: 'none'}),
      saveSettings({enabled: false}),
    ]);
    expect(await loadSettings()).toEqual({
      enabled: false,
      scene: 'ember',
      tabIcon: 'none',
    });
  });
});
