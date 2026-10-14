/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Plain date math for the calendar, in the computer's local time. Pure, so
// it's tested directly (dates.test.ts).

/** 0 = Sunday ... 6 = Saturday, as Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Regions whose weeks start on Sunday (the rest start on Monday). */
const SUNDAY_FIRST = new Set([
  'US',
  'CA',
  'MX',
  'BR',
  'JP',
  'KR',
  'TW',
  'HK',
  'IL',
  'PH',
  'IN',
  'ZA',
  'SA',
  'PE',
  'CO',
  'VE',
  'AR',
  'GT',
  'TH',
]);

/** The first day of the week where `tag` is used. */
export function firstWeekday(tag: string): Weekday {
  try {
    const intl = new Intl.Locale(tag) as Intl.Locale & {
      getWeekInfo?: () => {firstDay: number};
      weekInfo?: {firstDay: number};
    };
    // Intl gives 1 = Monday ... 7 = Sunday, where it knows.
    const firstDay = (intl.getWeekInfo?.() ?? intl.weekInfo)?.firstDay;
    if (firstDay) return (firstDay % 7) as Weekday;
    const region = intl.maximize().region ?? '';
    return SUNDAY_FIRST.has(region) ? 0 : 1;
  } catch {
    return 1;
  }
}

/** Local midnight of the day `date` falls on. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "2026-10-13", in local time: a key for a day. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The days of the week `date` is in, from the week's first day. */
export function weekOf(date: Date, first: Weekday): Date[] {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() - first + 7) % 7));
  return Array.from(
    {length: 7},
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/**
 * The weeks a month grid shows for `year`/`month` (0-11): whole weeks from
 * the one holding the 1st to the one holding the last day (4 to 6 weeks).
 */
export function monthWeeks(
  year: number,
  month: number,
  first: Weekday,
): Date[][] {
  const weeks: Date[][] = [];
  let week = weekOf(new Date(year, month, 1), first);
  while (
    week.some(day => day.getMonth() === month && day.getFullYear() === year)
  ) {
    weeks.push(week);
    const next = week[6]!;
    week = weekOf(
      new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1),
      first,
    );
  }
  return weeks;
}

/** Milliseconds until the next local midnight (when "today" changes). */
export function untilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
