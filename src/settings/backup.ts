/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {browser} from 'wxt/browser';
import {saveWidgetData} from '../widgets/data';
import {WIDGET_ID} from './schema';
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

function appVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return '';
  }
}

export async function createBackup(): Promise<TarnBackup> {
  const sync = await browser.storage.sync.get(SETTINGS_KEY);
  const local = await browser.storage.local.get(null);
  const widgets: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(local)) {
    if (key.startsWith(WIDGET_PREFIX)) {
      widgets[key.slice(WIDGET_PREFIX.length)] = value;
    }
  }
  return {
    format: 'tarn-backup',
    version: 1,
    created: Date.now(),
    app: appVersion(),
    settings: sync[SETTINGS_KEY] ?? null,
    widgets,
  };
}

export function isBackup(raw: unknown): raw is TarnBackup {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as {format?: unknown}).format === 'tarn-backup'
  );
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
 * the backup is left alone. Resolves to the setup it replaced, for Undo.
 */
export async function restoreBackup(raw: unknown): Promise<TarnBackup> {
  const previous = await createBackup();
  if (isBackup(raw)) {
    await replaceSettings(raw.settings);
    const widgets =
      typeof raw.widgets === 'object' && raw.widgets !== null
        ? Object.entries(raw.widgets)
        : [];
    await Promise.all(
      widgets
        .filter(([id]) => WIDGET_ID.test(id))
        .map(([id, value]) => saveWidgetData(id, value)),
    );
  } else {
    await replaceSettings(raw);
  }
  return previous;
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

/** Keeps a copy of the setup; the oldest of more than three goes. */
export async function saveAutoBackup(): Promise<void> {
  const backup = await createBackup();
  const list = [backup, ...(await readAuto())].slice(0, AUTO_KEEP);
  await browser.storage.local.set({[AUTO_KEY]: list});
}

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
