/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {browser} from 'wxt/browser';
import {startContent} from './start';

// A widget's content (notes text, favorite sites, timer state) lives in
// local storage under its own key, apart from the synced settings: content
// can outgrow sync's 8 KB per-item quota, and typing must never hit sync's
// write limits. Removing a widget keeps its content, so nothing is lost.

const key = (id: string) => `widget.${id}`;
/**
 * A copy in localStorage, read synchronously when a page opens, so widgets
 * show their content in the first frame (storage.local answers a few ms
 * later, after a blank frame).
 */
const mirrorKey = (id: string) => `tarn.widget.${id}`;

/** The widget's content as last saved, read at once; may be slightly stale. */
export function peekWidgetData<T>(
  id: string,
  normalize: (raw: unknown) => T,
): T {
  try {
    const raw = localStorage.getItem(mirrorKey(id));
    return normalize(raw === null ? startContent(id) : JSON.parse(raw));
  } catch {
    return normalize(startContent(id));
  }
}

function mirror(id: string, value: unknown): void {
  try {
    localStorage.setItem(mirrorKey(id), JSON.stringify(value));
  } catch {
    // Too big or blocked: the widget just loads a moment later.
  }
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
  try {
    return localStorage.getItem(mirrorKey(id)) !== null;
  } catch {
    return false;
  }
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
  try {
    await localArea()?.set({[key(id)]: value});
  } catch (error) {
    console.warn('[tarn] widget not saved:', error);
  }
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
