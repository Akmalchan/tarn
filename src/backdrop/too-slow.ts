/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

/**
 * Scenes this computer couldn't keep up with: still choppy at the lowest
 * quality level (`QualityGovernor.cantKeepUp`). Remembered per scene on
 * this computer (localStorage `tarn.slow.<id>` = `{at, browser}`), so the
 * next new tab shows the scene's still picture at once instead of
 * stuttering for seconds first. Tried live again after a week, when the
 * browser is updated, or when the scene is picked again in settings.
 */

const PREFIX = 'tarn.slow.';
/** How long a mark holds before the live scene is tried again. */
export const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function tooSlowKey(sceneId: string): string {
  return PREFIX + sceneId;
}

/**
 * True if this scene couldn't keep up here lately, in this browser
 * version; a mark that no longer holds goes.
 */
export function isTooSlow(
  sceneId: string,
  now = Date.now(),
  browser = browserVersion(),
  store = localStore(),
): boolean {
  try {
    const raw = store?.getItem(tooSlowKey(sceneId));
    if (!raw) return false;
    const mark = parse(raw);
    if (
      mark &&
      mark.browser === browser &&
      now >= mark.at &&
      now - mark.at < RETRY_AFTER_MS
    ) {
      return true;
    }
    store?.removeItem(tooSlowKey(sceneId));
  } catch {
    // Blocked storage: nothing is remembered.
  }
  return false;
}

export function markTooSlow(
  sceneId: string,
  now = Date.now(),
  browser = browserVersion(),
  store = localStore(),
): void {
  try {
    store?.setItem(tooSlowKey(sceneId), JSON.stringify({at: now, browser}));
  } catch {
    // Blocked storage: each tab finds out again.
  }
}

/** The scene was picked again: the next page tries it live. */
export function forgetTooSlow(sceneId: string, store = localStore()): void {
  try {
    store?.removeItem(tooSlowKey(sceneId));
  } catch {
    // Blocked storage: nothing was remembered.
  }
}

function parse(raw: string): {at: number; browser: string} | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const {at, browser} = value as {[key: string]: unknown};
    return typeof at === 'number' &&
      Number.isFinite(at) &&
      typeof browser === 'string'
      ? {at, browser}
      : null;
  } catch {
    return null;
  }
}

/** Changes when the browser is updated (its version is in the string). */
function browserVersion(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function localStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
