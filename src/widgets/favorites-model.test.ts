/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import {
  MAX_FOLDER_SITES,
  MAX_ITEMS,
  dropInto,
  fromBookmarks,
  isFolder,
  mergeImported,
  moveEntry,
  moveInFolder,
  normalizeItems,
  putSite,
  removeAt,
  renameFolder,
  takeOut,
  type Item,
  type Site,
} from './favorites-model';
import {startContent} from './start';

const site = (name: string): Site => ({
  url: `https://${name}.com/`,
  title: name,
});
const a = site('a');
const b = site('b');
const c = site('c');
const d = site('d');
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('normalizeItems', () => {
  it('reads content saved before folders existed', () => {
    expect(
      normalizeItems([
        {url: 'https://a.com/', title: 'a'},
        {url: 'b.com', title: ''},
      ]),
    ).toEqual([a, {url: 'https://b.com/', title: 'B'}]);
  });

  it('keeps the start setup valid', () => {
    const items = normalizeItems(startContent('favorites-start'));
    expect(items).toHaveLength(8);
    expect(items.every(item => !isFolder(item))).toBe(true);
  });

  it('reads folders and drops empty or broken ones', () => {
    expect(
      normalizeItems([
        {title: 'Work', sites: [a, {url: 'javascript:alert(1)'}, 7]},
        {title: 'Empty', sites: []},
        {title: 'Broken', sites: 'nope'},
        null,
        'x',
      ]),
    ).toEqual([{title: 'Work', sites: [a]}]);
  });

  it('never nests folders', () => {
    expect(
      normalizeItems([{title: 'Out', sites: [{title: 'In', sites: [a]}, b]}]),
    ).toEqual([{title: 'Out', sites: [b]}]);
  });

  it('keeps only small raster icons', () => {
    const [kept, svg, huge] = normalizeItems([
      {...a, icon: PNG},
      {...b, icon: 'data:image/svg+xml;base64,PHN2Zz4='},
      {...c, icon: `data:image/png;base64,${'A'.repeat(90_000)}`},
    ]) as Site[];
    expect(kept!.icon).toBe(PNG);
    expect(svg!.icon).toBeUndefined();
    expect(huge!.icon).toBeUndefined();
  });

  it('caps the number of items', () => {
    const many = Array.from({length: 80}, (_, i) => site(`s${i}`));
    expect(normalizeItems(many)).toHaveLength(MAX_ITEMS);
  });
});

describe('moving', () => {
  it('moves an entry', () => {
    expect(moveEntry([a, b, c], 0, 2)).toEqual([b, c, a]);
    expect(moveEntry([a, b, c], 2, 0)).toEqual([c, a, b]);
    expect(moveEntry([a, b, c], 1, 99)).toEqual([a, c, b]);
  });

  it('moves within a folder', () => {
    expect(moveInFolder([a, {title: 'F', sites: [b, c]}], 1, 0, 1)).toEqual([
      a,
      {title: 'F', sites: [c, b]},
    ]);
  });

  it('makes a folder from two sites, in the target’s place', () => {
    expect(dropInto([a, b, c], 2, 0, 'Folder')).toEqual([
      {title: 'Folder', sites: [a, c]},
      b,
    ]);
  });

  it('drops a site into a folder', () => {
    expect(dropInto([{title: 'F', sites: [a]}, b], 1, 0, 'x')).toEqual([
      {title: 'F', sites: [a, b]},
    ]);
  });

  it('never puts a folder in anything', () => {
    const items: Item[] = [{title: 'F', sites: [a]}, b];
    expect(dropInto(items, 0, 1, 'x')).toEqual(items);
  });

  it('does not overfill a folder', () => {
    const full = {
      title: 'F',
      sites: Array.from({length: MAX_FOLDER_SITES}, (_, i) => site(`f${i}`)),
    };
    expect(dropInto([full, a], 1, 0, 'x')).toEqual([full, a]);
  });

  it('takes a site out, right after its folder', () => {
    expect(takeOut([{title: 'F', sites: [a, b]}, c], 0, 0)).toEqual([
      {title: 'F', sites: [b]},
      a,
      c,
    ]);
  });

  it('removes a folder its last site leaves', () => {
    expect(takeOut([{title: 'F', sites: [a]}, c], 0, 0)).toEqual([a, c]);
    expect(
      removeAt([{title: 'F', sites: [a]}, c], {folder: 0, index: 0}),
    ).toEqual([c]);
  });

  it('renames a folder', () => {
    expect(renameFolder([{title: 'F', sites: [a]}], 0, '  School ')).toEqual([
      {title: 'School', sites: [a]},
    ]);
  });
});

