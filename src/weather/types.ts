/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import type {WeatherProvider} from '../settings/schema';

/** Tarn's own small set of conditions; each provider maps onto it. */
export type Condition =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'sleet'
  | 'snow'
  | 'storm'
  | 'wind';

export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** A place to forecast. Coordinates are rounded to ~1 km before use. */
export interface Place {
  readonly name: string;
  /** Region and country, for telling places with the same name apart. */
  readonly detail?: string;
  readonly lat: number;
  readonly lon: number;
  /** The user's own position: its name is shown in the current language. */
  readonly here?: boolean;
}

export interface HourForecast {
  /** Start of the hour (epoch ms). */
  readonly time: number;
  readonly temp: number;
  readonly condition: Condition;
  readonly day: boolean;
}

export interface DayForecast {
  /** The place's local date, YYYY-MM-DD. */
  readonly date: string;
  readonly min: number;
  readonly max: number;
  readonly condition: Condition;
}

/** Everything the widget draws, kept small enough to cache. */
export interface Forecast {
  readonly provider: WeatherProvider;
  readonly unit: TemperatureUnit;
  /** Where it's for, to notice a changed place. */
  readonly lat: number;
  readonly lon: number;
  /** When it was fetched (epoch ms). */
  readonly fetched: number;
  /** The place's IANA time zone, for its local hours and days. */
  readonly timeZone: string;
  readonly now: {
    readonly temp: number;
    readonly condition: Condition;
    readonly day: boolean;
  };
  /** The next 24 hours. */
  readonly hours: readonly HourForecast[];
  /** Today and the next six days. */
  readonly days: readonly DayForecast[];
}

/** A request that failed in a way the user can fix or should know about. */
export class WeatherError extends Error {
  constructor(
    readonly reason: 'offline' | 'key' | 'quota' | 'failed',
    message: string,
  ) {
    super(message);
  }
}
