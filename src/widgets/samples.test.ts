/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {layoutBands} from '../layout/bands';
import {WIDGET_SIZE_OPTIONS, type WidgetEntry} from '../settings/schema';
import {SETTINGS_KEY} from '../settings/store';
import {
  EXAMPLES,
  buildExample,
  forgetOwnWidgets,
  ownWidgets,
  pruneSamples,
  rememberOwnWidgets,
} from './samples';

describe('example setups', () => {
  for (const example of EXAMPLES) {
    describe(example.name, () => {
      it('has at most nine widgets, each kind once', () => {
        const kinds = example.widgets.map(([kind]) => kind);
        expect(kinds.length).toBeLessThanOrEqual(9);
        expect(new Set(kinds).size).toBe(kinds.length);
      });

      it('asks only for sizes each kind offers', () => {
        for (const [kind, size] of example.widgets) {
          expect(WIDGET_SIZE_OPTIONS[kind]).toContain(size);
        }
      });

      it('leaves no holes at 4 or 6 columns', () => {
        const items = example.widgets.map(([kind, size]) => ({id: kind, size}));
        for (const columns of [4, 6]) {
          const {placements, bands, heights} = layoutBands(items, columns);
          // Every band but the last is full.
          for (let band = 0; band < bands.length - 1; band++) {
            const filled = placements
              .filter(p => p.band === band)
              .reduce((sum, p) => sum + p.w * p.h, 0);
            expect(filled, `band ${band} at ${columns}`).toBe(
              bands[band]! * heights[band]!,
            );
          }
        }
      });
    });
  }
});

describe("the user's own widgets while trying examples", () => {
  beforeEach(() => fakeBrowser.reset());

  const MINE: WidgetEntry[] = [
    {id: 'notes-a', kind: 'notes', size: 'm', name: 'Plans'},
    {id: 'tasks-b', kind: 'tasks', size: 'l'},
  ];
  const EXAMPLE: WidgetEntry[] = [
    {id: 'favorites-x', kind: 'favorites', size: 'l'},
  ];

  it('keeps the list from before the first example, through later ones', async () => {
    expect(await ownWidgets()).toBeNull();
    await rememberOwnWidgets(MINE);
    // A second example: what's shown now is the first example, not theirs.
    await rememberOwnWidgets(EXAMPLE);
    expect(await ownWidgets()).toEqual(MINE);
  });

  it('keeps an empty list, the user\'s own "none"', async () => {
    await rememberOwnWidgets([]);
    expect(await ownWidgets()).toEqual([]);
  });

  it('forgets it once they keep an example or go back', async () => {
    await rememberOwnWidgets(MINE);
    await forgetOwnWidgets();
    expect(await ownWidgets()).toBeNull();
    await rememberOwnWidgets(EXAMPLE);
    expect(await ownWidgets()).toEqual(EXAMPLE);
  });

  it('never trusts what is stored', async () => {
    await fakeBrowser.storage.local.set({
      'examples.own': [{id: 'notes-a', kind: 'notes', size: 'm'}, 'junk', {}],
    });
    expect(await ownWidgets()).toEqual([
      {id: 'notes-a', kind: 'notes', size: 'm'},
    ]);
    await fakeBrowser.storage.local.set({'examples.own': 'junk'});
    expect(await ownWidgets()).toBeNull();
  });
});

describe("examples' sample content", () => {
  beforeEach(() => fakeBrowser.reset());

  const content = async (id: string) =>
    (await fakeBrowser.storage.local.get(`widget.${id}`))[`widget.${id}`];

  it('goes once its widgets are gone, unless it was changed', async () => {
    const [favorites, notes, tasks] = await buildExample(EXAMPLES[1]!.widgets);
    expect(await content(notes!.id)).toBeTypeOf('string');
    await fakeBrowser.storage.local.set({[`widget.${tasks!.id}`]: ['Mine']});
    await pruneSamples([]);
    expect(await content(favorites!.id)).toBeUndefined();
    expect(await content(notes!.id)).toBeUndefined();
    // Changed: the user's now, kept like any removed widget's content.
    expect(await content(tasks!.id)).toEqual(['Mine']);
  });

  it('stays while anything could still show it', async () => {
    const shown = await buildExample(EXAMPLES[0]!.widgets);
    const undo = await buildExample(EXAMPLES[1]!.widgets);
    const kept = await buildExample(EXAMPLES[2]!.widgets);
    const stored = await buildExample(EXAMPLES[3]!.widgets);
    await rememberOwnWidgets(kept);
    await fakeBrowser.storage.sync.set({[SETTINGS_KEY]: {widgets: stored}});
    // The panel shows `shown`; its Undo would bring back `undo`.
    await pruneSamples([...shown, ...undo]);
    for (const widget of [...shown, ...undo, ...kept, ...stored]) {
      if (widget.kind === 'notes') {
        expect(await content(widget.id)).toBeTypeOf('string');
      }
    }
  });

  it("never touches the user's own content", async () => {
    await fakeBrowser.storage.local.set({'widget.notes-mine': 'Plans'});
    await buildExample(EXAMPLES[1]!.widgets);
    await pruneSamples([]);
    expect(await content('notes-mine')).toBe('Plans');
  });
});
