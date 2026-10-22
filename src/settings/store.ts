/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';
import {SETTINGS_VERSION, migrateSettings, storedVersion} from './migrate';
import {contextGone, reportSaveProblem} from './problems';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
  type WidgetEntry,
} from './schema';

/** Versioned key: the shape inside is versioned too (see migrate.ts). */
export const SETTINGS_KEY = 'settings.v1';

type Listener = (settings: Settings) => void;
type Stored = Record<string, unknown>;

/**
 * `storage.sync` follows the user across devices. Signed out, the browser
 * simply keeps it on this computer.
 */
function syncArea() {
  return typeof browser !== 'undefined' && browser?.storage
    ? browser.storage.sync
    : null;
}

let memory: unknown;
/** What was stored at the last read, for a save whose read fails. */
let lastStored: Stored = {};

/** Settings as stored, in the current shape, with nothing dropped. */
async function readStored(): Promise<Stored> {
  const area = syncArea();
  if (!area) return migrateSettings(memory);
  const stored = await area.get(SETTINGS_KEY);
  lastStored = migrateSettings(stored[SETTINGS_KEY]);
  return lastStored;
}

/** Rejects when storage refuses the write. */
async function writeStored(stored: Stored): Promise<void> {
  const area = syncArea();
  if (!area) {
    memory = stored;
    return;
  }
  await area.set({[SETTINGS_KEY]: stored});
}

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await readStored());
}

/**
 * Saves run one after another, in every Tarn page at once (a Web Lock):
 * each reads, merges and writes, so two quick changes from different
 * places (a tab and the side panel) can't overwrite each other.
 *
 * Only what the patch changes is rewritten. Everything else stays exactly
 * as stored, including values this version doesn't understand: settings
 * sync between computers that may run different versions of Tarn, and an
 * older one must never erase what a newer one saved (a new widget, scene
 * or clock face). It just doesn't show it. Object settings (weather,
 * search) merge the same way, field by field.
 *
 * A change storage refuses (sync allows about 120 writes a minute) is kept
 * here and tried again with the next save, and on its own after
 * `RETRY_MS`. If it still fails it is dropped and reported
 * (`watchSaveProblems`), so the page can show what is really stored.
 */
let saving: Promise<unknown> = Promise.resolve();

/** A refused change, still to be stored. */
let unsaved: Partial<Settings> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
/** The wait before each retry of a refused change. */
export const RETRY_MS = [2_000, 30_000] as const;

export function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return queue(async () => {
    const change = {...unsaved, ...patch};
    let next = normalizeSettings({...lastStored, ...change});
    try {
      const stored = await readStored();
      next = normalizeSettings({...stored, ...change});
      await writeStored(patched(stored, change, next));
      unsaved = null;
      attempts = 0;
      clearTimeout(retryTimer);
    } catch (error) {
      refused(change, error);
    }
    return next;
  });
}

/** The stored object with `change` (normalized as `next`) written in. */
function patched(
  stored: Stored,
  change: Partial<Settings>,
  next: Settings,
): Stored {
  const shown = normalizeSettings(stored);
  const written: Stored = {
    ...stored,
    version: Math.max(storedVersion(stored), SETTINGS_VERSION),
  };
  for (const key of Object.keys(change) as (keyof Settings)[]) {
    const value = next[key];
    const before = shown[key];
    written[key] =
      key === 'widgets'
        ? mergeWidgets(stored.widgets, next.widgets)
        : isRecord(value) && isRecord(before)
          ? mergeFields(stored[key], before, value)
          : value;
  }
  return written;
}

function refused(change: Partial<Settings>, error: unknown): void {
  clearTimeout(retryTimer);
  // An old page after an update: no retry can work until it reloads.
  if (contextGone(error)) {
    unsaved = null;
    reportSaveProblem('stale');
    return;
  }
  console.warn('[tarn] settings not saved:', error);
  if (attempts < RETRY_MS.length) {
    unsaved = change;
    retryTimer = setTimeout(() => {
      if (unsaved) void saveSettings({});
    }, RETRY_MS[attempts++]);
    return;
  }
  unsaved = null;
  attempts = 0;
  reportSaveProblem('failed');
}

/** Sent to the background by a page that is closing, with a patch. */
export const SAVE_MESSAGE = 'tarn:save';

/**
 * Saves a patch from a page that is closing (the side panel unloads with
 * no blur). A save reads before it writes, and a closing page can't wait
 * for the read, so the background finishes it (`closingPatch`).
 */
export function saveOnClose(patch: Partial<Settings>): void {
  void browser.runtime.sendMessage({type: SAVE_MESSAGE, patch}).catch(() => {});
}

/**
 * The patch in a SAVE_MESSAGE, or null: only settings this version knows,
 * never `enabled` (the panel doesn't turn Tarn off).
 */
