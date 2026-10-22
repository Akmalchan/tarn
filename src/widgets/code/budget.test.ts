/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {SCALES, TileBudget} from './budget';

const smallest = SCALES[SCALES.length - 1];

/** Frames that finish in time. */
function onTime(budget: TileBudget, count: number) {
  for (let i = 0; i < count; i++) budget.done(true);
}

/** Frame checks while the GPU is still busy; true once it pauses. */
function behind(budget: TileBudget, count: number): boolean {
  for (let i = 0; i < count; i++) if (budget.behind()) return true;
  return false;
}

describe('TileBudget', () => {
  it('starts a new program at the smallest step, unshown', () => {
    const budget = new TileBudget();
    expect(budget.scale).toBe(smallest);
    expect(budget.settled).toBe(false);
  });

  it('steps up while frames finish in time, and shows at full size', () => {
    const budget = new TileBudget();
    onTime(budget, 2);
    expect(budget.scale).toBe(0.5);
    onTime(budget, 2);
    expect(budget.scale).toBe(1);
    expect(budget.settled).toBe(true);
  });

  it('needs frames in a row in time to step up', () => {
    const budget = new TileBudget();
    onTime(budget, 1);
    budget.behind();
    onTime(budget, 1);
    expect(budget.scale).toBe(smallest);
  });

  it('falls behind when every frame takes longer than one', () => {
    const budget = new TileBudget();
    for (let i = 0; i < 11; i++) {
      budget.behind();
      budget.done(false);
    }
    expect(behind(budget, 1)).toBe(true);
  });

  it('pauses code too heavy at the smallest step, never trying full size', () => {
    const budget = new TileBudget();
    expect(behind(budget, 11)).toBe(false);
    expect(budget.scale).toBe(smallest);
    expect(behind(budget, 1)).toBe(true);
  });

  it('steps down where it falls behind, and never tries that step again', () => {
    const budget = new TileBudget();
    onTime(budget, 4);
    expect(budget.scale).toBe(1);
    behind(budget, 12);
    expect(budget.scale).toBe(0.5);
    expect(budget.settled).toBe(true);
    onTime(budget, 50);
    expect(budget.scale).toBe(0.5);
  });

  it('shows after a while even if it never settles', () => {
    const budget = new TileBudget();
    for (let i = 0; i < 30; i++) {
      if (i % 2 === 0) budget.behind();
      budget.done(i % 2 !== 0);
    }
    expect(budget.scale).toBe(smallest);
    expect(budget.settled).toBe(true);
  });

  it('restarts small after a lost context, keeping what it learned', () => {
    const budget = new TileBudget();
    onTime(budget, 4);
    behind(budget, 12);
    budget.restart();
    expect(budget.scale).toBe(smallest);
    onTime(budget, 20);
    expect(budget.scale).toBe(0.5);
  });
});
