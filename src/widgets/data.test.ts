/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {loadWidgetData, saveWidgetData} from './data';

/** A plain in-memory localStorage, as a page has. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: key => items.get(key) ?? null,
    key: index => [...items.keys()][index] ?? null,
    removeItem: key => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

const asText = (raw: unknown) => (typeof raw === 'string' ? raw : '');

describe('widget content', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.stubGlobal('localStorage', memoryStorage());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads what was saved', async () => {
    await saveWidgetData('notes-a', 'Buy milk');
    expect(await loadWidgetData('notes-a', asText)).toBe('Buy milk');
  });

  it('keeps the newest content when a save never reached storage', async () => {
    await saveWidgetData('weather-a', 'Tokyo');
    // The next save fails (an old tab after an update, a full store).
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(
      new Error('Extension context invalidated.'),
    );
    await saveWidgetData('weather-a', 'Lisbon');
    // A new tab loads Lisbon, not the older stored Tokyo, and stores it.
    expect(await loadWidgetData('weather-a', asText)).toBe('Lisbon');
    const stored = await fakeBrowser.storage.local.get('widget.weather-a');
    expect(stored['widget.weather-a']).toBe('Lisbon');
    expect(localStorage.getItem('tarn.widget.weather-a.pending')).toBeNull();
  });

  it('trusts storage when every save landed', async () => {
    await saveWidgetData('notes-b', 'One');
    // Another computer's copy, or a stale mirror: storage wins.
    localStorage.setItem('tarn.widget.notes-b', JSON.stringify('Old'));
    expect(await loadWidgetData('notes-b', asText)).toBe('One');
  });
});
