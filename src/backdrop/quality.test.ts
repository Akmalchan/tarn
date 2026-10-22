/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {QUALITY_LEVELS, QualityGovernor, initialQualityLevel} from './quality';

/** Feeds frames at the given interval until `count` frames have passed. */
function run(governor: QualityGovernor, intervalMs: number, count: number) {
  for (let i = 0; i < count; i++) governor.record(intervalMs);
}

describe('initialQualityLevel', () => {
  it('starts high on capable hardware', () => {
    expect(initialQualityLevel({cores: 10, memoryGb: 16})).toBe(0);
  });

  it('starts lower on weak hardware', () => {
    expect(initialQualityLevel({cores: 4, memoryGb: 8})).toBe(1);
    expect(initialQualityLevel({cores: 2, memoryGb: 4})).toBe(2);
  });

  it('starts high when hints are missing', () => {
    expect(initialQualityLevel({})).toBe(0);
  });
});

describe('QualityGovernor', () => {
  it('holds steady when frames are on time', () => {
    const g = new QualityGovernor();
    run(g, 1000 / 30, 2000);
    expect(g.index).toBe(0);
  });

  it('steps down when frames run late', () => {
    const g = new QualityGovernor();
    run(g, 80, 45);
    expect(g.index).toBe(1);
    expect(g.level).toEqual(QUALITY_LEVELS[1]);
  });

  it('never goes below the lowest level', () => {
    const g = new QualityGovernor();
    run(g, 120, 45 * 20);
    expect(g.index).toBe(QUALITY_LEVELS.length - 1);
  });

  it('ignores long pauses such as a hidden tab', () => {
    const g = new QualityGovernor();
    run(g, 5000, 200);
    expect(g.index).toBe(0);
  });

  it('steps back up after a long clean stretch', () => {
    const g = new QualityGovernor(2);
    run(g, g.frameIntervalMs, 45 * 14);
    expect(g.index).toBe(1);
  });

  it('stops retrying a level that failed right after stepping up to it', () => {
    const g = new QualityGovernor(2);
    run(g, g.frameIntervalMs, 45 * 14); // up to 1
    expect(g.index).toBe(1);
    run(g, 80, 45); // fails during probation: back to 2, ceiling 2
    expect(g.index).toBe(2);
    run(g, g.frameIntervalMs, 45 * 60);
    expect(g.index).toBe(2);
  });

  describe('cantKeepUp', () => {
    const bottom = QUALITY_LEVELS.length - 1;
    /** Feeds `ms` of frames at `intervalMs`. */
    const runFor = (g: QualityGovernor, intervalMs: number, ms: number) =>
      run(g, intervalMs, Math.round(ms / intervalMs));
    // 80 ms frames are late at every level (20 fps wants 50, late at 75);
    // a window of 45 of them lasts 3.6 s.

    it('gives up once the lowest level stays late for about 10 s', () => {
      const g = new QualityGovernor(bottom);
      runFor(g, 80, 5000 + 8000); // the grace, then 8 s late
      expect(g.cantKeepUp).toBe(false);
      runFor(g, 80, 2000 + 3600); // 10 s, and the window it ends in
      expect(g.cantKeepUp).toBe(true);
    });

    it('steps down through every level before counting', () => {
      const g = new QualityGovernor();
      runFor(g, 80, 3 * 3600);
      expect(g.index).toBe(bottom);
      expect(g.cantKeepUp).toBe(false);
      runFor(g, 80, 3 * 3600);
      expect(g.cantKeepUp).toBe(true);
    });

    it('never gives up while frames keep pace, at any level', () => {
      for (let level = 0; level <= bottom; level++) {
        const g = new QualityGovernor(level);
        runFor(g, g.frameIntervalMs, 120_000);
        expect(g.cantKeepUp).toBe(false);
      }
    });

    it('starts over after a window that kept up', () => {
      const g = new QualityGovernor(bottom);
      runFor(g, 80, 5000 + 7200);
      run(g, 50, 90); // a window on time
      runFor(g, 80, 7200);
      expect(g.cantKeepUp).toBe(false);
    });

    it('ignores pauses such as a hidden tab', () => {
      const g = new QualityGovernor(bottom);
      run(g, 5000, 500);
      expect(g.cantKeepUp).toBe(false);
    });

    it('waits out the grace again after a restart', () => {
      const g = new QualityGovernor(bottom);
      runFor(g, 80, 5000 + 7200);
      g.restartWatch();
      runFor(g, 80, 9000);
      expect(g.cantKeepUp).toBe(false);
      runFor(g, 80, 10_800);
      expect(g.cantKeepUp).toBe(true);
    });

    it('counts only frames late enough to step down', () => {
      // A steady 15 fps (67 ms) at the lowest level is not late (75 ms).
      const g = new QualityGovernor(bottom);
      runFor(g, 67, 60_000);
      expect(g.cantKeepUp).toBe(false);
    });
  });
});
