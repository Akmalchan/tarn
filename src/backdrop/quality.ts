/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Adaptive quality. A background must never cost the page smoothness, so the
// renderer watches how evenly its own frames arrive and trades resolution
// and frame rate for headroom when the device struggles. Soft scenes lose
// almost nothing visible at lower resolution.

export interface QualityLevel {
  /** Multiplier on the scene's own render resolution. */
  readonly scale: number;
  readonly fps: number;
}

export const QUALITY_LEVELS: readonly QualityLevel[] = [
  {scale: 1, fps: 30},
  {scale: 0.8, fps: 30},
  {scale: 0.64, fps: 24},
  {scale: 0.5, fps: 20},
];

/** Frames per evaluation window (about 1.5s at 30fps). */
const WINDOW = 45;
/** A frame is late if it arrives this much later than its target interval. */
const LATE_FACTOR = 1.5;
/** Step down when more than this share of a window was late. */
const DOWNGRADE_RATIO = 0.25;
/** A window this clean counts toward stepping back up. */
const CLEAN_RATIO = 0.03;
/** Clean windows needed before trying a higher level (about 20s). */
const UPGRADE_AFTER = 14;
/** Windows after an upgrade during which a downgrade proves it too high. */
const PROBATION = 4;
/** Gaps longer than this are pauses (hidden tab, busy system), not load. */
const IGNORE_OVER_MS = 250;

/** Where to start, from cheap hardware hints, before any frame is measured. */
export function initialQualityLevel(hints: {
  cores?: number;
  memoryGb?: number;
}): number {
  let level = 0;
  if (hints.cores !== undefined && hints.cores <= 4) level++;
  if (hints.memoryGb !== undefined && hints.memoryGb <= 4) level++;
  return Math.min(level, QUALITY_LEVELS.length - 1);
}

export class QualityGovernor {
  private frames = 0;
  private late = 0;
  private cleanWindows = 0;
  private probation = 0;
  /** Best (lowest) level this device has proven it can sustain. */
  private ceiling = 0;

  constructor(private current = 0) {}

  get level(): QualityLevel {
    return QUALITY_LEVELS[this.current]!;
  }

  get index(): number {
    return this.current;
  }

  get frameIntervalMs(): number {
    return 1000 / this.level.fps;
  }

  /** Records the time between two drawn frames. Returns true on a change. */
  record(intervalMs: number): boolean {
    if (intervalMs > IGNORE_OVER_MS) return false;
    this.frames++;
    if (intervalMs > this.frameIntervalMs * LATE_FACTOR) this.late++;
    if (this.frames < WINDOW) return false;

    const ratio = this.late / this.frames;
    this.frames = 0;
    this.late = 0;
    if (this.probation > 0) this.probation--;

    if (ratio > DOWNGRADE_RATIO && this.current < QUALITY_LEVELS.length - 1) {
      // Failing right after stepping up: that level is out of reach.
      if (this.probation > 0) this.ceiling = this.current + 1;
      this.current++;
      this.cleanWindows = 0;
      this.probation = 0;
      return true;
    }
    if (ratio < CLEAN_RATIO) {
      if (++this.cleanWindows >= UPGRADE_AFTER && this.current > this.ceiling) {
        this.current--;
        this.cleanWindows = 0;
        this.probation = PROBATION;
        return true;
      }
    } else {
      this.cleanWindows = 0;
    }
    return false;
  }
}
