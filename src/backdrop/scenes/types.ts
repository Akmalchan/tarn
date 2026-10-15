/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

/** A hex color string, e.g. `#0b1220`. */
export type Hex = `#${string}`;

/**
 * A background scene: one fragment shader plus the data it is drawn with.
 *
 * Scenes are data. The renderer owns the loop, sizing, pausing and context
 * handling; a scene only describes what a pixel looks like at a given time.
 */
export interface Scene {
  readonly id: string;
  readonly name: string;
  /** GLSL ES 3.00 fragment body, appended after the shared prelude. */
  readonly fragment: string;
  /** Exactly four colors, exposed to the shader as `uColors[0..3]`. */
  readonly colors: readonly [Hex, Hex, Hex, Hex];
  /** Page color shown before the first frame and behind fades. */
  readonly base: Hex;
  /** Time multiplier. */
  readonly speed: number;
  /**
   * Render resolution relative to CSS pixels. Soft scenes look identical
   * at a fraction of the cost; detailed ones need more.
   */
  readonly resolution: number;
  /**
   * A photo of the user's (`photo:<id>`, from IndexedDB) instead of an
   * animation: drawn once at its own size and left still.
   */
  readonly photo?: {readonly width: number; readonly height: number};
  /** Overrides the tone worked out from `base` (a photo knows its own). */
  readonly tone?: 'light' | 'dark';
}
