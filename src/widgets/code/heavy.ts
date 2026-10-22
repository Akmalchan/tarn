/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

/**
 * Custom widgets this computer's GPU couldn't run: paused for being too
 * heavy, or blamed for a lost context. Remembered per widget on this
 * computer (localStorage `tarn.code.heavy.<id>` = a hash of its code), so
 * every new tab starts it paused with Run anyway instead of hanging the
 * GPU again. Other code, Run anyway, or an edit forgets it.
 */

const PREFIX = 'tarn.code.heavy.';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A short fingerprint of the code (FNV-1a), not for security. */
export function codeHash(code: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    hash = Math.imul(hash ^ code.charCodeAt(i), 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}.${code.length}`;
}

/** True if this widget's code was too heavy here; a mark for other code goes. */
export function isHeavy(
  widgetId: string,
  code: string,
  store = localStore(),
): boolean {
  try {
    const mark = store?.getItem(PREFIX + widgetId);
    if (!mark) return false;
    if (mark === codeHash(code)) return true;
    store?.removeItem(PREFIX + widgetId);
  } catch {
    // Blocked storage: nothing is remembered.
  }
  return false;
}

export function markHeavy(
  widgetId: string,
  code: string,
  store = localStore(),
): void {
  try {
    store?.setItem(PREFIX + widgetId, codeHash(code));
  } catch {
    // Blocked storage: each tab finds out again.
  }
}

export function forgetHeavy(widgetId: string, store = localStore()): void {
  try {
    store?.removeItem(PREFIX + widgetId);
  } catch {
    // Blocked storage: nothing was remembered.
  }
}

function localStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
