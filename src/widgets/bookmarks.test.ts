/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, describe, expect, it, vi} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {readBookmarksBar} from './bookmarks';

interface Node {
  id: string;
  title: string;
  url?: string;
  children?: Node[];
}

const link = (id: string, title: string): Node => ({
  id,
  title,
  url: `https://${title}.example/`,
});

describe('readBookmarksBar', () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads only Chrome's bar, never the whole tree", async () => {
    const bar = {id: '1', title: 'Bar', children: [link('5', 'a')]};
    const subTree = vi
      .spyOn(fakeBrowser.bookmarks, 'getSubTree')
      .mockResolvedValue([bar] as never);
    const tree = vi.spyOn(fakeBrowser.bookmarks, 'getTree');
    expect(await readBookmarksBar()).toEqual(bar.children);
    expect(subTree).toHaveBeenCalledWith('1');
    expect(tree).not.toHaveBeenCalled();
  });

  it("finds Firefox's toolbar", async () => {
    const toolbar = {
      id: 'toolbar_____',
      title: 'Toolbar',
      children: [link('x', 'b')],
    };
    vi.spyOn(fakeBrowser.bookmarks, 'getSubTree').mockImplementation(
      async id => {
        if (id === 'toolbar_____') return [toolbar] as never;
        throw new Error("Can't find bookmark for id.");
      },
    );
    expect(await readBookmarksBar()).toEqual(toolbar.children);
  });

  it("falls back to the tree's first folder, or null with no access", async () => {
    vi.spyOn(fakeBrowser.bookmarks, 'getSubTree').mockRejectedValue(
      new Error('no such id'),
    );
    const first = {id: 'b', title: 'Bar', children: [link('7', 'c')]};
    const tree = vi
      .spyOn(fakeBrowser.bookmarks, 'getTree')
      .mockResolvedValue([{id: '0', title: '', children: [first]}] as never);
    expect(await readBookmarksBar()).toEqual(first.children);
    tree.mockRejectedValue(new Error('no access'));
    expect(await readBookmarksBar()).toBeNull();
  });
});
