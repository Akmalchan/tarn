/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {Pace} from './renderer';

/** No mouse, keyboard or scrolling for this long: the scene turns calm. */
export const CALM_AFTER_MS = 30_000;
/** ...and after this long, it glides to a stop until the page is used. */
export const STOP_AFTER_MS = 3 * 60_000;

export interface PaceInput {
  /** Keep fully lively whatever happens (the settings panel is open). */
  awake: boolean;
  /** Time since the last real input. */
  quietMs: number;
  /** Whether this window has focus (false: another app is in front). */
  focused: boolean;
}

/** How lively the scene should be right now. */
export function decidePace({awake, quietMs, focused}: PaceInput): Pace {
  if (awake) return 'active';
  if (quietMs >= STOP_AFTER_MS) return 'still';
  if (quietMs >= CALM_AFTER_MS || !focused) return 'calm';
  return 'active';
}

/** When to look again: the next threshold still ahead, or null if none. */
export function nextPaceCheckMs({awake, quietMs}: PaceInput): number | null {
  if (awake) return null;
  if (quietMs < CALM_AFTER_MS) return CALM_AFTER_MS - quietMs;
  if (quietMs < STOP_AFTER_MS) return STOP_AFTER_MS - quietMs;
  return null;
}
