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

/** Mirrors everything first paint depends on from the synced settings. */
export function mirrorSettings(settings: Settings): void {
  rememberScene(settings.scene);
  rememberBase(sceneById(settings.scene).base);
  rememberEnabled(settings.enabled);
  rememberTabIcon(settings.tabIcon);
}
