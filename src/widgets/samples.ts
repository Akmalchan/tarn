/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {WidgetSize} from '../layout/bands';
import {
  WIDGET_KINDS,
  WIDGET_SIZE_OPTIONS,
  newWidgetId,
  type WidgetEntry,
  type WidgetKind,
} from '../settings/schema';
import {saveWidgetData} from './data';
import {t, type MessageKey} from '../i18n';

// Example setups, in Settings > Widgets: one click shows what a page can
// look like, with sample content, and Undo brings the user's own widgets
// back (their content is never touched: samples get new widget ids).
// Sample weather tiles have no place, so trying an example sends nothing.

const site = (host: string, title: string) => ({
  url: `https://${host}/`,
  title,
});

/**
 * Sample bookmarks: GitHub and ChatGPT have white icons (dark chips), and
 * two folders.
 */
function sampleItems() {
  return [
    site('www.youtube.com', 'YouTube'),
    site('github.com', 'GitHub'),
    site('chatgpt.com', 'ChatGPT'),
    site('mail.google.com', 'Gmail'),
    {
      title: t('panel.examples.folderWork'),
      sites: [
        site('www.figma.com', 'Figma'),
        site('www.notion.so', 'Notion'),
        site('calendar.google.com', 'Calendar'),
        site('docs.google.com', 'Docs'),
        site('news.ycombinator.com', 'Hacker News'),
      ],
    },
    {
      title: t('panel.examples.folderLearn'),
      sites: [
        site('www.wikipedia.org', 'Wikipedia'),
        site('www.khanacademy.org', 'Khan Academy'),
        site('www.coursera.org', 'Coursera'),
        site('www.duolingo.com', 'Duolingo'),
      ],
    },
    site('www.reddit.com', 'Reddit'),
    site('maps.google.com', 'Maps'),
  ];
}

/** Smaller tiles get fewer items, a folder always among them. */
function sampleFavorites(size: WidgetSize) {
  const items = sampleItems();
  if (size === 's') return [...items.slice(0, 3), items[4]];
  if (size === 'm') return items.slice(0, 6);
  return items;
}

type Preset = ReadonlyArray<readonly [WidgetKind, WidgetSize]>;

export interface Example {
  readonly name: MessageKey;
  readonly widgets: Preset;
}

/** At most nine widgets: enough to see a full page, never a wall. */
export const EXAMPLES: readonly Example[] = [
  {name: 'panel.examples.bookmarks', widgets: [['favorites', 'l']]},
  {
    // A large tile beside two stacked mediums: one clean 4-column band.
    name: 'panel.examples.notes',
    widgets: [
      ['favorites', 'l'],
      ['notes', 'm'],
      ['tasks', 'm'],
    ],
  },
  {
    // The start setup (START_WIDGETS).
    name: 'panel.examples.starter',
    widgets: [
      ['favorites', 'l'],
      ['notes', 'm'],
      ['weather', 's'],
      ['focus', 's'],
    ],
  },
  {
    // Two large tiles, then a medium over two smalls: one 6-column band.
    name: 'panel.examples.planner',
    widgets: [
      ['favorites', 'l'],
      ['tasks', 'l'],
      ['weather', 'm'],
      ['calendar', 's'],
      ['focus', 's'],
    ],
  },
  {
    name: 'panel.examples.everything',
    widgets: [
      ['favorites', 'xl'],
      ['notes', 'l'],
      ['focus', 's'],
      ['weather', 's'],
      ['tasks', 'l'],
      ['notes', 'm'],
      ['calendar', 'm'],
      ['favorites', 's'],
      ['focus', 's'],
    ],
  },
];

/** Creates an example's widgets and fills them with sample content. */
export async function buildExample(preset: Preset): Promise<WidgetEntry[]> {
  // Presets are layout shapes, so sizes win: a kind that doesn't offer
  // the size is swapped for the next one that does.
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
    widgets.map(widget => {
      if (widget.kind === 'notes') {
        return saveWidgetData(widget.id, t('start.note'));
      }
      if (widget.kind === 'tasks') {
        const tasks: MessageKey[] = [
          'panel.examples.task1',
          'panel.examples.task2',
          'panel.examples.task3',
        ];
        return saveWidgetData(
          widget.id,
          tasks.map((key, n) => ({id: `t${n}`, text: t(key)})),
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
