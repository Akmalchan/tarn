/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {sceneById, shownSceneId} from '../backdrop/scenes';
import type {Settings} from '../settings/schema';
import {rememberAppearance} from '../ui/appearance';
import {readJson, writeJson} from './web-storage';
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
  rememberBase(
    sceneById(shownSceneId(settings.scene, settings.appearance)).base,
  );
  rememberEnabled(settings.enabled);
  rememberTabIcon(settings.tabIcon);
  rememberAppearance(settings.appearance);
  // Blocked storage: the page waits for synced settings instead.
  const {clock, clockColor, clockHex, widgets, search} = settings;
  writeJson(HOME_KEY, {clock, clockColor, clockHex, widgets, search});
}

/**
 * The clock, its color, the search box and widgets as last seen, read synchronously, so a new tab can
 * lay them out at once instead of waiting for synced storage. Callers still
 * normalize it, like anything read from storage.
 */
export function rememberedHome(): Partial<Settings> {
  const raw = readJson(HOME_KEY);
  return typeof raw === 'object' && raw !== null ? raw : {};
}
