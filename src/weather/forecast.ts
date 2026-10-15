/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import type {WeatherSettings} from '../settings/schema';
import {getGoogleKey, temperatureUnit} from './config';
import {fetchGoogle} from './google';
import {fetchOpenMeteo} from './open-meteo';
import type {Forecast, Place} from './types';

/** A forecast is refreshed at most this often (and only while visible). */
export const REFRESH_MS = 30 * 60_000;

/** Whether `forecast` still answers for this place and these settings. */
export function isCurrent(
  forecast: Forecast | null,
  place: Place,
  settings: WeatherSettings,
  now = Date.now(),
): forecast is Forecast {
  return (
    forecast !== null &&
    forecast.provider === settings.provider &&
    forecast.unit === temperatureUnit(settings.units) &&
    forecast.lat === place.lat &&
    forecast.lon === place.lon &&
    now - forecast.fetched < REFRESH_MS
  );
}

/** Requests under way, so widgets showing one place share a request. */
const inFlight = new Map<string, Promise<Forecast>>();

/**
 * The forecast for a place. Widgets for the same place at the same moment
 * share one request.
 */
export function fetchForecast(
  place: Place,
  settings: WeatherSettings,
): Promise<Forecast> {
  const unit = temperatureUnit(settings.units);
  const key = `${settings.provider}|${unit}|${place.lat},${place.lon}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = (async () =>
    settings.provider === 'google'
      ? fetchGoogle(place.lat, place.lon, unit, await getGoogleKey())
      : fetchOpenMeteo(place.lat, place.lon, unit))().finally(() =>
    inFlight.delete(key),
  );
  inFlight.set(key, request);
  return request;
}
