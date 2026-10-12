/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {browser} from 'wxt/browser';
import {normalizeSettings, type Settings} from './schema';

/** Versioned key: a breaking schema change gets a new key plus a migration. */
export const SETTINGS_KEY = 'settings.v1';

type Listener = (settings: Settings) => void;

/** `storage.sync` follows the user across devices; it falls back to local when signed out. */
function syncArea() {
  return typeof browser !== 'undefined' && browser?.storage
    ? browser.storage.sync
    : null;
}

let memory: unknown;

export async function loadSettings(): Promise<Settings> {
  const area = syncArea();
  if (!area) return normalizeSettings(memory);
  const stored = await area.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

/**
 * Saves run one after another: each reads, merges and writes, so two quick
 * changes from different places (a tab and the side panel) can't overwrite
 * each other. A failed write (e.g. the sync quota of ~120 writes a minute)
 * keeps the in-memory result and the next save tries again.
 */
let saving: Promise<unknown> = Promise.resolve();

export function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const run = saving.then(async () => {
    const next = normalizeSettings({...(await loadSettings()), ...patch});
    const area = syncArea();
    if (!area) {
      memory = next;
      return next;
    }
    try {
      await area.set({[SETTINGS_KEY]: next});
    } catch (error) {
      console.warn('[tarn] settings not saved:', error);
    }
    return next;
  });
  saving = run.catch(() => {});
  return run;
}

/** Calls `listener` when settings change in any tab or on any synced device. */
export function watchSettings(listener: Listener): () => void {
  const storage = typeof browser !== 'undefined' ? browser?.storage : undefined;
  if (!storage) return () => {};
  const onChanged = (
    changes: Record<string, {newValue?: unknown}>,
    areaName: string,
  ) => {
    if (areaName === 'sync' && SETTINGS_KEY in changes) {
      listener(normalizeSettings(changes[SETTINGS_KEY].newValue));
    }
  };
  storage.onChanged.addListener(onChanged);
  return () => storage.onChanged.removeListener(onChanged);
}
