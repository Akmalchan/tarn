/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {restoreBackup} from './backup';
import {watchSaveProblems, type SaveProblem} from './problems';
import {
  RETRY_MS,
  SETTINGS_KEY,
  replaceSettings,
  saveSettings,
  storedSettings,
} from './store';

// What happens when storage refuses a save, and when several pages save
// at once.

const store = (value: unknown) =>
  fakeBrowser.storage.sync.set({[SETTINGS_KEY]: value});

const refuse = (times: number, message = 'MAX_WRITE_OPERATIONS_PER_MINUTE') => {
  const spy = vi.spyOn(fakeBrowser.storage.sync, 'set');
  for (let i = 0; i < times; i++) {
    spy.mockRejectedValueOnce(new Error(message));
  }
  return spy;
};

/** The problems reported during each test. */
function problems(): SaveProblem[] {
  const seen: SaveProblem[] = [];
  let stop = () => {};
  beforeEach(() => {
    seen.length = 0;
    stop = watchSaveProblems(problem => seen.push(problem));
  });
  afterEach(() => stop());
  return seen;
}

describe('saves from different pages', () => {
  beforeEach(() => fakeBrowser.reset());

  it('run one after another, so neither change is lost', async () => {
    // Node before 24 has no Web Locks: stand in with one shared queue.
    if (!globalThis.navigator?.locks) {
      let held: Promise<unknown> = Promise.resolve();
      const request = (_name: string, task: () => Promise<unknown>) => {
        const run = held.then(task);
        held = run.catch(() => {});
        return run;
      };
      vi.stubGlobal('navigator', {locks: {request}});
    }
    await store({scene: 'ember', clock: 'bold'});
    // A tab and the side panel: separate pages, each with its own copy.
    vi.resetModules();
    const tab = await import('./store');
    vi.resetModules();
    const panel = await import('./store');
    expect(tab).not.toBe(panel);
    await Promise.all([
      tab.saveSettings({scene: 'wave'}),
      panel.saveSettings({clock: 'minimal'}),
    ]);
    expect(await storedSettings()).toMatchObject({
      scene: 'wave',
      clock: 'minimal',
    });
    vi.unstubAllGlobals();
  });

  it('still run in order within one page without Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    try {
      await store({scene: 'ember', clock: 'bold'});
      await Promise.all([
        saveSettings({scene: 'wave'}),
        saveSettings({clock: 'minimal'}),
      ]);
      expect(await storedSettings()).toMatchObject({
        scene: 'wave',
        clock: 'minimal',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('a refused save', () => {
  const seen = problems();
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('goes along with the next save', async () => {
    await store({scene: 'ember'});
    refuse(1);
    await saveSettings({scene: 'wave'});
    expect((await storedSettings()).scene).toBe('ember');
    await saveSettings({clock: 'bold'});
    expect(await storedSettings()).toMatchObject({
      scene: 'wave',
      clock: 'bold',
    });
    // Stored: no retry left waiting.
    await vi.runAllTimersAsync();
    expect(seen).toEqual([]);
  });

  it('is tried again on its own a moment later', async () => {
    await store({scene: 'ember'});
    refuse(1);
    await saveSettings({scene: 'wave'});
    await vi.advanceTimersByTimeAsync(RETRY_MS[0]);
    expect((await storedSettings()).scene).toBe('wave');
    expect(seen).toEqual([]);
  });

  it('is dropped and reported once when it keeps failing', async () => {
    await store({scene: 'ember'});
    refuse(1 + RETRY_MS.length);
    await saveSettings({scene: 'wave'});
    await vi.runAllTimersAsync();
    expect(seen).toEqual(['failed']);
    expect((await storedSettings()).scene).toBe('ember');
    // Not carried into a later change any more: the page shows what's stored.
    await saveSettings({clock: 'bold'});
    expect(await storedSettings()).toMatchObject({
      scene: 'ember',
      clock: 'bold',
    });
  });

  it('in a page older than the installed Tarn asks for a reload', async () => {
    await store({scene: 'ember'});
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockRejectedValue(
      new Error('Extension context invalidated.'),
    );
    refuse(1, 'Extension context invalidated.');
    const shown = await saveSettings({scene: 'wave'});
    // The page still shows the change, with what it last read.
    expect(shown.scene).toBe('wave');
    await vi.runAllTimersAsync();
    expect(seen).toEqual(['stale']);
  });

  it('makes an import fail instead of saying it worked', async () => {
    await store({scene: 'ember'});
    refuse(1);
    await expect(replaceSettings({scene: 'wave'})).rejects.toThrow();
    refuse(1);
    await expect(restoreBackup({scene: 'wave'})).rejects.toThrow();
    expect((await storedSettings()).scene).toBe('ember');
  });
});
