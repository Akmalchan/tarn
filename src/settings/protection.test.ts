/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {
  autoBackups,
  createBackup,
  restoreAutoBackup,
  restoreBackup,
  saveAutoBackup,
} from './backup';
import {SETTINGS_VERSION} from './migrate';
import {DEFAULT_SETTINGS, START_WIDGETS} from './schema';
import {
  SETTINGS_KEY,
  loadSettings,
  replaceSettings,
  resetSettings,
  saveSettings,
  storedSettings,
} from './store';

// An update must never cost anyone their setup. These tests pin that down.

/** Settings as a newer Tarn might have synced them from another computer. */
const FROM_NEWER = {
  version: SETTINGS_VERSION + 1,
  enabled: true,
  scene: 'lagoon',
  clock: 'hologram',
  tabIcon: 'chrome',
  accent: {hue: 210},
  widgets: [
    {id: 'notes-a', kind: 'notes', size: 'm', pinned: true},
    {id: 'journal-b', kind: 'journal', size: 'l'},
    {id: 'focus-c', kind: 'focus', size: 's'},
  ],
};

const store = (value: unknown) =>
  fakeBrowser.storage.sync.set({[SETTINGS_KEY]: value});

describe('saving keeps what this version does not understand', () => {
  beforeEach(() => fakeBrowser.reset());

  it('rewrites only the fields a change touches', async () => {
    await store(FROM_NEWER);
    await saveSettings({tabIcon: 'none'});
    const stored = await storedSettings();
    expect(stored).toMatchObject({
      version: SETTINGS_VERSION + 1,
      scene: 'lagoon',
      clock: 'hologram',
      accent: {hue: 210},
      tabIcon: 'none',
    });
    // Shown as the defaults here, but not overwritten.
    expect(await loadSettings()).toMatchObject({
      scene: DEFAULT_SETTINGS.scene,
      clock: DEFAULT_SETTINGS.clock,
    });
  });

  it('keeps a newer widget right after the one it followed', async () => {
    await store(FROM_NEWER);
    const {widgets} = await loadSettings();
    expect(widgets.map(w => w.id)).toEqual(['notes-a', 'focus-c']);
    await saveSettings({widgets: [...widgets].reverse()});
    const stored = (await storedSettings()).widgets as {id: string}[];
    expect(stored.map(w => w.id)).toEqual(['focus-c', 'notes-a', 'journal-b']);
  });

  it('keeps unknown fields on a widget, and drops a removed one', async () => {
    await store(FROM_NEWER);
    const {widgets} = await loadSettings();
    await saveSettings({
      widgets: widgets
        .filter(w => w.id !== 'focus-c')
        .map(w => ({...w, name: 'Ideas'})),
    });
    const stored = (await storedSettings()).widgets;
    expect(stored).toEqual([
      {id: 'notes-a', kind: 'notes', size: 'm', name: 'Ideas', pinned: true},
      {id: 'journal-b', kind: 'journal', size: 'l'},
    ]);
  });

  it('removes a name when it is cleared', async () => {
    await store({
      widgets: [{id: 'notes-a', kind: 'notes', size: 'm', name: 'X'}],
    });
    await saveSettings({widgets: [{id: 'notes-a', kind: 'notes', size: 'm'}]});
    expect((await storedSettings()).widgets).toEqual([
      {id: 'notes-a', kind: 'notes', size: 'm'},
    ]);
  });

  it('marks what it writes with the settings version', async () => {
    await saveSettings({scene: 'ember'});
    expect((await storedSettings()).version).toBe(SETTINGS_VERSION);
  });
});

// A future online library (docs/library.md) will name its items `lib:…`.
// Whatever this version is given from a newer one (synced, or restored
// from a backup) must survive untouched, shown here as a fallback.
describe('library items from a later Tarn survive this one', () => {
  beforeEach(() => fakeBrowser.reset());

  const WITH_LIBRARY = {
    version: SETTINGS_VERSION + 3,
    scene: 'lib:studio-ghibli-sky',
    clock: 'lib:sundial',
    widgets: [
      {id: 'notes-a', kind: 'notes', size: 'm'},
      {id: 'lib-stocks-1', kind: 'lib:stocks', size: 'l', symbols: ['AAPL']},
    ],
    library: {installed: ['lib:studio-ghibli-sky', 'lib:sundial']},
  };

  it('shows the defaults, and keeps every library value when saving', async () => {
    await store(WITH_LIBRARY);
    const shown = await loadSettings();
    expect(shown.scene).toBe(DEFAULT_SETTINGS.scene);
    expect(shown.clock).toBe(DEFAULT_SETTINGS.clock);
    expect(shown.widgets.map(w => w.id)).toEqual(['notes-a']);
    await saveSettings({widgets: shown.widgets, tabIcon: 'none'});
    expect(await storedSettings()).toMatchObject({
      scene: 'lib:studio-ghibli-sky',
      clock: 'lib:sundial',
      widgets: WITH_LIBRARY.widgets,
      library: WITH_LIBRARY.library,
    });
  });

  it("keep a library widget's content through a backup and a restore", async () => {
    await store(WITH_LIBRARY);
    await fakeBrowser.storage.local.set({'widget.lib-stocks-1': {pinned: 3}});
    const backup = await createBackup();
    await replaceSettings(DEFAULT_SETTINGS);
    await fakeBrowser.storage.local.remove('widget.lib-stocks-1');
    await restoreBackup(backup);
    expect(await storedSettings()).toMatchObject({
      scene: 'lib:studio-ghibli-sky',
      widgets: WITH_LIBRARY.widgets,
    });
    const local = await fakeBrowser.storage.local.get('widget.lib-stocks-1');
    expect(local['widget.lib-stocks-1']).toEqual({pinned: 3});
  });
});

