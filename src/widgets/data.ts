/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';
import {
  readJson,
  readText,
  removeKey,
  writeJson,
  writeText,
} from '../app/web-storage';
import {contextGone, reportSaveProblem} from '../settings/problems';
import {startContent} from './start';

// A widget's content (notes text, favorite sites, timer state) lives in
// local storage under its own key, apart from the synced settings: content
// can outgrow sync's 8 KB per-item quota, and typing must never hit sync's
// write limits. Removing a widget keeps its content, so nothing is lost
// (only an example setup's untouched sample content is ever deleted,
// samples.ts).

const key = (id: string) => `widget.${id}`;
/**
 * A copy in localStorage, read synchronously when a page opens, so widgets
 * show their content in the first frame (storage.local answers a few ms
 * later, after a blank frame).
 */
const mirrorKey = (id: string) => `tarn.widget.${id}`;
/**
 * Set while a save to storage.local is under way, cleared once it lands.
 * Left behind, it means storage.local missed the newest content (the save
 * failed: an old tab after an update, a full store), and the mirror holds
 * it. Without this, the next tab loaded the older stored value and a city
 * or a note seemed to reset (seen 2026-10-19). It holds the latest save's
 * own token, so a save landing in one tab can't clear a newer one from
 * another tab that may still fail.
 */
const pendingKey = (id: string) => `tarn.widget.${id}.pending`;

function pending(id: string): boolean {
  return readText(pendingKey(id)) !== null;
}

/** Marks a save under way; returns its token for `landed`. */
function setPending(id: string): string {
  const token = Math.random().toString(36).slice(2);
  // Blocked storage: nothing to remember it in.
  writeText(pendingKey(id), token);
  return token;
}

/** The save with `token` reached storage; clears the flag if it's still its. */
function landed(id: string, token: string): void {
  if (readText(pendingKey(id)) === token) removeKey(pendingKey(id));
}

/** The mirror's content, or undefined when there is none. */
function mirrored(id: string): unknown {
  return readJson(mirrorKey(id));
}

/** The widget's content as last saved, read at once; may be slightly stale. */
export function peekWidgetData<T>(
  id: string,
  normalize: (raw: unknown) => T,
): T {
  const raw = mirrored(id);
  return normalize(raw === undefined ? startContent(id) : raw);
}

function mirror(id: string, value: unknown): void {
  // Too big or blocked: the widget just loads a moment later.
  writeJson(mirrorKey(id), value);
}

function localArea() {
  return typeof browser !== 'undefined' && browser?.storage
    ? browser.storage.local
    : null;
}

/** Loads a widget's content; `normalize` turns anything stored into a valid value. */
export async function loadWidgetData<T>(
  id: string,
  normalize: (raw: unknown) => T,
): Promise<T> {
  const area = localArea();
  if (!area) return normalize(startContent(id));
  // A save that never reached storage.local: the mirror has the newest
  // content. Keep it, and store it now.
  const unsaved = pending(id) ? mirrored(id) : undefined;
  if (unsaved !== undefined) {
    await saveWidgetData(id, unsaved);
    return normalize(unsaved);
  }
  const stored = await area.get(key(id));
  const value: unknown = stored[key(id)];
  // Never saved: a start widget's first content (start.ts), not stored.
  if (value === undefined) return normalize(startContent(id));
  mirror(id, value);
  return normalize(value);
}

/**
 * Whether the widget holds content of its own yet, rather than the start
 * content (start.ts), from the first-paint copy; may be slightly stale.
 */
export function peekWidgetDataStored(id: string): boolean {
  return readText(mirrorKey(id)) !== null;
}

/** Whether the widget holds content of its own yet. */
export async function widgetDataStored(id: string): Promise<boolean> {
  const area = localArea();
  if (!area) return peekWidgetDataStored(id);
  const stored = await area.get(key(id));
  return stored[key(id)] !== undefined;
}

export async function saveWidgetData(
  id: string,
  value: unknown,
): Promise<void> {
  mirror(id, value);
  const token = setPending(id);
  try {
    await localArea()?.set({[key(id)]: value});
    landed(id, token);
  } catch (error) {
    // Stays pending: the next load stores the mirror's copy.
    console.warn('[tarn] widget not saved:', error);
    if (contextGone(error)) reportSaveProblem('stale');
  }
}

/**
 * Deletes a widget's content and its first-paint copy. Only for content
 * nobody wrote (an example's untouched samples): removing a widget keeps
 * its content.
 */
export async function deleteWidgetData(id: string): Promise<void> {
  removeKey(mirrorKey(id));
  removeKey(pendingKey(id));
  await localArea()?.remove(key(id));
}

/** Calls `listener` when the widget's content changes in another tab. */
export function watchWidgetData<T>(
  id: string,
  normalize: (raw: unknown) => T,
  listener: (value: T) => void,
): () => void {
  const storage = typeof browser !== 'undefined' ? browser?.storage : undefined;
  if (!storage) return () => {};
  const onChanged = (
    changes: Record<string, {newValue?: unknown}>,
    areaName: string,
  ) => {
    if (areaName === 'local' && key(id) in changes) {
      listener(normalize(changes[key(id)]!.newValue));
    }
  };
  storage.onChanged.addListener(onChanged);
  return () => storage.onChanged.removeListener(onChanged);
}

/** Runs `save` once typing pauses for `ms`. */
export function debounce<A extends unknown[]>(
  save: (...args: A) => void,
  ms: number,
): ((...args: A) => void) & {flush: () => void} {
  let timer = 0;
  let pending: A | null = null;
  const run = (...args: A) => {
    pending = args;
    clearTimeout(timer);
    timer = window.setTimeout(flush, ms);
  };
  const flush = () => {
    clearTimeout(timer);
    if (pending) save(...pending);
    pending = null;
  };
  return Object.assign(run, {flush});
}
