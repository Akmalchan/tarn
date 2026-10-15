/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import type {CalendarEvent, DateRange, EventSource} from './types';

// The registry of event sources. Empty for now: the calendar is dates only,
// offline. A source added later registers here and every calendar widget
// shows its events, with no change to the widget.

const sources = new Map<string, EventSource>();

export function registerSource(source: EventSource): void {
  sources.set(source.id, source);
}

export function hasSources(): boolean {
  return sources.size > 0;
}

/**
 * Every source's events in `range`, sorted by start. A source that fails is
 * left out rather than failing the rest.
 */
export async function eventsIn(range: DateRange): Promise<CalendarEvent[]> {
  if (!sources.size) return [];
  const results = await Promise.allSettled(
    [...sources.values()].map(source => source.events(range)),
  );
  return results
    .flatMap(result => (result.status === 'fulfilled' ? result.value : []))
    .filter(event => event.end > range.from && event.start < range.to)
    .sort((a, b) => a.start - b.start);
}
