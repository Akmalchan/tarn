/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {html} from 'lit';
import type {WidgetSize} from '../layout/bands';
import {
  WIDGET_KINDS,
  WIDGET_SIZE_OPTIONS,
  newWidgetId,
  type WidgetEntry,
  type WidgetKind,
} from '../settings/schema';
import {saveWidgetData} from './data';

// Test layouts for development: one click fills the page with a few or many
// widgets, with real-looking content, to check the layout at every count.
// Only the side panel of a dev build loads this module.

const site = (host: string, title: string) => ({
  url: `https://${host}/`,
  title,
});

/**
 * Sample favorites: GitHub and ChatGPT have white icons (dark chips), and
 * two folders, one like a student's bookmarks bar.
 */
const SAMPLE_FAVORITES = [
  site('www.youtube.com', 'YouTube'),
  site('github.com', 'GitHub'),
  site('chatgpt.com', 'ChatGPT'),
  site('mail.google.com', 'Gmail'),
  {
    title: 'sfsu',
    sites: [
      site('advising.sfsu.edu', 'Advising'),
      site('oip.sfsu.edu', 'Intl Programs'),
      site('career.sfsu.edu', 'Careers'),
      site('bursar.sfsu.edu', 'Bursar'),
      site('registrar.sfsu.edu', 'Registrar'),
      site('library.sfsu.edu', 'Library'),
      site('ilearn.sfsu.edu', 'iLearn'),
      site('cs.sfsu.edu', 'CompSci'),
      site('sfsu.edu', 'SF State'),
    ],
  },
  {
    title: 'Work',
    sites: [
      site('www.figma.com', 'Figma'),
      site('www.notion.so', 'Notion'),
      site('calendar.google.com', 'Calendar'),
      site('news.ycombinator.com', 'Hacker News'),
      site('jsfiddle.net', 'JSFiddle'),
    ],
  },
  site('www.wikipedia.org', 'Wikipedia'),
  site('www.reddit.com', 'Reddit'),
];

/** Smaller tiles get fewer items, the sfsu folder always among them. */
function sampleFavorites(size: WidgetSize) {
  if (size === 's')
    return [...SAMPLE_FAVORITES.slice(0, 3), SAMPLE_FAVORITES[4]];
  if (size === 'm') return SAMPLE_FAVORITES.slice(0, 6);
  return SAMPLE_FAVORITES;
}

const SAMPLE_NOTES = [
  'Call the landlord\nCS 413 project due Friday\nBuy oat milk\nRead chapter 7',
  'Ideas\n- Tarn widgets: weather, calendar\n- Ask Sam about the demo',
  'Gym 6 pm\nLaundry\nReply to recruiter',
];

type Preset = ReadonlyArray<readonly [WidgetKind, WidgetSize]>;

export const TEST_LAYOUTS: Readonly<Record<string, Preset>> = {
  '1': [['favorites', 'l']],
  // A large tile beside two stacked mediums: one clean 4-column band.
  '3': [
    ['favorites', 'l'],
    ['notes', 'm'],
    ['tasks', 'm'],
  ],
  // The start setup (START_WIDGETS): a large tile beside a medium over two
  // smalls.
  '4': [
    ['favorites', 'l'],
    ['notes', 'm'],
    ['weather', 's'],
    ['focus', 's'],
  ],
  // Two large tiles, then a medium over two smalls: one 6-column band.
  '5': [
    ['favorites', 'l'],
    ['tasks', 'l'],
    ['weather', 'm'],
    ['calendar', 's'],
    ['focus', 's'],
  ],
  '9': [
    ['favorites', 'xl'],
    ['notes', 'l'],
    ['focus', 's'],
    ['weather', 's'],
    ['tasks', 'l'],
    ['notes', 'm'],
    ['weather', 'm'],
    ['favorites', 's'],
    ['focus', 's'],
  ],
  '14': [
    ['favorites', 'xl'],
    ['notes', 'l'],
    ['focus', 's'],
    ['weather', 's'],
    ['weather', 'l'],
    ['tasks', 'm'],
    ['focus', 'm'],
    ['favorites', 'l'],
    ['notes', 'xl'],
    ['focus', 's'],
    ['favorites', 's'],
    ['notes', 'm'],
    ['tasks', 'm'],
    ['focus', 's'],
  ],
};

const SIZES: readonly WidgetSize[] = ['s', 's', 'm', 'm', 'l', 'xl'];

const SAMPLE_PLACES = [
  {name: 'Tashkent', detail: 'Uzbekistan', lat: 41.31, lon: 69.28},
  {name: 'Lisbon', detail: 'Portugal', lat: 38.72, lon: -9.14},
  {name: 'Tokyo', detail: 'Japan', lat: 35.69, lon: 139.69},
];

const SAMPLE_TASKS = [
  'Reply to Sam',
  'Book the dentist',
  'Water the plants',
  'Read chapter 4',
];

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
  // Presets test layout shapes, so sizes win: a kind that doesn't offer
  // the size is swapped for the next one that does (a small note becomes
  // a focus timer).
  const widgets = preset.map(([wanted, size], i) => {
    const kinds = [
      ...WIDGET_KINDS.slice(i % WIDGET_KINDS.length),
      ...WIDGET_KINDS,
    ];
    const kind = WIDGET_SIZE_OPTIONS[wanted].includes(size)
      ? wanted
      : kinds.find(k => WIDGET_SIZE_OPTIONS[k].includes(size))!;
    return {id: newWidgetId(kind), kind, size};
  });
  await Promise.all(
    widgets.map((widget, i) => {
      if (widget.kind === 'notes') {
        return saveWidgetData(widget.id, SAMPLE_NOTES[i % SAMPLE_NOTES.length]);
      }
      if (widget.kind === 'weather') {
        return saveWidgetData(widget.id, {
          place: SAMPLE_PLACES[i % SAMPLE_PLACES.length],
          forecast: null,
        });
      }
      if (widget.kind === 'tasks') {
        return saveWidgetData(
          widget.id,
          SAMPLE_TASKS.map((text, n) => ({id: `t${n}`, text})),
        );
      }
      if (widget.kind === 'favorites') {
        return saveWidgetData(widget.id, sampleFavorites(widget.size));
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
