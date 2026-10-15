/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import {MAX_MS, cleanDuration, format, parseDuration} from './focus-time';

describe('parseDuration', () => {
  it.each([
    ['45', 45 * 60_000],
    ['0009', 9 * 60_000],
    ['12:30', 12 * 60_000 + 30_000],
    ['1:30:00', 90 * 60_000],
    ['01:05:09', 3_600_000 + 5 * 60_000 + 9000],
    ['90', 90 * 60_000],
    ['0:3', 10_000],
    ['25:', 25 * 60_000],
  ])('reads %j', (text, ms) => {
    expect(parseDuration(text)).toBe(ms);
  });

  it.each(['600', '99999', '9:00:01', '12:00:00', '00000999'])(
    'caps %j at 9 hours',
    text => {
      expect(parseDuration(text)).toBe(MAX_MS);
    },
  );

  it.each(['', '0', '0:00', 'abc', '1:2:3:4', '1::2', ':30', '-5'])(
    'refuses %j',
    text => {
      expect(parseDuration(text)).toBeNull();
    },
  );
});

describe('cleanDuration', () => {
  it.each([
    ['abc0009', '0009'],
    ['1.30.00', '1:30:00'],
    ['1, 30', '1:30'],
    ['12:3x4:56:78', '12:34:56'],
    ['1::30', '1:30'],
    ['25 min', '25:'],
    ['123456789', '12345678'],
  ])('turns %j into %j', (typed, clean) => {
    expect(cleanDuration(typed)).toBe(clean);
  });
});

describe('format', () => {
  it('shows minutes, and hours past an hour', () => {
    expect(format(25 * 60_000)).toBe('25:00');
    expect(format(MAX_MS)).toBe('9:00:00');
    expect(format(61_500)).toBe('1:02');
  });
});
