/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// How much each scene asks of the computer, measured (not guessed): the
// scene's own drawing work, in ms per frame on the GPU at 1920x1200 CSS
// pixels times its resolution (1.5 for scenes drawn at screen density),
// on an Apple M4 (headless Chrome for Testing, ANGLE Metal, median of 7
// interleaved rounds; docs/wallpapers.md,
// "Measured cost"). That is what separates the scenes: the CPU cost of
// showing 30 frames a second is the same for all of them, and a slow GPU
// (a Raspberry Pi is about 30-60x slower) feels exactly this number.
// Settings shows it as a small gauge on each wallpaper. Add a row with
// every new scene, and re-measure when a scene changes.

/** GPU ms per frame, by scene id. */
export const SCENE_LOAD: Readonly<Record<string, number>> = {
  tarn: 0.012,
  ember: 0.037,
  bloom: 0.007,
  wave: 0.049,
  aurora: 0.014,
  silk: 0.011,
  lumen: 0.036,
  contour: 0.164,
  clouds: 0.014,
  topology: 0.191,
  canopy: 0.079,
  convergence: 0.01,
  ribbons: 0.05,
  fringe: 0.013,
  nightsky: 0.087,
  matrix: 0.084,
};

/** A still photo costs nothing once drawn; scenes are light to heavier. */
export type LoadLevel = 'still' | 'light' | 'medium' | 'heavy';

/** Under this, a scene is light; at or over HEAVY_MS, heavy. */
const LIGHT_MS = 0.03;
const HEAVY_MS = 0.12;

/** The gauge's reading for a wallpaper, from its measured GPU work. */
export function loadLevel(id: string): LoadLevel {
  if (id.startsWith('photo:')) return 'still';
  const ms = SCENE_LOAD[id];
  if (ms === undefined) return 'medium';
  if (ms < LIGHT_MS) return 'light';
  return ms < HEAVY_MS ? 'medium' : 'heavy';
}
