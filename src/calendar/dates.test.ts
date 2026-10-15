/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import {dayKey, firstWeekday, monthWeeks, untilMidnight, weekOf} from './dates';

describe('calendar dates', () => {
  it('starts the week where the language region does', () => {
    expect(firstWeekday('en-US')).toBe(0);
    expect(firstWeekday('en-GB')).toBe(1);
    expect(firstWeekday('de')).toBe(1);
    expect(firstWeekday('ja')).toBe(0);
  });

  it('lays out whole weeks for a month', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const monday = monthWeeks(2026, 9, 1);
    expect(monday).toHaveLength(5);
    expect(dayKey(monday[0]![0]!)).toBe('2026-09-28');
    expect(dayKey(monday.at(-1)!.at(-1)!)).toBe('2026-11-01');
    const sunday = monthWeeks(2026, 9, 0);
    expect(dayKey(sunday[0]![0]!)).toBe('2026-09-27');
    expect(sunday.every(week => week.length === 7)).toBe(true);
  });

  it('can need six weeks', () => {
    // August 2026 starts on a Saturday: six Monday-first weeks.
    expect(monthWeeks(2026, 7, 1)).toHaveLength(6);
  });

  it('finds the week of a day, across a month end', () => {
    const week = weekOf(new Date(2026, 10, 1), 1);
    expect(week.map(dayKey)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('counts down to midnight', () => {
    expect(untilMidnight(new Date(2026, 9, 13, 23, 59))).toBe(60_000);
  });
});
