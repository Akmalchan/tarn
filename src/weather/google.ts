/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {fromGoogle} from './conditions';
import {WeatherError, type Forecast, type TemperatureUnit} from './types';

// Google's Weather API (Google Maps Platform), with the user's own API key:
// requests are billed to their Google Cloud project, which needs the
// Weather API enabled. Google asks for the credit "Includes weather data
// from Google" next to the data; the widget shows it.

const BASE = 'https://weather.googleapis.com/v1';

interface GoogleTemperature {
  degrees?: number;
}

interface GoogleCurrent {
  temperature?: GoogleTemperature;
  weatherCondition?: {type?: string};
  isDaytime?: boolean;
  timeZone?: {id?: string};
}

interface GoogleHours {
  forecastHours?: {
    interval?: {startTime?: string};
    temperature?: GoogleTemperature;
    weatherCondition?: {type?: string};
    isDaytime?: boolean;
  }[];
  timeZone?: {id?: string};
}

interface GoogleDays {
  forecastDays?: {
    displayDate?: {year?: number; month?: number; day?: number};
    maxTemperature?: GoogleTemperature;
    minTemperature?: GoogleTemperature;
    daytimeForecast?: {weatherCondition?: {type?: string}};
  }[];
  timeZone?: {id?: string};
}

export async function fetchGoogle(
  lat: number,
  lon: number,
  unit: TemperatureUnit,
  key: string,
  now = Date.now(),
): Promise<Forecast> {
  if (!key) {
    throw new WeatherError('key', 'Add your Google API key in Settings.');
  }
  const query = (extra: Record<string, string>) =>
    new URLSearchParams({
      key,
      'location.latitude': String(lat),
      'location.longitude': String(lon),
      unitsSystem: unit === 'fahrenheit' ? 'IMPERIAL' : 'METRIC',
      ...extra,
    });
  const [current, hours, days] = await Promise.all([
    getJson(`${BASE}/currentConditions:lookup?${query({})}`),
    getJson(
      `${BASE}/forecast/hours:lookup?${query({hours: '24', pageSize: '24'})}`,
    ),
    getJson(
      `${BASE}/forecast/days:lookup?${query({days: '7', pageSize: '7'})}`,
    ),
  ]);
  return parseGoogle(
    current as GoogleCurrent,
    hours as GoogleHours,
    days as GoogleDays,
    lat,
    lon,
    unit,
    now,
  );
}

/** Turns Google's three responses into a Forecast. Exported for tests. */
export function parseGoogle(
  current: GoogleCurrent,
  hours: GoogleHours,
  days: GoogleDays,
  lat: number,
  lon: number,
  unit: TemperatureUnit,
  now: number,
): Forecast {
  const temp = current.temperature?.degrees;
  if (typeof temp !== 'number') {
    throw new WeatherError('failed', 'The forecast came back incomplete.');
  }
  const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');
  return {
    provider: 'google',
    unit,
    lat,
    lon,
    fetched: now,
    timeZone:
      current.timeZone?.id ?? hours.timeZone?.id ?? days.timeZone?.id ?? 'UTC',
    now: {
      temp,
      condition: fromGoogle(current.weatherCondition?.type ?? ''),
      day: current.isDaytime ?? true,
    },
    hours: (hours.forecastHours ?? [])
      .map(h => ({
        time: Date.parse(h.interval?.startTime ?? ''),
        temp: h.temperature?.degrees ?? NaN,
        condition: fromGoogle(h.weatherCondition?.type ?? ''),
        day: h.isDaytime ?? true,
      }))
      .filter(h => Number.isFinite(h.time) && Number.isFinite(h.temp))
      .slice(0, 24),
    days: (days.forecastDays ?? [])
      .map(d => ({
        date: `${d.displayDate?.year ?? 0}-${pad(d.displayDate?.month)}-${pad(d.displayDate?.day)}`,
        min: d.minTemperature?.degrees ?? NaN,
        max: d.maxTemperature?.degrees ?? NaN,
        condition: fromGoogle(d.daytimeForecast?.weatherCondition?.type ?? ''),
      }))
      .filter(d => Number.isFinite(d.min) && Number.isFinite(d.max)),
  };
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      // A stalled request gives up rather than holding back every refresh.
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WeatherError('offline', 'No connection.');
  }
  if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 403
  ) {
    throw new WeatherError(
      'key',
      'Google didn’t accept the API key. Check it in Settings, and that the Weather API is enabled for it.',
    );
  }
  if (response.status === 429) {
    throw new WeatherError('quota', 'The Google API key is over its quota.');
  }
  if (!response.ok) {
    throw new WeatherError(
      'failed',
      `Weather service error ${response.status}.`,
    );
  }
  return response.json();
}
