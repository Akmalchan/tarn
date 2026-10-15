/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

/**
 * One event on the calendar. Sources (a calendar link, a provider, events
 * typed in Tarn) all turn what they have into this shape, so the widget
 * never needs to know where an event came from.
 */
export interface CalendarEvent {
  /** Unique within its source. */
  readonly id: string;
  readonly title: string;
  /** Start and end, epoch ms; an all-day event spans whole local days. */
  readonly start: number;
  readonly end: number;
  readonly allDay: boolean;
  /** Which source it came from (its `id`). */
  readonly source: string;
}

/** A span of time to fetch events for, epoch ms, end exclusive. */
export interface DateRange {
  readonly from: number;
  readonly to: number;
}

/**
 * Where events come from. None is built in yet: the calendar shows dates
 * only. A later source (an ICS/CalDAV link, a provider) implements this and
 * registers itself; the network rules in AGENTS.md apply to it.
 */
export interface EventSource {
  readonly id: string;
  /** The events that overlap `range`, in any order. */
  events(range: DateRange): Promise<readonly CalendarEvent[]>;
}
