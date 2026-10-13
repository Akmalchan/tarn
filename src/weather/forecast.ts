/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {browser} from 'wxt/browser';
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

/**
 * The forecast for a place: a fresh one another widget (or the clock)
 * already fetched, or a new request. Shared by place, so two widgets for
 * the same city make one request between them.
 */
export async function fetchForecast(
  place: Place,
  settings: WeatherSettings,
): Promise<Forecast> {
  const key = cacheKey(place);
  const cached = (await browser.storage.local.get(key))[key];
  if (isCurrent((cached as Forecast | undefined) ?? null, place, settings)) {
    return cached as Forecast;
  }
  const unit = temperatureUnit(settings.units);
  const forecast =
    settings.provider === 'google'
      ? await fetchGoogle(place.lat, place.lon, unit, await getGoogleKey())
      : await fetchOpenMeteo(place.lat, place.lon, unit);
  await browser.storage.local.set({[key]: forecast}).catch(() => {});
  return forecast;
}

function cacheKey(place: Place): string {
  return `weather.cache.${place.lat},${place.lon}`;
}
