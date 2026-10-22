/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import type {WeatherSettings} from '../settings/schema';
import {getGoogleKey, roundCoordinate, temperatureUnit} from './config';
import {fetchGoogle} from './google';
import {fetchOpenMeteo} from './open-meteo';
import type {DayForecast, Forecast, Place} from './types';

/** A forecast is refreshed at most this often (and only while visible). */
export const REFRESH_MS = 30 * 60_000;
/** After a failed request, try again this much later. */
export const RETRY_MS = 5 * 60_000;
/** After a rejected key or a used-up quota: until the key changes, or this. */
export const KEY_RETRY_MS = 6 * 60 * 60_000;
/** A time a little ahead of now still counts (clocks differ by seconds). */
const AHEAD_MS = 60_000;

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
    now - forecast.fetched < REFRESH_MS &&
    // Stamped in the future, the clock was put back: not to be trusted, or
    // it would never refresh.
    forecast.fetched <= now + AHEAD_MS
  );
}

/**
 * Whether a failed update is still waiting its turn. A wait longer than
 * any Tarn sets means the clock was put back: it's over.
 */
export function isWaiting(
  retryAt: number | undefined,
  now = Date.now(),
): retryAt is number {
  return (
    retryAt !== undefined &&
    retryAt > now &&
    retryAt <= now + KEY_RETRY_MS + AHEAD_MS
  );
}

/**
 * The forecast's days from today on, today in the place's own time zone:
 * a forecast from yesterday (a night offline) doesn't call yesterday
 * "Today", or show its high and low.
 */
export function daysFrom(
  forecast: Forecast,
  now = Date.now(),
): readonly DayForecast[] {
  const today = localDate(now, forecast.timeZone);
  return today ? forecast.days.filter(day => day.date >= today) : forecast.days;
}

/** The date at `time` in `timeZone`, YYYY-MM-DD; null for an unknown zone. */
export function localDate(time: number, timeZone: string): string | null {
  try {
    // Digits only, never shown: a fixed locale keeps them Latin.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(time);
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return null;
  }
}

/**
 * Whether new settings could fix a failed update, so the wait after it is
 * forgotten. The first settings a page loads are not a change: the wait
 * holds across new tabs.
 */
export function settingsChanged(
  before: WeatherSettings | null,
  after: WeatherSettings,
): boolean {
  return (
    before !== null &&
    (after.provider !== before.provider || after.units !== before.units)
  );
}

/**
 * The settings this computer can use. The provider syncs but the Google
 * key stays on each computer, so without a key here it's Open-Meteo (the
 * panel says so) rather than an error in every Weather widget.
 */
export function usableSettings(
  settings: WeatherSettings,
  hasKey: boolean,
): WeatherSettings {
  return settings.provider === 'google' && !hasKey
    ? {...settings, provider: 'open-meteo'}
    : settings;
}

/** Requests under way, so widgets showing one place share a request. */
const inFlight = new Map<string, Promise<Forecast>>();

/** Names a place's forecast: the same key is the same request. */
export function forecastKey(place: Place, settings: WeatherSettings): string {
  const unit = temperatureUnit(settings.units);
  return `${settings.provider}|${unit}|${place.lat},${place.lon}`;
}

/** How long a page may hold a place's request (one gives up after 15 s). */
const CLAIM_MS = 20_000;
const CLAIM_PREFIX = 'tarn.weather.fetching.';
/** This page, to tell its own claims (shared by its widgets) from others'. */
const PAGE = Math.random().toString(36).slice(2, 10);
/** Claims this page holds: a tab closed mid-request lets go of them. */
const held = new Set<string>();
let releasing = false;

function pageStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Two visible windows wake together every 30 minutes for the same place.
 * The first to claim it fetches; the other waits for the result, which
 * arrives through the widget's stored data, or for the claim to run out
 * (a closed window). Gives 0 when this page may fetch now, otherwise how
 * long to wait (ms). Widgets in one page share their claim, as they share
 * the request.
 */
export function claimFetch(
  key: string,
  now = Date.now(),
  storage = pageStorage(),
  page = PAGE,
): number {
  try {
    const [owner, until] = (storage?.getItem(CLAIM_PREFIX + key) ?? '').split(
      ' ',
    );
    const end = Number(until);
    // A claim further ahead than any page makes: the clock was put back.
    if (owner !== page && end > now && end <= now + CLAIM_MS) return end - now;
    storage?.setItem(CLAIM_PREFIX + key, `${page} ${now + CLAIM_MS}`);
    held.add(key);
    if (!releasing && typeof addEventListener === 'function') {
      releasing = true;
      addEventListener('pagehide', () => {
        for (const claim of held) releaseFetch(claim);
      });
    }
  } catch {
    // No storage: every window fetches for itself, as before.
  }
  return 0;
}

/** The request is done (or failed): the next window may go. */
export function releaseFetch(
  key: string,
  storage = pageStorage(),
  page = PAGE,
): void {
  held.delete(key);
  try {
    const value = storage?.getItem(CLAIM_PREFIX + key) ?? '';
    if (value.split(' ')[0] === page) storage?.removeItem(CLAIM_PREFIX + key);
  } catch {
    // Runs out by itself.
  }
}

/**
 * The forecast for a place. Widgets for the same place at the same moment
 * share one request.
 */
export function fetchForecast(
  place: Place,
  settings: WeatherSettings,
): Promise<Forecast> {
  const unit = temperatureUnit(settings.units);
  const key = forecastKey(place, settings);
  const pending = inFlight.get(key);
  if (pending) return pending;
  // Places are stored rounded; rounding again here keeps the promise for
  // one that wasn't (an imported file, an older Tarn).
  const lat = roundCoordinate(place.lat);
  const lon = roundCoordinate(place.lon);
  const request = (async () =>
    settings.provider === 'google'
      ? fetchGoogle(lat, lon, unit, await getGoogleKey())
      : fetchOpenMeteo(lat, lon, unit))().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
