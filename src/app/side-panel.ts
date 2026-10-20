/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';

// Opening the side panel must happen synchronously inside the click that
// asked for it, or the browser rejects it as not user-initiated. So the
// window id is looked up ahead of time, never awaited on click.

let windowId: number | undefined;
let windowIdReady: Promise<number | undefined> | undefined;

interface FirefoxSidebar {
  sidebarAction: {open(): Promise<void>};
}

export function prepareSidePanel(): Promise<number | undefined> {
  if (import.meta.env.FIREFOX) return Promise.resolve(undefined);
  windowIdReady ??= browser.windows
    .getCurrent()
    .then(w => (windowId = w.id))
    .catch(() => undefined);
  return windowIdReady;
}

export function openSidePanel(): void {
  if (import.meta.env.FIREFOX) {
    void (browser as unknown as FirefoxSidebar).sidebarAction.open();
  } else if (windowId !== undefined) {
    void browser.sidePanel.open({windowId}).catch(() => {});
  }
}

/**
 * Reports whether Tarn's side panel is open in this window, now and on every
 * change. Chromium only; elsewhere it never reports open.
 */
export function watchSidePanel(onChange: (open: boolean) => void): () => void {
  const panel = import.meta.env.FIREFOX ? undefined : browser.sidePanel;
  if (!panel?.onOpened || !panel.onClosed) return () => {};

  const onOpened = (info: {windowId: number}) => {
    if (info.windowId === windowId) onChange(true);
  };
  const onClosed = (info: {windowId: number}) => {
    if (info.windowId === windowId) onChange(false);
  };
  panel.onOpened.addListener(onOpened);
  panel.onClosed.addListener(onClosed);

  void prepareSidePanel().then(async id => {
    if (id !== undefined) onChange(await isPanelOpenIn(id));
  });

  return () => {
    panel.onOpened.removeListener(onOpened);
    panel.onClosed.removeListener(onClosed);
  };
}

// The side panel's runtime context does not report its window (windowId is
// -1 for a global panel), so a tab asks the panel directly instead.

const PRESENCE_QUERY = 'tarn:side-panel-in-window';

interface PresenceQuery {
  type: typeof PRESENCE_QUERY;
  windowId: number;
}

async function isPanelOpenIn(id: number): Promise<boolean> {
  const query: PresenceQuery = {type: PRESENCE_QUERY, windowId: id};
  // Rejects when nothing listens, i.e. no panel is open anywhere.
  return browser.runtime
    .sendMessage(query)
    .then(answer => answer === true)
    .catch(() => false);
}

/** Called by the side panel page: answers tabs in its own window. */
export function answerPanelPresence(): void {
  const ready = prepareSidePanel();
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const query = message as Partial<PresenceQuery> | undefined;
    if (query?.type !== PRESENCE_QUERY) return false;
    void ready.then(id => sendResponse(id === query.windowId));
    return true; // Responds asynchronously.
  });
}
