/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {browser} from 'wxt/browser';
import type {WeatherUnits} from '../settings/schema';
import type {TemperatureUnit} from './types';

/**
 * The user's Google Weather API key. Kept in storage.local on this computer
 * only: never synced, never in a backup file, never sent anywhere but
 * Google's Weather API.
 */
const KEY = 'weather.googleKey';

export async function getGoogleKey(): Promise<string> {
  const stored = await browser.storage.local.get(KEY);
  const key: unknown = stored[KEY];
  return typeof key === 'string' ? key : '';
}

export async function setGoogleKey(key: string): Promise<void> {
  const trimmed = key.trim().slice(0, 200);
  if (trimmed) await browser.storage.local.set({[KEY]: trimmed});
  else await browser.storage.local.remove(KEY);
}

/** Calls `listener` when the Google key is saved or removed. */
export function watchGoogleKey(listener: () => void): () => void {
  const onChanged = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && KEY in changes) listener();
  };
  browser.storage.onChanged.addListener(onChanged);
  return () => browser.storage.onChanged.removeListener(onChanged);
}

/** Places where °F is the everyday unit. */
const FAHRENHEIT_REGIONS = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW']);

/** The unit to show: the setting, or for 'auto' the language's region. */
export function temperatureUnit(
  units: WeatherUnits,
  language = typeof navigator === 'undefined' ? 'en-US' : navigator.language,
): TemperatureUnit {
  if (units !== 'auto') return units;
  try {
    const region = new Intl.Locale(language).maximize().region ?? '';
    return FAHRENHEIT_REGIONS.has(region) ? 'fahrenheit' : 'celsius';
  } catch {
    return 'celsius';
  }
}

/** Coordinates rounded to two decimals (~1 km): enough for weather. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