export function closingPatch(message: unknown): Partial<Settings> | null {
  if (!isRecord(message) || message.type !== SAVE_MESSAGE) return null;
  if (!isRecord(message.patch)) return null;
  const patch: Stored = {};
  for (const [key, value] of Object.entries(message.patch)) {
    if (key in DEFAULT_SETTINGS && key !== 'enabled') patch[key] = value;
  }
  return Object.keys(patch).length ? (patch as Partial<Settings>) : null;
}

/**
 * Until 1.0.1 an unset `scene` meant Tarn; since then it follows light and
 * dark (`auto`, Silk on a light page). Someone updating from an older
 * version keeps what they saw: an unset scene is written as Tarn, once.
 */
export async function keepOldDefaultScene(
  previousVersion: string | undefined,
): Promise<void> {
  if (!previousVersion || !olderThan(previousVersion, [1, 0, 1])) return;
  const stored = await queue(readStored);
  if (stored.scene === undefined) await saveSettings({scene: 'tarn'});
}

/** Whether a version like "1.0.0" comes before `than`. */
export function olderThan(version: string, than: readonly number[]): boolean {
  const parts = version.split('.').map(Number);
  for (let i = 0; i < than.length; i++) {
    const part = parts[i] ?? 0;
    if (!Number.isFinite(part)) return false;
    if (part !== than[i]) return part < than[i]!;
  }
  return false;
}

/** What Reset puts back: the look. Widgets, the language and on/off stay. */
const RESET_KEYS = [
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
 * Replaces the whole setup (Import, restoring a backup, settings.json) with
 * `raw`, kept as-is so a file from a newer Tarn loses nothing. `enabled`
 * stays: turning Tarn on or off never comes from a file. Resolves to the
 * settings it replaced, for Undo; rejects if storage refuses it.
 */
export function replaceSettings(raw: unknown): Promise<Settings> {
  return queue(async () => {
    try {
      const stored = await readStored();
      const previous = normalizeSettings(stored);
      const incoming = migrateSettings(raw);
      await writeStored({
        ...incoming,
        enabled: previous.enabled,
        version: Math.max(storedVersion(incoming), SETTINGS_VERSION),
      });
      return previous;
    } catch (error) {
      if (contextGone(error)) reportSaveProblem('stale');
      throw error;
    }
  });
}

/** Held by whichever Tarn page is saving settings right now. */
const LOCK = 'tarn.settings';

/**
 * Runs `task` after every earlier save, here and in other pages. Where Web
 * Locks are missing, saves in this page still run in order.
 */
function queue<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = saving.then(() => (locks ? locks.request(LOCK, task) : task()));
  saving = run.catch(() => {});
  return run;
}

/**
 * The widget list to store: this version's list, plus what it can't show.
 * An entry this version skips (a kind it doesn't know, an id it doesn't
 * accept, one past MAX_WIDGETS: all from a newer Tarn) stays exactly as
 * stored, next to the widget it followed. On the others, fields this
 * version doesn't know stay, and so does a size or name it shows
 * differently (a newer size, a longer name) unless it was changed here.
 */
function mergeWidgets(stored: unknown, list: readonly WidgetEntry[]): Stored[] {
  const raw = Array.isArray(stored) ? stored.filter(isRecord) : [];
  const shown = new Map(
    normalizeSettings({widgets: raw}).widgets.map(entry => [entry.id, entry]),
  );
  const byId = new Map<unknown, Stored>();
  for (const entry of raw) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  const out: Stored[] = list.map(entry =>
    mergeEntry(byId.get(entry.id), shown.get(entry.id), entry),
  );
  raw.forEach((entry, i) => {
    if (
      typeof entry.id !== 'string' ||
      typeof entry.kind !== 'string' ||
      shown.has(entry.id) ||
      out.some(e => e.id === entry.id)
    ) {
      return;
    }
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

/** A shown widget as stored, with only what changed here written in. */
function mergeEntry(
  stored: Stored | undefined,
  shown: WidgetEntry | undefined,
  entry: WidgetEntry,
): Stored {
  if (!stored || !shown) return {...entry};
  const out: Stored = {...stored, id: entry.id, kind: entry.kind};
  if (entry.size !== shown.size) out.size = entry.size;
  if ((entry.name ?? '') !== (shown.name ?? '')) {
    if (entry.name) out.name = entry.name;
    else delete out.name;
  }
  return out;
}

/**
 * An object setting (`weather`, `search`) to store: as stored, with only
 * the fields that changed from what this version shows. A field a newer
 * Tarn added, or a value it doesn't know (shown here as the default), stays.
 */
function mergeFields(stored: unknown, shown: Stored, next: Stored): Stored {
  const out: Stored = isRecord(stored) ? {...stored} : {};
  for (const [field, value] of Object.entries(next)) {
    if (!(field in out) || value !== shown[field]) out[field] = value;
  }
  return out;
}

function isRecord(value: unknown): value is Stored {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
