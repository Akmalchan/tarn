/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {describe, expect, it} from 'vitest';
import {clockText, splitTime} from './clock-faces';

describe('clockText', () => {
  const evening = new Date(2026, 9, 13, 21, 40);

  it.each([
    ['en-US', '9:40'],
    ['en-GB', '21:40'],
    ['ko', '9:40'],
    ['ja', '21:40'],
    ['de', '21:40'],
    ['fi', '21.40'],
  ])('writes the time as %s does, without AM/PM', (tag, text) => {
    expect(clockText(evening, tag)).toBe(text);
  });

  it('gives the stacked face two numbers in every language', () => {
    expect(splitTime(clockText(evening, 'ko'))).toEqual(['09', '40']);
  });
});
