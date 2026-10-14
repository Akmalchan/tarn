/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {browser} from 'wxt/browser';
import type {BookmarkNode, Item} from './favorites-model';

// The browser's own bookmarks bar, shown in a Bookmarks widget until the
// user makes the widget their own (the `bookmarks` permission, owner's
// decision 2026-10-14: the first new tab shows your bar with no setup).
// Tarn only reads it; nothing leaves the computer.

/** Chrome's bookmarks bar, and Firefox's bookmarks toolbar. */
const BAR_IDS = new Set(['1', 'toolbar_____']);

/** The bar as last shown, for a reload's first frame. */
const BAR_KEY = 'tarn.bookmarksBar';

function api() {
  return typeof browser !== 'undefined' ? browser?.bookmarks : undefined;
}

/** The bookmarks bar's top-level nodes, or null if there's no access. */
export async function readBookmarksBar(): Promise<BookmarkNode[] | null> {
  const bookmarks = api();
  if (!bookmarks?.getTree) return null;
  try {
    const [root] = await bookmarks.getTree();
    const folders = root?.children ?? [];
    const bar = folders.find(node => BAR_IDS.has(node.id)) ?? folders[0];
    return bar?.children ?? [];
  } catch {
    return null;
  }
}

/** Calls `listener` (at most every 150 ms) whenever bookmarks change. */
export function watchBookmarks(listener: () => void): () => void {
  const bookmarks = api();
  if (!bookmarks) return () => {};
  let timer = 0;
  const changed = () => {
    clearTimeout(timer);
    timer = window.setTimeout(listener, 150);
  };
  const events = [
    bookmarks.onCreated,
    bookmarks.onRemoved,
    bookmarks.onChanged,
    bookmarks.onMoved,
    bookmarks.onChildrenReordered,
  ].filter(event => event?.addListener);
  for (const event of events) event.addListener(changed);
  return () => {
    clearTimeout(timer);
    for (const event of events) event.removeListener(changed);
  };
}

/** The bar's items as last shown, read at once (null if never). */
export function lastBookmarksBar(): unknown {
  try {
    const raw = localStorage.getItem(BAR_KEY);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function rememberBookmarksBar(items: readonly Item[]): void {
  try {
    localStorage.setItem(BAR_KEY, JSON.stringify(items));
  } catch {
    // Too big or blocked: a reload just fills in a moment later.
  }
}
