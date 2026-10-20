/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';

/**
 * The browser's own new tab page. `chrome://newtab` would land back on Tarn,
 * because Tarn overrides it; this is the page underneath.
 */
const BROWSER_NEW_TAB = 'chrome://new-tab-page/';

/**
 * Whether Tarn can hand a tab back to the browser's page. Firefox does not
 * let extensions open its privileged about: pages, so there Tarn is turned
 * off from the Add-ons manager instead.
 */
export const canHandOff = !import.meta.env.FIREFOX;

/** Replaces this tab with the browser's own new tab page. */
export async function handOffToBrowserNewTab(): Promise<boolean> {
  if (!canHandOff) return false;
  try {
    const tab = await browser.tabs.getCurrent();
    if (tab?.id === undefined) return false;
    await browser.tabs.update(tab.id, {url: BROWSER_NEW_TAB});
    return true;
  } catch {
    return false;
  }
}
