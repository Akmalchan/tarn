/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {describe, expect, it} from 'vitest';
import {CALM_AFTER_MS, decidePace, nextPaceCheckMs} from './pace';

const at = (quietMs: number, focused = true, awake = false) => ({
  awake,
  quietMs,
  focused,
});

describe('decidePace', () => {
  it('is active while someone is using the page', () => {
    expect(decidePace(at(0))).toBe('active');
    expect(decidePace(at(CALM_AFTER_MS - 1))).toBe('active');
  });

  it('turns calm after a quiet minute, and stays calm (never stops)', () => {
    expect(CALM_AFTER_MS).toBe(60_000);
    expect(decidePace(at(CALM_AFTER_MS))).toBe('calm');
    expect(decidePace(at(CALM_AFTER_MS * 60))).toBe('calm');
  });

  it('turns calm at once when another app is in front', () => {
    expect(decidePace(at(0, false))).toBe('calm');
  });

  it('stays active while the settings panel is open', () => {
    expect(decidePace(at(CALM_AFTER_MS * 2, false, true))).toBe('active');
  });
});

describe('nextPaceCheckMs', () => {
  it('wakes when the page would turn calm, and not after', () => {
    expect(nextPaceCheckMs(at(1000))).toBe(CALM_AFTER_MS - 1000);
    expect(nextPaceCheckMs(at(CALM_AFTER_MS))).toBeNull();
    expect(nextPaceCheckMs(at(0, true, true))).toBeNull();
  });
});
