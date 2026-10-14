/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// How much each scene asks of the computer, measured (not guessed): % of
// one CPU core for the page and for the GPU process, M4, headed Chrome,
// active pace (docs/design/backgrounds.md, "Measured cost"). Settings
// shows it as a small gauge on each wallpaper. Add a row with every new
// scene, and update it when a scene changes.

interface Load {
  readonly page: number;
  readonly gpu: number;
}

export const SCENE_LOAD: Readonly<Record<string, Load>> = {
  tarn: {page: 5.0, gpu: 9.8},
  ember: {page: 8.1, gpu: 11.1},
  bloom: {page: 5.0, gpu: 10.0},
  wave: {page: 6.5, gpu: 10.5},
  aurora: {page: 4.8, gpu: 9.0},
  silk: {page: 4.8, gpu: 9.8},
  sakura: {page: 6.5, gpu: 9.1},
  comet: {page: 4.1, gpu: 8.7},
  koi: {page: 6.8, gpu: 9.4},
  window: {page: 7.5, gpu: 9.2},
  lumen: {page: 6.2, gpu: 10.0},
  contour: {page: 4.7, gpu: 8.7},
};

/** A still photo costs nothing once drawn; scenes are light to heavier. */
export type LoadLevel = 'still' | 'light' | 'medium' | 'heavy';

/** The gauge's reading for a wallpaper: its measured page plus GPU cost. */
export function loadLevel(id: string): LoadLevel {
  if (id.startsWith('photo:')) return 'still';
  const load = SCENE_LOAD[id];
  if (!load) return 'medium';
  const total = load.page + load.gpu;
  if (total < 15) return 'light';
  return total <= 17 ? 'medium' : 'heavy';
}
