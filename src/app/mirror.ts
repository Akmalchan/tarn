/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {sceneById} from '../backdrop/scenes';
import type {Settings} from '../settings/schema';
import {
  rememberBase,
  rememberEnabled,
  rememberScene,
  rememberTabIcon,
} from './first-paint';

const HOME_KEY = 'tarn.home';

/** Mirrors everything first paint depends on from the synced settings. */
export function mirrorSettings(settings: Settings): void {
  rememberScene(settings.scene);
  rememberBase(sceneById(settings.scene).base);
  rememberEnabled(settings.enabled);
  rememberTabIcon(settings.tabIcon);
  try {
    const {clock, widgets} = settings;
    localStorage.setItem(HOME_KEY, JSON.stringify({clock, widgets}));
  } catch {
    // Blocked storage: the page waits for synced settings instead.
  }
}

/**
 * The clock and widgets as last seen, read synchronously, so a new tab can
 * lay them out at once instead of waiting for synced storage. Callers still
 * normalize it, like anything read from storage.
 */
export function rememberedHome(): Partial<Settings> {
  try {
    const raw = JSON.parse(localStorage.getItem(HOME_KEY) ?? 'null') as unknown;
    return typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return {};
  }
}
