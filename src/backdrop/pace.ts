/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import type {Pace} from './renderer';

/** No mouse, keyboard or scrolling for this long: the scene turns calm. */
export const CALM_AFTER_MS = 60_000;

export interface PaceInput {
  /** Keep fully lively whatever happens (the settings panel is open). */
  awake: boolean;
  /** Time since the last real input. */
  quietMs: number;
}

/** How lively the scene should be right now. */
export function decidePace({awake, quietMs}: PaceInput): Pace {
  if (awake) return 'active';
  return quietMs >= CALM_AFTER_MS ? 'calm' : 'active';
}

/** When to look again: when the page would turn calm, or null if never. */
export function nextPaceCheckMs({awake, quietMs}: PaceInput): number | null {
  if (awake || quietMs >= CALM_AFTER_MS) return null;
  return CALM_AFTER_MS - quietMs;
}
