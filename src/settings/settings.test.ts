/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {
  CLOCK_STYLES,
  DEFAULT_SETTINGS,
  START_WIDGETS,
  normalizeSettings,
} from './schema';
import {loadSettings, saveSettings, watchSettings} from './store';

describe('normalizeSettings', () => {
  it.each([undefined, null, 42, 'x', [], {scene: 7}, {scene: 'unknown'}])(
    'falls back to defaults for %j',
    raw => {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    },
  );

  it('keeps valid values', () => {
    const widgets = [
      {id: 'notes-a1', kind: 'notes', size: 'l'},
      {id: 'focus-b2', kind: 'focus', size: 's'},
    ];
    expect(
      normalizeSettings({
        enabled: false,
        scene: 'wave',
        tabIcon: 'none',
        clock: 'none',
        clockColor: 'custom',
        clockHex: '#FF8800',
        shortcuts: false,
        widgets,
        weather: {provider: 'google', units: 'fahrenheit'},
        search: {
          show: false,
          style: 'glass',
          voice: false,
          lens: true,
          ai: 'claude',
        },
        language: 'de',
        appearance: 'dark',
      }),
    ).toEqual({
      enabled: false,
      scene: 'wave',
      tabIcon: 'none',
      clock: 'none',
      clockColor: 'custom',
      clockHex: '#ff8800',
      shortcuts: false,
      widgets,
      weather: {provider: 'google', units: 'fahrenheit'},
      search: {
        show: false,
        style: 'glass',
        voice: false,
        lens: true,
        ai: 'claude',
      },
      language: 'de',
      appearance: 'dark',
    });
  });

  it('keeps the appearance only when it is one Tarn knows', () => {
    expect(normalizeSettings({}).appearance).toBe('auto');
    expect(normalizeSettings({appearance: 'light'}).appearance).toBe('light');
    expect(normalizeSettings({appearance: 'sepia'}).appearance).toBe('auto');
  });

  it('fills in the search box and fixes its broken parts', () => {
    expect(normalizeSettings({}).search).toEqual(DEFAULT_SETTINGS.search);
    expect(
      normalizeSettings({search: {show: 'yes', voice: false, ai: 'bard'}})
        .search,
    ).toEqual({...DEFAULT_SETTINGS.search, voice: false});
  });

  it('fixes each field independently', () => {
    expect(
      normalizeSettings({
        enabled: 'no',
        scene: 'wave',
        tabIcon: 'tarn',
        clock: 'left',
        clockColor: 'pink',
        clockHex: 'orange',
        widgets: 'many',
      }),
    ).toEqual({...DEFAULT_SETTINGS, scene: 'wave', widgets: []});
  });

  it('starts a new install with the start setup', () => {
    expect(normalizeSettings({}).widgets).toEqual(START_WIDGETS);
    expect(normalizeSettings({scene: 'wave'}).widgets).toEqual(START_WIDGETS);
    expect(normalizeSettings({widgets: []}).widgets).toEqual([]);
  });

  it('keeps a photo wallpaper and drops a malformed one', () => {
    const photo = 'photo:0b6c4f7e-2d1a-4c3b-9e8f-123456789abc';
    expect(normalizeSettings({scene: photo}).scene).toBe(photo);
    expect(normalizeSettings({scene: 'photo:../x'}).scene).toBe(
      DEFAULT_SETTINGS.scene,
    );
  });

  it('moves a replaced scene to its nearest new one', () => {
    expect(normalizeSettings({scene: 'rain'}).scene).toBe('nightsky');
    expect(normalizeSettings({scene: 'comet'}).scene).toBe('nightsky');
    expect(normalizeSettings({scene: 'toString'}).scene).toBe(
      DEFAULT_SETTINGS.scene,
    );
  });

  it('keeps every clock face', () => {
    for (const clock of CLOCK_STYLES) {
      expect(normalizeSettings({clock}).clock).toBe(clock);
    }
  });

  it('drops broken widgets and keeps the rest in order', () => {
    const {widgets} = normalizeSettings({
      widgets: [
        {id: 'notes-1', kind: 'notes', size: 'xl'},
        {id: 'notes-1', kind: 'notes', size: 's'},
        {id: 'Bad Id!', kind: 'notes', size: 's'},
        {id: 'x-2', kind: 'stocks', size: 's'},
        null,
        {id: 'focus-3', kind: 'focus', size: 'huge'},
      ],
    });
    expect(widgets).toEqual([
      {id: 'notes-1', kind: 'notes', size: 'xl'},
      {id: 'focus-3', kind: 'focus', size: 's'},
    ]);
  });

  it('snaps each widget to a size it offers', () => {
    const {widgets} = normalizeSettings({
      widgets: [
        {id: 'weather-1', kind: 'weather', size: 'xl'},
        {id: 'focus-2', kind: 'focus', size: 'xl'},
        {id: 'tasks-3', kind: 'tasks', size: 's'},
      ],
    });
    expect(widgets.map(w => w.size)).toEqual(['l', 'm', 'm']);
  });

  it('keeps a trimmed custom name, and drops an empty one', () => {
    const {widgets} = normalizeSettings({
      widgets: [
        {id: 'favorites-1', kind: 'favorites', size: 'l', name: '  Work  '},
        {id: 'notes-2', kind: 'notes', size: 'm', name: '   '},
        {id: 'tasks-3', kind: 'tasks', size: 'm', name: 'x'.repeat(60)},
      ],
    });
    expect(widgets[0]!.name).toBe('Work');
    expect(widgets[1]).not.toHaveProperty('name');
    expect(widgets[2]!.name).toHaveLength(40);
  });

  it('caps the widget list', () => {
    const widgets = Array.from({length: 40}, (_, i) => ({
      id: `notes-${i}`,
      kind: 'notes',
      size: 's',
    }));
    expect(normalizeSettings({widgets}).widgets).toHaveLength(24);
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
      ...DEFAULT_SETTINGS,
      enabled: false,
      scene: 'ember',
    });
  });

  it('notifies watchers of changes', async () => {
    const listener = vi.fn();
    const stop = watchSettings(listener);
    await saveSettings({scene: 'bloom'});
    expect(listener).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      scene: 'bloom',
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
      ...DEFAULT_SETTINGS,
      enabled: false,
      scene: 'ember',
      tabIcon: 'none',
    });
  });
});
