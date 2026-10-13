/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
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

export async function fetchForecast(
  place: Place,
  settings: WeatherSettings,
): Promise<Forecast> {
  const unit = temperatureUnit(settings.units);
  return settings.provider === 'google'
    ? fetchGoogle(place.lat, place.lon, unit, await getGoogleKey())
    : fetchOpenMeteo(place.lat, place.lon, unit);
}
