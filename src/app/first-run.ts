/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// The one first-run tip: a card above the settings gear on the first new
// tabs after a fresh install. Never after an update, and never on a
// computer whose settings already came through sync: that person knows
// Tarn. Kept in storage.local, so it is per computer and never exported.

import {browser} from 'wxt/browser';
import {SETTINGS_KEY} from '../settings/store';

export const TIP_KEY = 'tip.settings';

/** New tabs the tip shows on before it gives up by itself. */
export const TIP_TABS = 3;

interface Pending {
  shown: number;
}

/** Called by the background on a fresh install only. */
export async function markFirstRun(): Promise<void> {
  if (await hasSyncedSettings()) return;
  await browser.storage.local.set({[TIP_KEY]: {shown: 0} satisfies Pending});
}

/**
 * Whether this new tab should show the tip; counts it as shown. Settings
 * arriving through sync in the meantime retire it.
 */
export async function takeTip(): Promise<boolean> {
  const stored = (await browser.storage.local.get(TIP_KEY))[TIP_KEY] as
    Partial<Pending> | undefined;
  if (typeof stored !== 'object' || stored === null) return false;
  const shown = Number.isInteger(stored.shown) ? (stored.shown as number) : 0;
  if (shown >= TIP_TABS || (await hasSyncedSettings())) {
    await finishTip();
    return false;
  }
  await browser.storage.local.set({[TIP_KEY]: {shown: shown + 1}});
  return true;
}

/** Done for good: dismissed, or settings opened. */
export async function finishTip(): Promise<void> {
  await browser.storage.local.remove(TIP_KEY);
}

async function hasSyncedSettings(): Promise<boolean> {
  const stored = await browser.storage.sync.get(SETTINGS_KEY);
  return stored[SETTINGS_KEY] !== undefined;
}
