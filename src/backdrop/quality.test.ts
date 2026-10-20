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
});
