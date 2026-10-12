/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Only one extension can own the new tab page; the browser picks the most
// recently enabled one. Tarn can switch other new-tab extensions off (with
// the user's explicit choice and the optional `management` permission) and
// switch them back on when Tarn itself is turned off.

import {browser} from 'wxt/browser';

const PERMISSION: Parameters<typeof browser.permissions.request>[0] = {
  permissions: ['management'],
};
const STATE_KEY = 'takeover.v1';

/** Words that new-tab extensions almost always use to describe themselves. */
const NEW_TAB_HINT =
  /new\s?tab|start\s?page|homepage|home page|dashboard|speed\s?dial/i;

export interface Rival {
  readonly id: string;
  readonly name: string;
  readonly iconUrl?: string;
  /** Looks like it overrides the new tab page; preselected in the UI. */
  readonly likelyNewTab: boolean;
}

export const canManageRivals = !import.meta.env.FIREFOX;

export function hasManagePermission(): Promise<boolean> {
  return browser.permissions.contains(PERMISSION);
}

/** Must be called from a user gesture. */
export function requestManagePermission(): Promise<boolean> {
  return browser.permissions.request(PERMISSION);
}

/** Enabled extensions other than Tarn, likely new-tab ones first. */
export async function listRivals(): Promise<Rival[]> {
  const self = browser.runtime.id;
  const all = await browser.management.getAll();
  return all
    .filter(e => e.enabled && e.type === 'extension' && e.id !== self)
    .map(e => ({
      id: e.id,
      name: e.name,
      iconUrl: e.icons?.at(-1)?.url,
      likelyNewTab: NEW_TAB_HINT.test(`${e.name} ${e.description}`),
    }))
    .sort(
      (a, b) =>
        Number(b.likelyNewTab) - Number(a.likelyNewTab) ||
        a.name.localeCompare(b.name),
    );
}

/**
 * The extensions Tarn switched off for the user, kept even after they are
 * switched back on, so toggling Tarn is one click in both directions.
 */
interface TakeoverState {
  ids: string[];
  off: boolean;
}

/** Switches the given extensions off and remembers them. */
export async function disableRivals(ids: readonly string[]): Promise<void> {
  const state = await loadState();
  for (const id of ids) await setEnabledIfInstalled(id, false);
  await saveState({ids: [...new Set([...state.ids, ...ids])], off: true});
}

/** Switches remembered extensions back on (Tarn was turned off). */
export async function restoreRivals(): Promise<void> {
  const state = await loadState();
  if (!state.off || !(await hasManagePermission())) return;
  for (const id of state.ids) await setEnabledIfInstalled(id, true);
  await saveState({...state, off: false});
}

/** Switches remembered extensions off again (Tarn was turned back on). */
export async function reapplyRivals(): Promise<void> {
  const state = await loadState();
  if (state.off || !state.ids.length || !(await hasManagePermission())) return;
  for (const id of state.ids) await setEnabledIfInstalled(id, false);
  await saveState({...state, off: true});
}

async function setEnabledIfInstalled(
  id: string,
  enabled: boolean,
): Promise<void> {
  try {
    await browser.management.setEnabled(id, enabled);
  } catch {
    // Uninstalled since; nothing to do.
  }
}

async function loadState(): Promise<TakeoverState> {
  const stored = (await browser.storage.local.get(STATE_KEY))[STATE_KEY];
  const value = (stored ?? {}) as Partial<TakeoverState>;
  return {
    ids: Array.isArray(value.ids)
      ? value.ids.filter((id): id is string => typeof id === 'string')
      : [],
    off: value.off === true,
  };
}

function saveState(state: TakeoverState): Promise<void> {
  return browser.storage.local.set({[STATE_KEY]: state});
}
