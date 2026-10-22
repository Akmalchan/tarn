/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// The built-in scenes' ids, in SCENES' order (scenes.test.ts keeps the two
// equal). Kept apart from the shaders, so code that only checks an id (the
// settings, and with them the service worker) doesn't carry ~55 KB of GLSL.

export const SCENE_IDS: readonly string[] = [
  'tarn',
  'ember',
  'bloom',
  'wave',
  'aurora',
  'silk',
  'lumen',
  'contour',
  'clouds',
  'topology',
  'canopy',
  'convergence',
  'ribbons',
  'fringe',
  'nightsky',
  'matrix',
];

export const DEFAULT_SCENE_ID = 'tarn';

/**
 * The `scene` setting until someone picks a wallpaper: Silk while the page
 * is light, Tarn while it's dark, switching live with the system or
 * Appearance (owner, 2026-10-20). An older Tarn reads it as unknown and
 * shows Tarn.
 */
export const AUTO_SCENE = 'auto';

/** The scene a setting shows: `auto` resolved for light or dark. */
export function sceneFor(setting: string, dark: boolean): string {
  if (setting !== AUTO_SCENE) return setting;
  return dark ? DEFAULT_SCENE_ID : 'silk';
}
