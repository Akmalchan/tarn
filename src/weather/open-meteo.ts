/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {fromWmo} from './conditions';
import {
  WeatherError,
  type Forecast,
  type Place,
  type TemperatureUnit,
} from './types';

// Open-Meteo (open-meteo.com): free, no key, no account, data under
// CC BY 4.0 (the widget credits it). Only the coordinates (or a typed city
// name, when searching) are sent.

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

interface OpenMeteoResponse {
  timezone?: string;
  utc_offset_seconds?: number;
  current?: {temperature_2m: number; weather_code: number; is_day: number};
  hourly?: {
    time: number[];
    temperature_2m: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily?: {
    time: number[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  unit: TemperatureUnit,
  now = Date.now(),
): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code,is_day',
    hourly: 'temperature_2m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '7',
    temperature_unit: unit,
    timeformat: 'unixtime',
  });
  const data = (await getJson(`${FORECAST}?${params}`)) as OpenMeteoResponse;
  return parseOpenMeteo(data, lat, lon, unit, now);
}

/** Turns an Open-Meteo response into a Forecast. Exported for tests. */
export function parseOpenMeteo(
  data: OpenMeteoResponse,
  lat: number,
  lon: number,
  unit: TemperatureUnit,
  now: number,
): Forecast {
  const {current, hourly, daily} = data;
  if (!current || !hourly || !daily) {
    throw new WeatherError('failed', 'The forecast came back incomplete.');
  }
  const offset = (data.utc_offset_seconds ?? 0) * 1000;
  const hours = hourly.time
    .map((t, i) => ({
      time: t * 1000,
      temp: hourly.temperature_2m[i]!,
      condition: fromWmo(hourly.weather_code[i]!),
      day: hourly.is_day[i] === 1,
    }))
    .filter(h => h.time > now - 3_600_000 && Number.isFinite(h.temp))
    .slice(0, 24);
  const days = daily.time
    .map((t, i) => ({
      date: new Date(t * 1000 + offset).toISOString().slice(0, 10),
      min: daily.temperature_2m_min[i]!,
      max: daily.temperature_2m_max[i]!,
      condition: fromWmo(daily.weather_code[i]!),
    }))
    .filter(d => Number.isFinite(d.min) && Number.isFinite(d.max));
  return {
    provider: 'open-meteo',
    unit,
    lat,
    lon,
    fetched: now,
    timeZone: data.timezone ?? 'UTC',
    now: {
      temp: current.temperature_2m,
      condition: fromWmo(current.weather_code),
      day: current.is_day === 1,
    },
    hours,
    days,
  };
}

interface GeocodingResponse {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }[];
}

/** Places matching a typed name, best first. */
export async function searchPlaces(
  query: string,
  language = typeof navigator === 'undefined' ? 'en' : navigator.language,
): Promise<Place[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const params = new URLSearchParams({
    name,
    count: '6',
    language: language.split('-')[0] ?? 'en',
    format: 'json',
  });
  const data = (await getJson(`${GEOCODING}?${params}`)) as GeocodingResponse;
  return (data.results ?? []).map(r => ({
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
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
  if (response.status === 429) {
    throw new WeatherError('quota', 'Too many requests; trying again later.');
  }
  if (!response.ok) {
    throw new WeatherError(
      'failed',
      `Weather service error ${response.status}.`,
    );
  }
  return response.json();
}
