/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';
import type {WidgetSize} from '../layout/bands';
import {
  CUSTOM_KINDS,
  WIDGET_KINDS,
  WIDGET_SIZE_OPTIONS,
  newWidgetId,
  normalizeSettings,
  type WidgetEntry,
  type WidgetKind,
} from '../settings/schema';
import {OWN_KEY} from '../settings/backup';
import {loadSettings} from '../settings/store';
import {deleteWidgetData, saveWidgetData} from './data';
import {t, type MessageKey} from '../i18n';

// Example setups, in Settings > Advanced: one click shows what a page can
// look like, with sample content, and Undo or "Back to my widgets" brings
// the user's own widgets back (their content is never touched: samples get
// new widget ids). Samples nobody changed are deleted once their widgets
// are gone (pruneSamples).
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
    // Every kind once (no duplicates, owner 2026-10-14). Two full bands at
    // 6 columns, three at 4, no holes at any width.
    name: 'panel.examples.everything',
    widgets: [
      ['favorites', 'xl'],
      ['notes', 'l'],
      ['tasks', 'l'],
      ['weather', 'm'],
      ['focus', 'm'],
      ['calendar', 'l'],
    ],
  },
];

/** Creates an example's widgets and fills them with sample content. */
export async function buildExample(preset: Preset): Promise<WidgetEntry[]> {
  const samples: Record<string, unknown> = {};
  // Presets are layout shapes, so sizes win: a kind that doesn't offer
  // the size is swapped for the next one that does.
  const widgets = preset.map(([wanted, size], i) => {
    const plain = WIDGET_KINDS.filter(k => !CUSTOM_KINDS.includes(k));
    const kinds = [...plain.slice(i % plain.length), ...plain];
    const kind = WIDGET_SIZE_OPTIONS[wanted].includes(size)
      ? wanted
      : kinds.find(k => WIDGET_SIZE_OPTIONS[k].includes(size))!;
    return {id: newWidgetId(kind), kind, size};
  });
  for (const widget of widgets) {
    if (widget.kind === 'notes') samples[widget.id] = t('start.note');
    if (widget.kind === 'tasks') {
      const tasks: MessageKey[] = [
        'panel.examples.task1',
        'panel.examples.task2',
        'panel.examples.task3',
      ];
      samples[widget.id] = tasks.map((key, n) => ({id: `t${n}`, text: t(key)}));
    }
    if (widget.kind === 'favorites') {
      samples[widget.id] = sampleFavorites(widget.size);
    }
  }
  const written = await sampleRecord();
  for (const [id, value] of Object.entries(samples)) {
    written[id] = JSON.stringify(value);
  }
  await browser.storage.local.set({[SAMPLES_KEY]: written});
  await Promise.all(
    Object.entries(samples).map(([id, value]) => saveWidgetData(id, value)),
  );
  return widgets;
}

/**
 * The sample content each example widget was given, as JSON, by widget
 * id, so it can be told apart from content the user wrote.
 */
const SAMPLES_KEY = 'examples.samples';

async function sampleRecord(): Promise<Record<string, string>> {
  const stored: unknown = (await browser.storage.local.get(SAMPLES_KEY))[
    SAMPLES_KEY
  ];
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(stored).filter(([, json]) => typeof json === 'string'),
  ) as Record<string, string>;
}

/**
 * Deletes the sample content of example widgets that are gone: not in
 * `keep` (what the panel shows, and what its Undo could bring back), the
 * stored list or the user's kept list. Content the user changed stays, as
 * a removed widget's always does; only untouched samples go, so trying
 * examples doesn't pile up copies in storage and in every backup.
 */
export async function pruneSamples(
  keep: readonly WidgetEntry[],
): Promise<void> {
  const samples = await sampleRecord();
  const ids = Object.keys(samples);
  if (!ids.length) return;
  const own = (await ownWidgets()) ?? [];
  const shown = (await loadSettings()).widgets;
  const used = new Set([...keep, ...own, ...shown].map(w => w.id));
  const stored = await browser.storage.local.get(ids.map(id => `widget.${id}`));
  for (const id of ids) {
    if (used.has(id)) continue;
    if (JSON.stringify(stored[`widget.${id}`]) === samples[id]) {
      await deleteWidgetData(id);
    }
    delete samples[id];
  }
  await browser.storage.local.set({[SAMPLES_KEY]: samples});
}

// The user's own widget list from before the first example they tried is
// kept in storage.local (OWN_KEY; the panel may close before they decide)
// until they keep an example or go back. Their content stays under their
// own widget ids, so the list is all it takes to get everything back.

/** Keeps `widgets` unless an earlier list is already kept. */
export async function rememberOwnWidgets(
  widgets: readonly WidgetEntry[],
): Promise<void> {
  if ((await ownWidgets()) !== null) return;
  await browser.storage.local.set({[OWN_KEY]: widgets});
}

/** The kept list, or null while no example is being tried. */
export async function ownWidgets(): Promise<WidgetEntry[] | null> {
  const stored: unknown = (await browser.storage.local.get(OWN_KEY))[OWN_KEY];
  return Array.isArray(stored)
    ? [...normalizeSettings({widgets: stored}).widgets]
    : null;
}

export async function forgetOwnWidgets(): Promise<void> {
  await browser.storage.local.remove(OWN_KEY);
}