describe('every past shape still loads', () => {
  beforeEach(() => fakeBrowser.reset());

  // Shapes Tarn has stored since its first version, oldest first.
  const PAST = [
    {enabled: false, scene: 'wave'},
    {enabled: true, scene: 'ember', tabIcon: 'none', clock: 'bold'},
    {
      enabled: true,
      scene: 'bloom',
      clock: 'minimal',
      widgets: [
        {id: 'notes-a', kind: 'notes', size: 's'},
        {id: 'focus-b', kind: 'focus', size: 'l'},
      ],
    },
    {
      version: 1,
      scene: 'photo:3f2c9a1e-77aa-4b8e',
      widgets: [{id: 'tasks-a', kind: 'tasks', size: 'm', name: 'Work'}],
    },
  ];

  it.each(PAST)('keeps the values of %j', async raw => {
    await store(raw);
    const settings = await loadSettings();
    expect(settings.scene).toBe(raw.scene);
    if ('enabled' in raw) expect(settings.enabled).toBe(raw.enabled);
    if ('clock' in raw) expect(settings.clock).toBe(raw.clock);
    // Shapes from before widgets get the start setup.
    expect(settings.widgets.map(w => w.id)).toEqual(
      (raw.widgets ?? START_WIDGETS).map(w => w.id),
    );
  });
});

describe('replacing the whole setup', () => {
  beforeEach(() => fakeBrowser.reset());

  it('takes the new setup as-is, keeps on/off, and returns the old one', async () => {
    await saveSettings({enabled: false, scene: 'ember'});
    const previous = await replaceSettings(FROM_NEWER);
    expect(previous).toMatchObject({enabled: false, scene: 'ember'});
    const stored = await storedSettings();
    expect(stored).toMatchObject({enabled: false, scene: 'lagoon'});
    expect(stored.widgets).toEqual(FROM_NEWER.widgets);
  });

  it('resets fully to the start setup, newer widgets included', async () => {
    await store(FROM_NEWER);
    await replaceSettings(DEFAULT_SETTINGS);
    expect((await loadSettings()).widgets).toEqual(START_WIDGETS);
    expect((await storedSettings()).widgets).toEqual(START_WIDGETS);
  });
});

describe('reset', () => {
  beforeEach(() => fakeBrowser.reset());

  it('puts the look back and keeps widgets, language and newer values', async () => {
    await store({
      ...FROM_NEWER,
      scene: 'ember',
      clock: 'bold',
      clockColor: 'dark',
      language: 'de',
      search: {show: false, style: 'glass'},
      weather: {provider: 'google', units: 'fahrenheit'},
    });
    await resetSettings();
    const stored = await storedSettings();
    expect(stored).toMatchObject({
      scene: DEFAULT_SETTINGS.scene,
      clock: DEFAULT_SETTINGS.clock,
      clockColor: 'auto',
      search: DEFAULT_SETTINGS.search,
      weather: DEFAULT_SETTINGS.weather,
      language: 'de',
      accent: {hue: 210},
    });
    expect(stored.widgets).toEqual(FROM_NEWER.widgets);
  });
});

describe('backups', () => {
  beforeEach(() => fakeBrowser.reset());

  it('round-trip settings and widget content, and return the replaced setup', async () => {
    await store(FROM_NEWER);
    await fakeBrowser.storage.local.set({'widget.notes-a': 'Buy milk'});
    const backup = await createBackup();

    await replaceSettings(DEFAULT_SETTINGS);
    await fakeBrowser.storage.local.set({'widget.notes-a': 'changed'});

    const replaced = await restoreBackup(backup);
    expect(replaced.widgets).toEqual({'notes-a': 'changed'});
    expect((await storedSettings()).scene).toBe('lagoon');
    const local = await fakeBrowser.storage.local.get('widget.notes-a');
    expect(local['widget.notes-a']).toBe('Buy milk');
  });

  it('accept an old settings-only export', async () => {
    await restoreBackup({scene: 'wave', clock: 'none'});
    expect(await loadSettings()).toMatchObject({scene: 'wave', clock: 'none'});
  });

  it('keep the three newest automatic copies', async () => {
    for (const scene of ['ember', 'bloom', 'wave', 'aurora']) {
      await saveSettings({scene});
      await saveAutoBackup();
    }
    expect(await autoBackups()).toHaveLength(3);
    await saveSettings({scene: 'silk'});
    await restoreAutoBackup(0);
    expect((await loadSettings()).scene).toBe('aurora');
  });
});
