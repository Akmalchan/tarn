/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {browser} from 'wxt/browser';
import type {MessageKey} from '../i18n';

// What the About section links to: the release notes ("What's new"), the
// store page to rate Tarn, a feedback form and the licenses. See
// docs/settings.md.

/** One release's notes, a few short lines each, newest release first. */
export interface Release {
  readonly version: string;
  readonly notes: readonly MessageKey[];
}

/**
 * Every release that has notes, newest first. Each version bump adds one
 * at the top (whats-new.test.ts fails until it does): the three to five
 * changes people would notice, not the whole CHANGELOG.
 */
export const RELEASES: readonly Release[] = [
  {
    version: '0.1.0',
    notes: [
      'whatsNew.v0_1_0.wallpapers',
      'whatsNew.v0_1_0.widgets',
      'whatsNew.v0_1_0.keys',
      'whatsNew.v0_1_0.private',
    ],
  },
];

/** Set on an update, cleared when What's new is opened. */
const UNSEEN_KEY = 'whatsNew.unseen';

/** After an update: What's new shows a dot until it's opened. */
export function markUpdateUnseen(): Promise<void> {
  return browser.storage.local.set({[UNSEEN_KEY]: true});
}

export async function hasUnseenUpdate(): Promise<boolean> {
  const stored = await browser.storage.local.get(UNSEEN_KEY);
  return stored[UNSEEN_KEY] === true;
}

export function markUpdateSeen(): Promise<void> {
  return browser.storage.local.remove(UNSEEN_KEY);
}

const REPO = 'https://github.com/Akmalchan/tarn';
export const PRIVACY_URL = `${REPO}/blob/main/PRIVACY.md`;
export const SOURCE_URL = REPO;

/**
 * The reviews page of the store this copy came from, or null: development
 * builds, Firefox (not listed yet) and anything else have no "Rate Tarn".
 * The store is read from the update URL it installed, and the item's id is
 * Tarn's own id there, so no id is written down here.
 */
export async function storeReviewUrl(): Promise<string | null> {
  if (import.meta.env.FIREFOX) return null;
  let self: {installType?: string; updateUrl?: string};
  try {
    self = await browser.management.getSelf();
  } catch {
    return null;
  }
  if (self.installType !== 'normal') return null;
  const id = browser.runtime.id;
  const from = self.updateUrl ?? '';
  if (from.startsWith('https://clients2.google.com/')) {
    return `https://chromewebstore.google.com/detail/${id}/reviews`;
  }
  if (from.startsWith('https://edge.microsoft.com/')) {
    return `https://microsoftedge.microsoft.com/addons/detail/${id}`;
  }
  return null;
}

/**
 * A new GitHub issue with the version and browser filled in. Nothing is
 * sent until the person submits it there, signed in to GitHub, which also
 * keeps spam out.
 */
export function feedbackUrl(version: string): string {
  const body = `\n\n---\nTarn ${version}\n${navigator.userAgent}`;
  return `${REPO}/issues/new?body=${encodeURIComponent(body)}`;
}

/** The licenses of Tarn and everything it ships, bundled for offline use. */
export const LICENSES_PATH = '/licenses.txt';
