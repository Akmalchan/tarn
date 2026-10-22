/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

/**
 * How big a custom tile may draw. One draw call can't be interrupted, and
 * the GPU is shared by the whole browser, so a new program never starts
 * at full size: it starts at the smallest step and moves up only while the
 * GPU finishes each frame before the next one is due (a fence per tile).
 * Falling behind steps it down, for good; behind at the smallest step, it
 * pauses.
 */

/** Resolution steps, from full size down. */
export const SCALES = [1, 0.5, 0.25];
/** Frames a tile may fall behind before it steps down. */
const LATE_LIMIT = 12;
/** Frames in a row done in time before it tries the next step up. */
const RISE_AFTER = 2;
/** Frames after which it shows, even while still finding its step. */
const SHOW_AFTER = 30;

export class TileBudget {
  /** Index into SCALES: 0 is full size. */
  private level = SCALES.length - 1;
  /** The biggest step left to try; one it fell behind at isn't tried again. */
  private top = 0;
  private late = 0;
  private steady = 0;
  private frames = 0;

  get scale(): number {
    return SCALES[this.level]!;
  }

  /** Its frames are worth showing: it's at its step, or it tried long enough. */
  get settled(): boolean {
    return this.level === this.top || this.frames >= SHOW_AFTER;
  }

  /** Back to the smallest step (a restored context), keeping what it learned. */
  restart(): void {
    this.level = SCALES.length - 1;
    this.late = this.steady = this.frames = 0;
  }

  /**
   * Its last frame is done: `inTime` before the next was due, or after
   * waiting (each wait already counted as behind).
   */
  done(inTime: boolean): void {
    this.frames++;
    if (!inTime) return;
    this.late = Math.max(0, this.late - 1);
    if (++this.steady < RISE_AFTER || this.level <= this.top) return;
    this.level--;
    this.steady = 0;
  }

  /** Its last frame isn't done yet. True: too heavy even at the smallest step. */
  behind(): boolean {
    this.steady = 0;
    if (++this.late < LATE_LIMIT) return false;
    this.late = 0;
    if (this.level === SCALES.length - 1) return true;
    this.level++;
    this.top = this.level;
    return false;
  }
}
