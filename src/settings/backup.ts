/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';
import {saveWidgetData} from '../widgets/data';
import {DEFAULT_SETTINGS, WIDGET_ID, normalizeSettings} from './schema';
import {SETTINGS_KEY, replaceSettings} from './store';

/**
 * A whole setup in one object: the synced settings exactly as stored (so a
 * newer Tarn's values survive a round trip) plus every widget's content
 * (notes, tasks, favorites, timers), which lives on this computer only.
 * Photos aren't included yet; they stay in IndexedDB.
 */
export interface TarnBackup {
  readonly format: 'tarn-backup';
  readonly version: 1;
  /** When it was made (epoch ms). */
  readonly created: number;
  /** The Tarn version that made it. */
  readonly app: string;
  readonly settings: unknown;
  /** Widget content by widget id. */
  readonly widgets: Readonly<Record<string, unknown>>;
}

const WIDGET_PREFIX = 'widget.';
/** Backups made automatically before each update, newest first. */
const AUTO_KEY = 'backups.auto';
const AUTO_KEEP = 3;
/**
 * The user's own widget list while example setups are tried
 * (widgets/samples.ts); its widgets' content counts as in use.
 */
export const OWN_KEY = 'examples.own';
/**
 * The most a restore writes for one widget, and for all of them (as JSON).
 * Far above what Tarn's widgets hold (a note is at most 20,000 characters),
 * and well inside storage.local's 10 MB, so a shared file can't fill it and
 * stop later saves and the automatic backups.
 */
const MAX_WIDGET_BYTES = 1_000_000;
const MAX_WIDGETS_BYTES = 4_000_000;

function appVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return '';
  }
}

/**
 * The whole setup. With `inUse`, only content of widgets the setup lists
 * (or the user's own list kept while trying examples): a removed widget's
 * content stays in storage, but can't come back from a backup made after
 * it was removed, so automatic backups leave it out.
 */
export async function createBackup({
  inUse = false,
  app = appVersion(),
}: {inUse?: boolean; app?: string} = {}): Promise<TarnBackup> {
  const sync = await browser.storage.sync.get(SETTINGS_KEY);
  const local = await browser.storage.local.get(null);
  const settings: unknown = sync[SETTINGS_KEY] ?? null;
  const listed = inUse ? listedIds(settings, local[OWN_KEY]) : null;
  const widgets: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(local)) {
    const id = key.slice(WIDGET_PREFIX.length);
    if (key.startsWith(WIDGET_PREFIX) && (!listed || listed.has(id))) {
      widgets[id] = value;
    }
  }
  return {
    format: 'tarn-backup',
    version: 1,
    created: Date.now(),
    app,
    settings,
    widgets,
  };
}

/**
 * Every widget id the stored settings name (shown or not, the start setup
 * when no list is stored yet) and every id in `own`.
 */
function listedIds(settings: unknown, own: unknown): Set<string> {
  const ids = new Set(normalizeSettings(settings).widgets.map(w => w.id));
  const lists = [isRecord(settings) ? settings.widgets : null, own];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (isRecord(entry) && typeof entry.id === 'string') ids.add(entry.id);
    }
  }
  return ids;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A backup as createBackup makes it (a file, or one of the automatic copies). */
function isBackup(raw: unknown): raw is TarnBackup {
  return (
    isRecord(raw) &&
    raw.format === 'tarn-backup' &&
    typeof raw.version === 'number' &&
    typeof raw.created === 'number' &&
    typeof raw.app === 'string' &&
    (raw.settings === null || isRecord(raw.settings)) &&
    isRecord(raw.widgets)
  );
}

/** Every key a settings-only export has ever had (all still current). */
const SETTINGS_KEYS = new Set(['version', ...Object.keys(DEFAULT_SETTINGS)]);

/**
 * A settings-only export from before backups (Tarn's settings object, as
 * it was then): only settings keys, at least one. Anything else, such as
 * some other app's JSON, is not taken.
 */
function isOldExport(raw: unknown): raw is Record<string, unknown> {
  if (!isRecord(raw)) return false;
  const keys = Object.keys(raw);
  return keys.length > 0 && keys.every(key => SETTINGS_KEYS.has(key));
}

/** Whether `raw` (a parsed file) is something restoreBackup takes. */
export function canRestore(raw: unknown): boolean {
  return isBackup(raw) || isOldExport(raw);
}

/** Saves the whole setup as a file (in a page with a document). */
export async function downloadBackup(): Promise<void> {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tarn-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Puts a backup back: the settings (all but on/off) and every widget's
 * content. Also takes an older settings-only export. Widget content not in
 * the backup is left alone. Resolves to the setup it replaced, for Undo,
 * or null (and changes nothing) when `raw` is neither (see canRestore).
 */
export async function restoreBackup(raw: unknown): Promise<TarnBackup | null> {
  if (!canRestore(raw)) return null;
  const previous = await createBackup();
  if (isBackup(raw)) {
    await replaceSettings(raw.settings);
    await Promise.all(
      withinLimits(raw.widgets).map(([id, value]) => saveWidgetData(id, value)),
    );
  } else {
    await replaceSettings(raw);
  }
  return previous;
}

/** A backup's widget content that a restore may write (see MAX_WIDGET_BYTES). */
function withinLimits(
  widgets: Readonly<Record<string, unknown>>,
): [string, unknown][] {
  let total = 0;
  const kept: [string, unknown][] = [];
  for (const [id, value] of Object.entries(widgets)) {
    if (!WIDGET_ID.test(id)) continue;
    const size = JSON.stringify(value ?? null).length;
    if (size > MAX_WIDGET_BYTES || total + size > MAX_WIDGETS_BYTES) {
      console.warn(`[tarn] widget ${id} not restored: too large`);
      continue;
    }
    total += size;
    kept.push([id, value]);
  }
  return kept;
}

export interface AutoBackupInfo {
  readonly created: number;
  /** The Tarn version that was about to be replaced. */
  readonly app: string;
}

async function readAuto(): Promise<TarnBackup[]> {
  const stored = await browser.storage.local.get(AUTO_KEY);
  const list: unknown = stored[AUTO_KEY];
  return Array.isArray(list) ? list.filter(isBackup) : [];
}

/**
 * Keeps a copy of the setup, labeled with `app`, the version being
 * replaced; the oldest of more than three goes. A copy identical to the
 * newest one isn't kept again, so updates in a row (or reloads in
 * development) don't push out the only different one.
 */
export async function saveAutoBackup(app?: string): Promise<void> {
  const backup = await createBackup({inUse: true, app});
  const list = await readAuto();
  if (list[0] && sameSetup(list[0], backup)) return;
  await browser.storage.local.set({
    [AUTO_KEY]: [backup, ...list].slice(0, AUTO_KEEP),
  });
}

const sameSetup = (a: TarnBackup, b: TarnBackup) =>
  JSON.stringify([a.settings, a.widgets]) ===
  JSON.stringify([b.settings, b.widgets]);

/** The automatic backups, newest first. */
export async function autoBackups(): Promise<AutoBackupInfo[]> {
  return (await readAuto()).map(({created, app}) => ({created, app}));
}

/** Restores automatic backup `index` (0 = newest); resolves for Undo. */
export async function restoreAutoBackup(
  index: number,
): Promise<TarnBackup | null> {
  const backup = (await readAuto())[index];
  return backup ? restoreBackup(backup) : null;
}
