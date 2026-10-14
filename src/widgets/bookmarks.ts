/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {browser} from 'wxt/browser';
import type {BookmarkNode} from './favorites-model';

// "Use my bookmarks" in a Favorites widget: Tarn asks for the optional
// `bookmarks` permission at that moment (so installing shows no bookmarks
// warning), copies the bookmarks bar once, and gives the permission back.
// Nothing leaves the computer; the copies are ordinary favorites after.

/** Chrome's bookmarks bar, and Firefox's bookmarks toolbar. */
const BAR_IDS = new Set(['1', 'toolbar_____']);

/** Whether this browser can be asked for bookmarks at all. */
export function canReadBookmarks(): boolean {
  return typeof browser !== 'undefined' && !!browser?.permissions?.request;
}

/**
 * Asks for the permission and reads the bookmarks bar: its top-level
 * nodes, or null if the user said no. Call it straight from a click: the
 * browser only asks in response to one.
 */
export async function readBookmarksBar(): Promise<BookmarkNode[] | null> {
  const granted = await browser.permissions.request({
    permissions: ['bookmarks'],
  });
  if (!granted) return null;
  try {
    const [root] = await browser.bookmarks.getTree();
    const folders = root?.children ?? [];
    const bar = folders.find(node => BAR_IDS.has(node.id)) ?? folders[0];
    return bar?.children ?? [];
  } finally {
    // Read once: keep no standing access to the user's bookmarks.
    await browser.permissions
      .remove({permissions: ['bookmarks']})
      .catch(() => false);
  }
}
