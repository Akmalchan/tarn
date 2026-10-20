/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

/**
 * Stored settings carry the version of their shape. A change that renames
 * or moves a value bumps SETTINGS_VERSION and adds one step below that
 * converts the old shape, so an update never resets anyone's setup.
 * Settings written by a newer Tarn (a higher version, e.g. synced from
 * another computer) are read as they are and never downgraded.
 */
export const SETTINGS_VERSION = 1;

type Stored = Record<string, unknown>;

/** STEPS[n] upgrades version n + 1 to n + 2. None yet. */
const STEPS: ReadonlyArray<(stored: Stored) => Stored> = [];

export function storedVersion(stored: Stored): number {
  const version = stored.version;
  return typeof version === 'number' && Number.isInteger(version) && version > 0
    ? version
    : 1;
}

/** The stored object in the current shape; everything unknown is kept. */
export function migrateSettings(raw: unknown): Stored {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  let stored = raw as Stored;
  for (let v = storedVersion(stored); v < SETTINGS_VERSION; v++) {
    stored = {...STEPS[v - 1]!(stored), version: v + 1};
  }
  return stored;
}
