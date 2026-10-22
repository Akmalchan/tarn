/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {radioStep} from './radios';

describe('radioStep', () => {
  it('moves to the next or previous option, wrapping around', () => {
    expect(radioStep('ArrowRight', 0, 3)).toBe(1);
    expect(radioStep('ArrowDown', 2, 3)).toBe(0);
    expect(radioStep('ArrowLeft', 0, 3)).toBe(2);
    expect(radioStep('ArrowUp', 1, 3)).toBe(0);
  });

  it('jumps to the ends with Home and End', () => {
    expect(radioStep('Home', 2, 4)).toBe(0);
    expect(radioStep('End', 0, 4)).toBe(3);
  });

  it('leaves other keys alone', () => {
    expect(radioStep('Enter', 0, 3)).toBeNull();
    expect(radioStep(' ', 0, 3)).toBeNull();
    expect(radioStep('Tab', 0, 3)).toBeNull();
    expect(radioStep('ArrowRight', 0, 0)).toBeNull();
  });
});
