/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {DEFAULT_SCENE_ID, SCENES} from '../backdrop/scenes';

/**
 * The icon in the tab. 'chrome' shows Chrome's own new-tab icon; 'none'
 * shows nothing, which never changes even mid-reload (see first-paint.ts).
 */
export type TabIcon = 'chrome' | 'none';
export const TAB_ICONS: readonly TabIcon[] = ['chrome', 'none'];

/** Everything the user can change. Small and serializable; synced across devices. */
export interface Settings {
  /** Whether new tabs show Tarn, or hand off to the browser's own page. */
  readonly enabled: boolean;
  readonly scene: string;
  readonly tabIcon: TabIcon;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  scene: DEFAULT_SCENE_ID,
  tabIcon: 'chrome',
};

/**
 * Turns whatever is in storage (missing, old, hand-edited) into valid
 * settings. Unknown values fall back to defaults instead of throwing.
 */
export function normalizeSettings(raw: unknown): Settings {
  const value = isRecord(raw) ? raw : {};
  const scene =
    typeof value.scene === 'string' && SCENES.some(s => s.id === value.scene)
      ? value.scene
      : DEFAULT_SETTINGS.scene;
  const enabled =
    typeof value.enabled === 'boolean'
      ? value.enabled
      : DEFAULT_SETTINGS.enabled;
  const tabIcon = TAB_ICONS.includes(value.tabIcon as TabIcon)
    ? (value.tabIcon as TabIcon)
    : DEFAULT_SETTINGS.tabIcon;
  return {enabled, scene, tabIcon};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
