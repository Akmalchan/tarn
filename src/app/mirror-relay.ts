/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// The offscreen document keeps the first-paint mirror current while no Tarn
// tab is open, but Chrome gives it `runtime` only: no `storage`. So the
// service worker reads the settings and sends them over, once when the
// document starts (it asks) and again on every synced change. Without real
// settings the document mirrors nothing: defaults would overwrite the
// user's scene, widgets and on/off.
//
// The worker sends the stored value as it is and the document normalizes
// it, so the worker's bundle stays free of the scene list and its shaders.

import {browser} from 'wxt/browser';
import {migrateSettings} from '../settings/migrate';
import {normalizeSettings, type Settings} from '../settings/schema';
import {SETTINGS_KEY} from '../settings/store';

/** The document asks for the current settings. */
const REQUEST = 'tarn:mirror-request';
/** The service worker sends settings that just changed. */
const CHANGED = 'tarn:mirror';

interface Message {
  type?: unknown;
  /** As stored; null when nothing is (a new install's defaults). */
  stored?: unknown;
}

/** Service worker (Chromium): answers the document and forwards changes. */
export function serveMirror(): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if ((message as Message | undefined)?.type !== REQUEST) return false;
    browser.storage.sync.get(SETTINGS_KEY).then(
      items => sendResponse({stored: items[SETTINGS_KEY] ?? null}),
      () => sendResponse({}),
    );
    return true; // Responds asynchronously.
  });
  // The sync area holds only the settings, so writes to storage.local
  // (widget content, typing in a note) never wake the worker for this.
  browser.storage.sync.onChanged.addListener(changes => {
    if (!(SETTINGS_KEY in changes)) return;
    const stored = changes[SETTINGS_KEY].newValue ?? null;
    // Rejects when nothing listens (no offscreen document right now).
    void browser.runtime
      .sendMessage({type: CHANGED, stored} satisfies Message)
      .catch(() => {});
  });
}

/** Offscreen document: mirrors what the service worker sends, nothing else. */
export function followMirror(mirror: (settings: Settings) => void): void {
  let changed = false;
  const apply = (message: unknown) => {
    // Only a real read: an empty answer means the worker couldn't.
    if (typeof message !== 'object' || message === null) return false;
    if (!('stored' in message)) return false;
    mirror(normalizeSettings(migrateSettings(message.stored)));
    return true;
  };
  browser.runtime.onMessage.addListener(message => {
    if ((message as Message | undefined)?.type === CHANGED && apply(message)) {
      changed = true;
    }
    return false;
  });
  void browser.runtime
    .sendMessage({type: REQUEST} satisfies Message)
    .then((answer: unknown) => {
      // A change that arrived meanwhile is newer than this answer.
      if (!changed) apply(answer);
    })
    .catch(() => {
      // No answer: the mirror stays as the last Tarn tab left it.
    });
}
