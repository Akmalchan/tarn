/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';

/**
 * Why a change wasn't stored. `failed`: storage kept refusing it (full, or
 * over sync's write quota) after the retries. `stale`: this page belongs
 * to a Tarn that has since been updated (or reloaded in development), so
 * every storage call fails until the page is reloaded.
 */
export type SaveProblem = 'failed' | 'stale';

type Listener = (problem: SaveProblem) => void;

const listeners = new Set<Listener>();
let stale = false;
let channel: BroadcastChannel | null | undefined;

/**
 * Every Tarn page hears of a failed save, so the side panel can say so
 * when a tab's change (a widget dragged in edit mode) was refused.
 */
function shared(): BroadcastChannel | null {
  channel ??=
    typeof BroadcastChannel === 'function'
      ? new BroadcastChannel('tarn.save')
      : null;
  return channel;
}

/** Whether `error` came from a page that outlived its extension. */
export function contextGone(error: unknown): boolean {
  let id: string | undefined;
  try {
    id = browser?.runtime?.id;
  } catch {
    id = undefined;
  }
  return !id || /context invalidated/i.test(String(error));
}

export function reportSaveProblem(problem: SaveProblem): void {
  if (problem === 'stale') {
    // Only this page is out of date; others run the new version.
    if (stale) return;
    stale = true;
  } else {
    shared()?.postMessage(problem);
  }
  for (const listener of listeners) listener(problem);
}

/** Calls `listener` when a save is refused here, or fails in another page. */
export function watchSaveProblems(listener: Listener): () => void {
  listeners.add(listener);
  const onMessage = (event: MessageEvent) => {
    if (event.data === 'failed') listener('failed');
  };
  shared()?.addEventListener('message', onMessage);
  if (stale) listener('stale');
  return () => {
    listeners.delete(listener);
    channel?.removeEventListener('message', onMessage);
  };
}
