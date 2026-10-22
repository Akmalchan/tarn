/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// localStorage and sessionStorage, guarded. Either can be missing (a
// worker), blocked (private mode, blocked site data) or full; none of that
// is fatal anywhere in Tarn, so a read gives nothing and a write reports
// false. Imports nothing, so the blocking first-paint script can use it.

export type WebStorageArea = 'local' | 'session';

function storage(area: WebStorageArea): Storage {
  return area === 'session' ? sessionStorage : localStorage;
}

/** The text under `key`, or null: none, or no storage. */
export function readText(
  key: string,
  area: WebStorageArea = 'local',
): string | null {
  try {
    return storage(area).getItem(key);
  } catch {
    return null;
  }
}

/** Stores `value` under `key`; false if it couldn't be (blocked or full). */
export function writeText(
  key: string,
  value: string,
  area: WebStorageArea = 'local',
): boolean {
  try {
    storage(area).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string, area: WebStorageArea = 'local'): void {
  try {
    storage(area).removeItem(key);
  } catch {
    // No storage: nothing there to remove.
  }
}

/**
 * The JSON under `key`, or undefined: none, not JSON, or no storage.
 * Never trusted: callers check its shape.
 */
export function readJson(key: string, area: WebStorageArea = 'local'): unknown {
  const raw = readText(key, area);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Stores `value` as JSON under `key`; false if it couldn't be. */
export function writeJson(
  key: string,
  value: unknown,
  area: WebStorageArea = 'local',
): boolean {
  try {
    storage(area).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
