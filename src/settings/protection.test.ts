/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {
  autoBackups,
  canRestore,
  createBackup,
  restoreAutoBackup,
  restoreBackup,
  saveAutoBackup,
} from './backup';
import {SETTINGS_VERSION} from './migrate';
import {DEFAULT_SETTINGS, MAX_WIDGETS, START_WIDGETS} from './schema';
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
  // A provider, a style and fields this version doesn't have.
  weather: {provider: 'apple', units: 'auto', wind: 'kmh'},
  search: {
    show: true,
    style: 'frost',
    voice: true,
    lens: true,
    ai: 'off',
    engine: 'ddg',
  },
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

  it('keeps weather and search fields it does not know', async () => {
    await store(FROM_NEWER);
    const {weather, search} = await loadSettings();
    // Shown as the defaults here.
    expect(weather.provider).toBe(DEFAULT_SETTINGS.weather.provider);
    expect(search.style).toBe(DEFAULT_SETTINGS.search.style);
    // °C on home, then Voice off: the panel sends the whole objects back.
    await saveSettings({weather: {...weather, units: 'celsius'}});
    await saveSettings({search: {...search, voice: false}});
    const stored = await storedSettings();
    expect(stored.weather).toEqual({
      provider: 'apple',
      units: 'celsius',
      wind: 'kmh',
    });
    expect(stored.search).toEqual({...FROM_NEWER.search, voice: false});
  });

  it('writes a known value over an unknown one when it is picked', async () => {
    await store(FROM_NEWER);
    const {weather} = await loadSettings();
    await saveSettings({weather: {...weather, provider: 'google'}});
    expect((await storedSettings()).weather).toEqual({
      provider: 'google',
      units: 'auto',
      wind: 'kmh',
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

  // Entries of a kind this version knows, but written by a newer Tarn.
  const NEWER_ENTRIES = [
    {id: 'notes-a', kind: 'notes', size: 'xxl', name: 'x'.repeat(60)},
    {id: 'lib-notes-' + 'b'.repeat(40), kind: 'notes', size: 'm'},
    {id: 'focus-c', kind: 'focus', size: 's'},
  ];

  it('keeps a newer size, a longer name and an unusual id', async () => {
    await store({widgets: NEWER_ENTRIES});
    const {widgets} = await loadSettings();
    expect(widgets).toEqual([
      {id: 'notes-a', kind: 'notes', size: 'm', name: 'x'.repeat(40)},
      {id: 'focus-c', kind: 'focus', size: 's'},
    ]);
    // Moving them around rewrites neither.
    await saveSettings({widgets: [...widgets].reverse()});
    expect((await storedSettings()).widgets).toEqual([
      NEWER_ENTRIES[2],
      NEWER_ENTRIES[0],
      NEWER_ENTRIES[1],
    ]);
  });

  it('writes a size or name changed here over the newer one', async () => {
    await store({widgets: NEWER_ENTRIES});
    const [notes, focus] = (await loadSettings()).widgets;
    await saveSettings({
      widgets: [
        {...notes!, size: 'l'},
        {...focus!, name: 'Deep work'},
      ],
    });
    expect((await storedSettings()).widgets).toEqual([
      {...NEWER_ENTRIES[0], size: 'l'},
      NEWER_ENTRIES[1],
      {...NEWER_ENTRIES[2], name: 'Deep work'},
    ]);
    await saveSettings({widgets: [{...notes!, size: 'l', name: undefined}]});
    expect((await storedSettings()).widgets).toEqual([
      {id: 'notes-a', kind: 'notes', size: 'l'},
      NEWER_ENTRIES[1],
    ]);
  });

  it('keeps widgets past the most this version shows', async () => {
    const many = Array.from({length: MAX_WIDGETS + 6}, (_, i) => ({
      id: `notes-${i}`,
      kind: 'notes',
      size: 'm',
    }));
    await store({widgets: many});
    const {widgets} = await loadSettings();
    expect(widgets).toHaveLength(MAX_WIDGETS);
    await saveSettings({widgets: widgets.slice(1)});
    // The first one was removed here; the six it didn't show stay.
    expect((await storedSettings()).widgets).toEqual(many.slice(1));
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
    // From a newer Tarn: a size, a name length and an id this one doesn't
    // take; shown as it can, and kept as stored (see above).
    {
      version: 2,
      scene: 'wave',
      widgets: [
        {id: 'notes-a', kind: 'notes', size: 'xxl', name: 'x'.repeat(60)},
        {id: 'focus-b', kind: 'focus', size: 's'},
      ],
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
    expect(replaced?.widgets).toEqual({'notes-a': 'changed'});
    expect((await storedSettings()).scene).toBe('lagoon');
    const local = await fakeBrowser.storage.local.get('widget.notes-a');
    expect(local['widget.notes-a']).toBe('Buy milk');
  });

  it('accept an old settings-only export', async () => {
    expect(canRestore({scene: 'wave', clock: 'none'})).toBe(true);
    await restoreBackup({scene: 'wave', clock: 'none'});
    expect(await loadSettings()).toMatchObject({scene: 'wave', clock: 'none'});
  });

  it.each([
    {name: 'my-app', version: 1, dependencies: {lit: '^3.0.0'}},
    {scene: 'wave', name: 'my-app'},
    [1, 2, 3],
    {},
    'tarn',
    null,
    {format: 'tarn-backup'},
    {format: 'tarn-backup', version: 1, settings: [], widgets: {}},
  ])('refuse %j, changing nothing', async raw => {
    await store(FROM_NEWER);
    await fakeBrowser.storage.local.set({'widget.notes-a': 'Buy milk'});
    expect(canRestore(raw)).toBe(false);
    expect(await restoreBackup(raw)).toBeNull();
    expect(await storedSettings()).toEqual(FROM_NEWER);
    const local = await fakeBrowser.storage.local.get('widget.notes-a');
    expect(local['widget.notes-a']).toBe('Buy milk');
  });

  it('restore widget content only up to a sane size', async () => {
    const backup = await createBackup();
    await restoreBackup({
      ...backup,
      widgets: {
        'notes-a': 'Buy milk',
        'notes-b': 'x'.repeat(2_000_000),
        'notes-c': 'Call home',
      },
    });
    const local = await fakeBrowser.storage.local.get(null);
    expect(local['widget.notes-a']).toBe('Buy milk');
    expect(local['widget.notes-b']).toBeUndefined();
    expect(local['widget.notes-c']).toBe('Call home');
  });

  it('take a backup from a fresh install (no settings stored yet)', async () => {
    const backup = await createBackup();
    expect(backup.settings).toBeNull();
    expect(canRestore(backup)).toBe(true);
  });

  it('label an automatic copy with the version it was made from', async () => {
    await saveAutoBackup('1.0.0');
    expect((await autoBackups())[0]?.app).toBe('1.0.0');
  });

  it("don't keep an automatic copy identical to the newest", async () => {
    await saveSettings({scene: 'ember'});
    await saveAutoBackup('1.0.0');
    await saveSettings({scene: 'bloom'});
    await saveAutoBackup('1.0.1');
    await saveAutoBackup('1.0.2');
    await saveAutoBackup('1.0.3');
    expect((await autoBackups()).map(b => b.app)).toEqual(['1.0.1', '1.0.0']);
  });

  it('leave out the content of removed widgets automatically', async () => {
    await store(FROM_NEWER);
    await fakeBrowser.storage.local.set({
      'widget.notes-a': 'Shown',
      'widget.journal-b': 'From a newer Tarn',
      'widget.tasks-own': ['Kept while trying examples'],
      'widget.notes-gone': 'Removed long ago',
      'examples.own': [{id: 'tasks-own', kind: 'tasks', size: 'm'}],
    });
    await saveAutoBackup();
    const [auto] = (await fakeBrowser.storage.local.get('backups.auto'))[
      'backups.auto'
    ] as {widgets: Record<string, unknown>}[];
    expect(Object.keys(auto!.widgets).sort()).toEqual([
      'journal-b',
      'notes-a',
      'tasks-own',
    ]);
    // Still in storage, and in an export.
    expect((await createBackup()).widgets['notes-gone']).toBe(
      'Removed long ago',
    );
  });

  it("keep a fresh install's start widgets in an automatic copy", async () => {
    await fakeBrowser.storage.local.set({'widget.notes-start': 'Mine'});
    await saveAutoBackup();
    const [auto] = (await fakeBrowser.storage.local.get('backups.auto'))[
      'backups.auto'
    ] as {widgets: Record<string, unknown>}[];
    expect(auto!.widgets).toEqual({'notes-start': 'Mine'});
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
