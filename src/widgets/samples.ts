/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {html} from 'lit';
import type {WidgetSize} from '../layout/bands';
import {
  WIDGET_KINDS,
  newWidgetId,
  type WidgetEntry,
  type WidgetKind,
} from '../settings/schema';
import {saveWidgetData} from './data';

// Test layouts for development: one click fills the page with a few or many
// widgets, with real-looking content, to check the layout at every count.
// Only the side panel of a dev build loads this module.

const SAMPLE_SITES = [
  'github.com',
  'youtube.com',
  'mail.google.com',
  'news.ycombinator.com',
  'figma.com',
  'notion.so',
  'wikipedia.org',
  'reddit.com',
  'calendar.google.com',
  'chatgpt.com',
].map(host => ({url: `https://${host}/`}));

const SAMPLE_NOTES = [
  'Call the landlord\nCS 413 project due Friday\nBuy oat milk\nRead chapter 7',
  'Ideas\n- Tarn widgets: weather, calendar\n- Ask Sam about the demo',
  'Gym 6 pm\nLaundry\nReply to recruiter',
];

type Preset = ReadonlyArray<readonly [WidgetKind, WidgetSize]>;

export const TEST_LAYOUTS: Readonly<Record<string, Preset>> = {
  '1': [['favorites', 'l']],
  '3': [
    ['favorites', 'l'],
    ['focus', 's'],
    ['notes', 's'],
  ],
  '5': [
    ['favorites', 'l'],
    ['focus', 's'],
    ['notes', 's'],
    ['notes', 'm'],
    ['focus', 'm'],
  ],
  '9': [
    ['favorites', 'xl'],
    ['notes', 'l'],
    ['focus', 's'],
    ['focus', 's'],
    ['notes', 'l'],
    ['notes', 'm'],
    ['focus', 'm'],
    ['favorites', 's'],
    ['notes', 's'],
  ],
  '14': [
    ['favorites', 'xl'],
    ['notes', 'l'],
    ['focus', 's'],
    ['notes', 's'],
    ['focus', 'l'],
    ['notes', 'm'],
    ['focus', 'm'],
    ['favorites', 'l'],
    ['notes', 'xl'],
    ['focus', 's'],
    ['favorites', 's'],
    ['notes', 'm'],
    ['focus', 'm'],
    ['notes', 's'],
  ],
};

const SIZES: readonly WidgetSize[] = ['s', 's', 'm', 'm', 'l', 'xl'];

/** A random mix, for spotting layouts nobody thought of. */
export function randomLayout(): Preset {
  const count = 2 + Math.floor(Math.random() * 12);
  return Array.from({length: count}, () => {
    const kind = WIDGET_KINDS[Math.floor(Math.random() * WIDGET_KINDS.length)]!;
    const size = SIZES[Math.floor(Math.random() * SIZES.length)]!;
    return [kind, size] as const;
  });
}

/** Creates the widgets and fills them with sample content. */
export async function buildTestLayout(preset: Preset): Promise<WidgetEntry[]> {
  const widgets = preset.map(([kind, size]) => ({
    id: newWidgetId(kind),
    kind,
    size,
  }));
  await Promise.all(
    widgets.map((widget, i) => {
      if (widget.kind === 'notes') {
        return saveWidgetData(widget.id, SAMPLE_NOTES[i % SAMPLE_NOTES.length]);
      }
      if (widget.kind === 'favorites') {
        const count = widget.size === 's' ? 3 : widget.size === 'm' ? 5 : 8;
        return saveWidgetData(widget.id, SAMPLE_SITES.slice(0, count));
      }
      return Promise.resolve();
    }),
  );
  return widgets;
}

/** The side panel's "Test layouts" row; `apply` receives the new widgets. */
export function testLayouts(apply: (widgets: WidgetEntry[]) => void) {
  const use = async (preset: Preset) => apply(await buildTestLayout(preset));
  return html`
    <section aria-labelledby="test">
      <h2 id="test">Test layouts (dev only)</h2>
      <div class="add">
        ${Object.entries(TEST_LAYOUTS).map(
          ([name, preset]) =>
            html`<button @click=${() => use(preset)}>${name}</button>`,
        )}
        <button @click=${() => use(randomLayout())}>Random</button>
        <button @click=${() => apply([])}>Clear</button>
      </div>
    </section>
  `;
}
