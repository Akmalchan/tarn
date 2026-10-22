/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';
import {defineBackground} from 'wxt/utils/define-background';
import {markFirstRun} from '../app/first-run';
import {serveMirror} from '../app/mirror-relay';
import {markUpdateUnseen} from '../panel/about';
import {saveAutoBackup} from '../settings/backup';
import {
  closingPatch,
  keepOldDefaultScene,
  saveSettings,
} from '../settings/store';

/**
 * Keeps one offscreen document alive (Chromium). It mirrors synced settings
 * into the localStorage that first paint reads, which a service worker
 * cannot reach; the document can't read storage, so this worker sends it
 * the settings (`serveMirror`). Because it lives in Tarn's renderer process, that process
 * also stays warm, so a new tab never waits for it to start: the browser's
 * own pre-paint color shows for the shortest possible time.
 */
async function ensureOffscreenDocument(): Promise<void> {
  if (import.meta.env.FIREFOX) return;
  if (await browser.offscreen.hasDocument()) return;
  await browser.offscreen
    .createDocument({
      url: browser.runtime.getURL('/offscreen.html'),
      reasons: ['LOCAL_STORAGE'],
      justification:
        'Mirrors synced settings into localStorage so the new tab paints correctly on its first frame.',
    })
    .catch(() => {
      // Another context created it at the same moment; one is enough.
    });
}

/** Sent by new tabs, so a document Chrome closed mid-session comes back. */
const WARM_MESSAGE = 'tarn:warm';

export default defineBackground(() => {
  if (!import.meta.env.FIREFOX) serveMirror();
  browser.runtime.onStartup.addListener(() => void ensureOffscreenDocument());
  browser.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    // An update: keep a copy of the setup as it was, before the new version
    // reads or writes any of it (Settings > Advanced > Backup restores it),
    // labeled with the version it came from.
    if (reason === 'update') {
      void saveAutoBackup(previousVersion)
        .catch(error =>
          console.warn('[tarn] backup before update failed:', error),
        )
        // The wallpaper they had stays (the default now follows light/dark).
        .then(() => keepOldDefaultScene(previousVersion))
        .catch(() => {});
      // What's new in settings shows a dot until it's opened.
      void markUpdateUnseen();
    }
    // A fresh install: the first new tabs point out the settings gear.
    if (reason === 'install') {
      void markFirstRun().catch(error =>
        console.warn('[tarn] first-run tip failed:', error),
      );
    }
    void ensureOffscreenDocument();
  });
  browser.runtime.onMessage.addListener(message => {
    if ((message as {type?: unknown} | undefined)?.type === WARM_MESSAGE) {
      void ensureOffscreenDocument();
    }
    // The last edit of a page that closed before it could save it.
    const patch = closingPatch(message);
    if (patch) void saveSettings(patch);
    return false; // Never answers; other listeners (the side panel) may.
  });
  void ensureOffscreenDocument();
});
