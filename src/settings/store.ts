/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {browser} from 'wxt/browser';
import {SETTINGS_VERSION, migrateSettings, storedVersion} from './migrate';
import {
  DEFAULT_SETTINGS,
  WIDGET_ENTRY_FIELDS,
  WIDGET_ID,
  WIDGET_KINDS,
  normalizeSettings,
  type Settings,
  type WidgetEntry,
} from './schema';

/** Versioned key: the shape inside is versioned too (see migrate.ts). */
export const SETTINGS_KEY = 'settings.v1';

type Listener = (settings: Settings) => void;
type Stored = Record<string, unknown>;

/** `storage.sync` follows the user across devices; it falls back to local when signed out. */
function syncArea() {
  return typeof browser !== 'undefined' && browser?.storage
    ? browser.storage.sync
    : null;
}

let memory: unknown;

/** Settings as stored, in the current shape, with nothing dropped. */
async function readStored(): Promise<Stored> {
  const area = syncArea();
  if (!area) return migrateSettings(memory);
  const stored = await area.get(SETTINGS_KEY);
  return migrateSettings(stored[SETTINGS_KEY]);
}

async function writeStored(stored: Stored): Promise<void> {
  const area = syncArea();
  if (!area) {
    memory = stored;
    return;
  }
  try {
    await area.set({[SETTINGS_KEY]: stored});
  } catch (error) {
    console.warn('[tarn] settings not saved:', error);
  }
}

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await readStored());
}

/**
 * Saves run one after another: each reads, merges and writes, so two quick
 * changes from different places (a tab and the side panel) can't overwrite
 * each other. A failed write (e.g. the sync quota of ~120 writes a minute)
 * keeps the in-memory result and the next save tries again.
 *
 * Only what the patch changes is rewritten. Everything else stays exactly
 * as stored, including values this version doesn't understand: settings
 * sync between computers that may run different versions of Tarn, and an
 * older one must never erase what a newer one saved (a new widget, scene
 * or clock face). It just doesn't show it.
 */
let saving: Promise<unknown> = Promise.resolve();

export function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return queue(async () => {
    const stored = await readStored();
    const next = normalizeSettings({...stored, ...patch});
    const written: Stored = {
      ...stored,
      version: Math.max(storedVersion(stored), SETTINGS_VERSION),
    };
    for (const key of Object.keys(patch) as (keyof Settings)[]) {
      written[key] =
        key === 'widgets'
          ? mergeWidgets(stored.widgets, next.widgets)
          : next[key];
    }
    await writeStored(written);
    return next;
  });
}

/** What Reset puts back: the look. Widgets, the language and on/off stay. */
export const RESET_KEYS = [
  'scene',
  'tabIcon',
  'clock',
  'clockColor',
  'search',
  'weather',
] as const satisfies readonly (keyof Settings)[];

/**
 * Reset (Settings, end of home): the wallpaper, clock, search box, weather
 * and tab icon go back to a new install's. A patch, so the widgets, what's
 * in them (bookmarks, notes), the language and anything a newer Tarn
 * stored stay.
 */
export function resetSettings(): Promise<Settings> {
  const patch: Partial<Record<keyof Settings, unknown>> = {};
  for (const key of RESET_KEYS) patch[key] = DEFAULT_SETTINGS[key];
  return saveSettings(patch as Partial<Settings>);
}

/**
 * Replaces the whole setup (Reset, Import, restoring a backup) with `raw`,
 * kept as-is so a file from a newer Tarn loses nothing. `enabled` stays:
 * turning Tarn on or off never comes from a file. Resolves to the settings
 * it replaced, for Undo.
 */
export function replaceSettings(raw: unknown): Promise<Settings> {
  return queue(async () => {
    const stored = await readStored();
    const previous = normalizeSettings(stored);
    const incoming = migrateSettings(raw);
    await writeStored({
      ...incoming,
      enabled: previous.enabled,
      version: Math.max(storedVersion(incoming), SETTINGS_VERSION),
    });
    return previous;
  });
}

function queue<T>(task: () => Promise<T>): Promise<T> {
  const run = saving.then(task);
  saving = run.catch(() => {});
  return run;
}

/**
 * The widget list to store: this version's list, plus what it can't show.
 * A widget of a kind this version doesn't know (added by a newer Tarn)
 * stays, next to the widget it followed. Fields this version doesn't know
 * stay on each entry.
 */
export function mergeWidgets(
  stored: unknown,
  list: readonly WidgetEntry[],
): Stored[] {
  const raw = Array.isArray(stored)
    ? stored.filter(
        (e): e is Stored =>
          typeof e === 'object' && e !== null && !Array.isArray(e),
      )
    : [];
  const byId = new Map(raw.map(entry => [entry.id, entry]));
  const out: Stored[] = list.map(entry => ({
    ...unknownFields(byId.get(entry.id)),
    ...entry,
  }));
  raw.forEach((entry, i) => {
    if (!isForeign(entry) || out.some(e => e.id === entry.id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.findIndex(e => e.id === raw[j]!.id);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    out.splice(at, 0, entry);
  });
  return out;
}

/** A well-formed widget of a kind this version doesn't have. */
function isForeign(entry: Stored): boolean {
  return (
    typeof entry.id === 'string' &&
    WIDGET_ID.test(entry.id) &&
    typeof entry.kind === 'string' &&
    !(WIDGET_KINDS as readonly string[]).includes(entry.kind)
  );
}

function unknownFields(entry: Stored | undefined): Stored {
  if (!entry) return {};
  return Object.fromEntries(
    Object.entries(entry).filter(([key]) => !WIDGET_ENTRY_FIELDS.includes(key)),
  );
}

/** For tests: the stored object, exactly as written. */
export async function storedSettings(): Promise<Stored> {
  return readStored();
}

/** Calls `listener` when settings change in any tab or on any synced device. */
export function watchSettings(listener: Listener): () => void {
  const storage = typeof browser !== 'undefined' ? browser?.storage : undefined;
  if (!storage) return () => {};
  const onChanged = (
    changes: Record<string, {newValue?: unknown}>,
    areaName: string,
  ) => {
    if (areaName === 'sync' && SETTINGS_KEY in changes) {
      listener(normalizeSettings(changes[SETTINGS_KEY].newValue));
    }
  };
  storage.onChanged.addListener(onChanged);
  return () => storage.onChanged.removeListener(onChanged);
}