describe('putSite', () => {
  const folder = {title: 'F', sites: [b, c]};

  it('adds a new site last', () => {
    expect(putSite([a], null, d, null)).toEqual([a, d]);
  });

  it('adds a new site to a folder', () => {
    expect(putSite([a, folder], null, d, 1)).toEqual([
      a,
      {title: 'F', sites: [b, c, d]},
    ]);
  });

  it('edits a site in place', () => {
    const edited = {...a, title: 'A!'};
    expect(
      putSite([a, folder], {folder: null, index: 0}, edited, null),
    ).toEqual([edited, folder]);
    const inner = {...c, icon: PNG};
    expect(putSite([a, folder], {folder: 1, index: 1}, inner, 1)).toEqual([
      a,
      {title: 'F', sites: [b, inner]},
    ]);
  });

  it('moves a site into a folder', () => {
    expect(putSite([a, folder], {folder: null, index: 0}, a, 1)).toEqual([
      {title: 'F', sites: [b, c, a]},
    ]);
  });

  it('moves a site out of a folder', () => {
    expect(putSite([a, folder], {folder: 1, index: 0}, b, null)).toEqual([
      a,
      {title: 'F', sites: [c]},
      b,
    ]);
  });

  it('turns a site into a new folder where it was', () => {
    expect(putSite([a, b], {folder: null, index: 0}, a, 'new', 'New')).toEqual([
      {title: 'New', sites: [a]},
      b,
    ]);
  });

  it('moves a folder’s last site to a new folder', () => {
    expect(
      putSite(
        [{title: 'F', sites: [a]}, b],
        {folder: 0, index: 0},
        a,
        'new',
        'N',
      ),
    ).toEqual([b, {title: 'N', sites: [a]}]);
  });
});

describe('bookmarks', () => {
  const bar = [
    {title: 'YouTube', url: 'https://www.youtube.com/'},
    {title: 'Bookmarklet', url: 'javascript:void(0)'},
    {title: 'Settings', url: 'chrome://settings'},
    {
      title: 'sfsu',
      children: [
        {title: 'Advising', url: 'https://advising.sfsu.edu/'},
        {
          title: 'Deeper',
          children: [{title: 'Bursar', url: 'https://bursar.sfsu.edu/'}],
        },
      ],
    },
    {title: 'Empty', children: []},
    {title: '', url: 'https://github.com/'},
  ];

  it('turns the bar into sites and folders', () => {
    expect(fromBookmarks(bar)).toEqual([
      {url: 'https://www.youtube.com/', title: 'YouTube'},
      {
        title: 'sfsu',
        sites: [
          {url: 'https://advising.sfsu.edu/', title: 'Advising'},
          {url: 'https://bursar.sfsu.edu/', title: 'Bursar'},
        ],
      },
      {url: 'https://github.com/', title: 'Github'},
    ]);
  });

  it('adds only what is new, filling folders of the same name', () => {
    const items: Item[] = [
      {url: 'https://www.youtube.com/', title: 'Mine'},
      {title: 'SFSU', sites: [{url: 'https://advising.sfsu.edu/', title: 'A'}]},
    ];
    expect(mergeImported(items, fromBookmarks(bar))).toEqual([
      {url: 'https://www.youtube.com/', title: 'Mine'},
      {
        title: 'SFSU',
        sites: [
          {url: 'https://advising.sfsu.edu/', title: 'A'},
          {url: 'https://bursar.sfsu.edu/', title: 'Bursar'},
        ],
      },
      {url: 'https://github.com/', title: 'Github'},
    ]);
  });
});
