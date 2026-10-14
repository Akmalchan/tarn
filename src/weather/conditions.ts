/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {t} from '../i18n';
import type {Condition} from './types';

/** WMO weather interpretation codes (Open-Meteo) to Tarn's conditions. */
export function fromWmo(code: number): Condition {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code === 56 || code === 57 || code === 66 || code === 67) return 'sleet';
  if (code >= 51 && code <= 55) return 'drizzle';
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

/** Google Weather condition types (e.g. MOSTLY_CLEAR) to Tarn's conditions. */
export function fromGoogle(type: string): Condition {
  const t = type.toUpperCase();
  if (t.includes('THUNDER')) return 'storm';
  if (t.includes('HAIL') || t === 'RAIN_AND_SNOW') return 'sleet';
  if (t.includes('SNOW')) return 'snow';
  if (t === 'LIGHT_RAIN' || t === 'LIGHT_RAIN_SHOWERS') return 'drizzle';
  if (t.includes('RAIN') || t.includes('SHOWERS')) return 'rain';
  if (t === 'WINDY') return 'wind';
  if (t === 'CLEAR' || t === 'MOSTLY_CLEAR') return 'clear';
  if (t === 'PARTLY_CLOUDY') return 'partly';
  if (t.includes('FOG') || t.includes('HAZE') || t.includes('MIST')) {
    return 'fog';
  }
  return 'cloudy';
}

/** A short, plain name for a condition, in the current language. */
export function conditionName(condition: Condition): string {
  return t(`weather.${condition}`);
}
