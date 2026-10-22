/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';
import {readJson, writeJson} from '../app/web-storage';
import type {BookmarkNode, Item} from './favorites-model';

// The browser's own bookmarks bar, shown in a Bookmarks widget until the
// user makes the widget their own (the `bookmarks` permission, owner's
// decision 2026-10-14: the first new tab shows your bar with no setup).
// Tarn only reads it; nothing leaves the computer.

/** Chrome's bookmarks bar, and Firefox's bookmarks toolbar. */
const BAR_IDS = ['1', 'toolbar_____'];

/** The bar as last shown, for a reload's first frame. */
const BAR_KEY = 'tarn.bookmarksBar';

function api() {
  return typeof browser !== 'undefined' ? browser?.bookmarks : undefined;
}

/**
 * The bookmarks bar's top-level nodes, or null if there's no access. Reads
 * just the bar, on every new tab: 0.2 ms at 5,000 bookmarks, where the
 * whole tree took 11 ms (audit, 2026-10-20).
 */
export async function readBookmarksBar(): Promise<BookmarkNode[] | null> {
  const bookmarks = api();
  if (!bookmarks?.getTree) return null;
  for (const id of BAR_IDS) {
    try {
      const [bar] = await bookmarks.getSubTree(id);
      if (bar) return bar.children ?? [];
    } catch {
      // Not this browser's bar id.
    }
  }
  try {
    // A browser with another id: its first top-level folder is the bar.
    const [root] = await bookmarks.getTree();
    return root?.children?.[0]?.children ?? [];
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
  return readJson(BAR_KEY) ?? null;
}

export function rememberBookmarksBar(items: readonly Item[]): void {
  // Too big or blocked: a reload just fills in a moment later.
  writeJson(BAR_KEY, items);
}
