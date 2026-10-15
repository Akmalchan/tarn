/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// How much each scene asks of the computer, measured (not guessed): the
// scene's own drawing work, in ms per frame on the GPU at 1920x1200 CSS
// pixels times its resolution, on an Apple M4 (headless Chrome for
// Testing, ANGLE Metal, median of 7 interleaved rounds; docs/wallpapers.md,
// "Measured cost"). That is what separates the scenes: the CPU cost of
// showing 30 frames a second is the same for all of them, and a slow GPU
// (a Raspberry Pi is about 30-60x slower) feels exactly this number.
// Settings shows it as a small gauge on each wallpaper. Add a row with
// every new scene, and re-measure when a scene changes.

/** GPU ms per frame, by scene id. */
export const SCENE_LOAD: Readonly<Record<string, number>> = {
  tarn: 0.012,
  ember: 0.036,
  bloom: 0.007,
  wave: 0.049,
  aurora: 0.013,
  silk: 0.011,
  comet: 0.267,
  lumen: 0.034,
  contour: 0.163,
  clouds: 0.013,
  topology: 0.097,
  canopy: 0.077,
  convergence: 0.012,
  ribbons: 0.056,
  fringe: 0.012,
  nightsky: 0.084,
  matrix: 0.086,
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
