/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {bump, picks} from './recent';

describe('bump', () => {
  it('keeps the card still when the pick is already on it', () => {
    expect(bump(['a', 'b', 'c'], ['x'], 'b')).toEqual(['a', 'b', 'c', 'x']);
  });

  it('puts a pick from Show All first', () => {
    expect(bump(['a', 'b', 'c'], ['a', 'b', 'c', 'd'], 'e')).toEqual([
      'e',
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('keeps at most eight', () => {
    const long = ['1', '2', '3', '4', '5', '6', '7', '8'];
    expect(bump(['1', '2', '3'], long, 'new')).toHaveLength(8);
  });
});

describe('picks', () => {
  const all = new Set(['a', 'b', 'c', 'd', 'e']);
  const exists = (id: string) => all.has(id);

  it('shows recent picks, then the defaults', () => {
    expect(picks(['d'], ['a', 'b', 'c'], 3, 'd', exists)).toEqual([
      'd',
      'a',
      'b',
    ]);
  });

  it('skips what no longer exists and repeats nothing', () => {
    expect(picks(['gone', 'a', 'a'], ['a', 'b'], 3, 'a', exists)).toEqual([
      'a',
      'b',
    ]);
  });

  it('always shows the current one', () => {
    expect(picks(['a', 'b', 'c'], [], 3, 'e', exists)).toEqual(['a', 'b', 'e']);
  });
});
