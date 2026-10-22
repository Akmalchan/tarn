/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, describe, expect, it, vi} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {fromGoogle, fromWmo} from './conditions';
import {roundCoordinate, setGoogleKey, temperatureUnit} from './config';
import {
  KEY_RETRY_MS,
  REFRESH_MS,
  claimFetch,
  daysFrom,
  fetchForecast,
  isCurrent,
  isWaiting,
  localDate,
  releaseFetch,
  settingsChanged,
  usableSettings,
} from './forecast';
import {parseGoogle} from './google';
import {parseOpenMeteo} from './open-meteo';

const NOW = Date.UTC(2026, 9, 13, 15, 20);
const HOUR = 3_600_000;

describe('conditions', () => {
  it.each([
    [0, 'clear'],
    [2, 'partly'],
    [3, 'cloudy'],
    [45, 'fog'],
    [53, 'drizzle'],
    [63, 'rain'],
    [81, 'rain'],
    [67, 'sleet'],
    [75, 'snow'],
    [95, 'storm'],
  ])('maps WMO %i to %s', (code, condition) => {
    expect(fromWmo(code)).toBe(condition);
  });

  it.each([
    ['MOSTLY_CLEAR', 'clear'],
    ['PARTLY_CLOUDY', 'partly'],
    ['MOSTLY_CLOUDY', 'cloudy'],
    ['LIGHT_RAIN', 'drizzle'],
    ['SCATTERED_SHOWERS', 'rain'],
    ['HEAVY_SNOW_STORM', 'snow'],
    ['RAIN_AND_SNOW', 'sleet'],
    ['HAIL_SHOWERS', 'sleet'],
    ['SCATTERED_THUNDERSTORMS', 'storm'],
    ['WINDY', 'wind'],
    ['SOMETHING_NEW', 'cloudy'],
  ])('maps Google %s to %s', (type, condition) => {
    expect(fromGoogle(type)).toBe(condition);
  });
});

describe('units and places', () => {
  it('follows the language for auto', () => {
    expect(temperatureUnit('auto', 'en-US')).toBe('fahrenheit');
    expect(temperatureUnit('auto', 'en-GB')).toBe('celsius');
    expect(temperatureUnit('auto', 'de')).toBe('celsius');
    expect(temperatureUnit('celsius', 'en-US')).toBe('celsius');
  });

  it('rounds coordinates to about a kilometer', () => {
    expect(roundCoordinate(41.311081)).toBe(41.31);
    expect(roundCoordinate(-69.279737)).toBe(-69.28);
  });
});

describe('Open-Meteo', () => {
  const seconds = (ms: number) => Math.floor(ms / 1000);
  const response = {
    timezone: 'Asia/Tashkent',
    utc_offset_seconds: 18_000,
    current: {temperature_2m: 18.4, weather_code: 2, is_day: 1},
    hourly: {
      time: Array.from({length: 30}, (_, i) =>
        seconds(NOW - 2 * HOUR + i * HOUR),
      ),
      temperature_2m: Array.from({length: 30}, (_, i) => 10 + i),
      weather_code: Array.from({length: 30}, () => 61),
      is_day: Array.from({length: 30}, () => 1),
    },
    daily: {
      time: [seconds(Date.UTC(2026, 9, 12, 19))],
      weather_code: [3],
      temperature_2m_max: [21],
      temperature_2m_min: [9],
    },
  };

  it('keeps the next 24 hours and the local dates', () => {
    const forecast = parseOpenMeteo(response, 41.31, 69.28, 'celsius', NOW);
    expect(forecast.now).toEqual({temp: 18.4, condition: 'partly', day: true});
    expect(forecast.hours).toHaveLength(24);
    expect(forecast.hours[0]!.time).toBeGreaterThan(NOW - HOUR);
    expect(forecast.days[0]).toEqual({
      date: '2026-10-13',
      min: 9,
      max: 21,
      condition: 'cloudy',
    });
    expect(forecast.timeZone).toBe('Asia/Tashkent');
  });

  it('dates every day right in a week the clocks change', () => {
    // Local midnights in Berlin, fetched in winter time (UTC+1); summer
    // time (UTC+2) starts on Sunday 28 March 2027.
    const days = [25, 26, 27, 28, 29, 30, 31];
    const midnight = (day: number) =>
      Date.UTC(2027, 2, day) / 1000 - (day > 28 ? 7200 : 3600);
    const forecast = parseOpenMeteo(
      {
        ...response,
        timezone: 'Europe/Berlin',
        utc_offset_seconds: 3600,
        daily: {
          time: days.map(midnight),
          weather_code: days.map(() => 0),
          temperature_2m_max: days.map(() => 12),
          temperature_2m_min: days.map(() => 2),
        },
      },
      52.52,
      13.4,
      'celsius',
      Date.UTC(2027, 2, 25, 9),
    );
    expect(forecast.days.map(d => d.date)).toEqual(
      days.map(day => `2027-03-${day}`),
    );
  });

  it('dates every day right when the clocks go back', () => {
    // Sydney, fetched in summer time (UTC+11); winter time from 5 April.
    const days = [2, 3, 4, 5, 6, 7, 8];
    const midnight = (day: number) =>
      Date.UTC(2026, 3, day) / 1000 - (day > 5 ? 36_000 : 39_600);
    const forecast = parseOpenMeteo(
      {
        ...response,
        timezone: 'Australia/Sydney',
        utc_offset_seconds: 39_600,
        daily: {
          time: days.map(midnight),
          weather_code: days.map(() => 0),
          temperature_2m_max: days.map(() => 22),
          temperature_2m_min: days.map(() => 12),
        },
      },
      -33.87,
      151.21,
      'celsius',
      Date.UTC(2026, 3, 1, 22),
    );
    expect(forecast.days.map(d => d.date)).toEqual(
      days.map(day => `2026-04-0${day}`),
    );
  });

  it('refuses an incomplete answer', () => {
    expect(() =>
      parseOpenMeteo({current: response.current}, 0, 0, 'celsius', NOW),
    ).toThrow();
  });
});

describe('Google', () => {
  it('reads current, hourly and daily answers', () => {
    const forecast = parseGoogle(
      {
        temperature: {degrees: 64},
        weatherCondition: {type: 'MOSTLY_CLEAR'},
        isDaytime: false,
        timeZone: {id: 'America/Los_Angeles'},
      },
      {
        forecastHours: [
          {
            interval: {startTime: '2026-10-13T16:00:00Z'},
            temperature: {degrees: 63},
            weatherCondition: {type: 'CLOUDY'},
            isDaytime: true,
          },
        ],
      },
      {
        forecastDays: [
          {
            displayDate: {year: 2026, month: 10, day: 13},
            maxTemperature: {degrees: 70},
            minTemperature: {degrees: 55},
            daytimeForecast: {weatherCondition: {type: 'RAIN'}},
          },
        ],
      },
      37.77,
      -122.42,
      'fahrenheit',
      NOW,
    );
    expect(forecast.now).toEqual({temp: 64, condition: 'clear', day: false});
    expect(forecast.hours[0]).toMatchObject({temp: 63, condition: 'cloudy'});
    expect(forecast.days[0]).toEqual({
      date: '2026-10-13',
      min: 55,
      max: 70,
      condition: 'rain',
    });
    expect(forecast.timeZone).toBe('America/Los_Angeles');
  });
});

describe('isCurrent', () => {
  const place = {name: 'Tashkent', lat: 41.31, lon: 69.28};
  const settings = {
    provider: 'open-meteo',
    units: 'celsius',
  } as const;
  const forecast = parseOpenMeteo(
    {
      current: {temperature_2m: 1, weather_code: 0, is_day: 1},
      hourly: {time: [], temperature_2m: [], weather_code: [], is_day: []},
      daily: {
        time: [],
        weather_code: [],
        temperature_2m_max: [],
        temperature_2m_min: [],
      },
    },
    41.31,
    69.28,
    'celsius',
    NOW,
  );

  it('holds for 30 minutes for the same place and settings', () => {
    expect(isCurrent(forecast, place, settings, NOW + REFRESH_MS - 1)).toBe(
      true,
    );
    expect(isCurrent(forecast, place, settings, NOW + REFRESH_MS)).toBe(false);
  });

  it('lapses when it was stamped in the future (the clock was put back)', () => {
    expect(isCurrent(forecast, place, settings, NOW - 30_000)).toBe(true);
    expect(isCurrent(forecast, place, settings, NOW - 2 * HOUR)).toBe(false);
  });

  it('lapses when the place, provider or units change', () => {
    expect(isCurrent(forecast, {...place, lat: 40}, settings, NOW)).toBe(false);
    expect(
      isCurrent(forecast, place, {...settings, provider: 'google'}, NOW),
    ).toBe(false);
    expect(
      isCurrent(forecast, place, {...settings, units: 'fahrenheit'}, NOW),
    ).toBe(false);
  });
});

describe('settingsChanged', () => {
  const settings = {provider: 'open-meteo', units: 'celsius'} as const;

  it('keeps the wait on the first load and on an echo', () => {
    expect(settingsChanged(null, settings)).toBe(false);
    expect(settingsChanged(settings, {...settings})).toBe(false);
  });

  it('retries when the provider or units change', () => {
    expect(settingsChanged(settings, {...settings, provider: 'google'})).toBe(
      true,
    );
    expect(settingsChanged(settings, {...settings, units: 'fahrenheit'})).toBe(
      true,
    );
  });
});

describe('isWaiting', () => {
  it('waits until retryAt, but not for longer than Tarn ever waits', () => {
    expect(isWaiting(undefined, NOW)).toBe(false);
    expect(isWaiting(NOW + 60_000, NOW)).toBe(true);
    expect(isWaiting(NOW - 1, NOW)).toBe(false);
    expect(isWaiting(NOW + KEY_RETRY_MS, NOW)).toBe(true);
    // The clock was put back a day.
    expect(isWaiting(NOW + 24 * HOUR, NOW)).toBe(false);
  });
});

describe('daysFrom', () => {
  const forecast = parseOpenMeteo(
    {
      timezone: 'Asia/Tashkent',
      utc_offset_seconds: 18_000,
      current: {temperature_2m: 1, weather_code: 0, is_day: 1},
      hourly: {time: [], temperature_2m: [], weather_code: [], is_day: []},
      daily: {
        // Local midnights of 13, 14 and 15 October (UTC+5).
        time: [13, 14, 15].map(day => Date.UTC(2026, 9, day) / 1000 - 18_000),
        weather_code: [0, 0, 0],
        temperature_2m_max: [20, 21, 22],
        temperature_2m_min: [10, 11, 12],
      },
    },
    41.31,
    69.28,
    'celsius',
    NOW,
  );

  it('starts at today in the place, not at the day it was fetched', () => {
    expect(daysFrom(forecast, NOW).map(d => d.date)).toEqual([
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
    // The next morning in Tashkent (02:00 local is still 14 October there,
    // 21:00 on the 13th in UTC).
    const next = Date.UTC(2026, 9, 13, 21);
    expect(localDate(next, 'Asia/Tashkent')).toBe('2026-10-14');
    expect(daysFrom(forecast, next).map(d => d.date)).toEqual([
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('keeps every day for a time zone it cannot read', () => {
    expect(localDate(NOW, 'Not/AZone')).toBeNull();
    expect(daysFrom({...forecast, timeZone: 'Not/AZone'}, NOW)).toHaveLength(3);
  });
});

describe('claimFetch', () => {
  const memory = () => {
    const items = new Map<string, string>();
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    } as Storage;
  };

  it('lets one window fetch a place while the other waits', () => {
    const storage = memory();
    expect(claimFetch('p', NOW, storage, 'a')).toBe(0);
    // The same page (another widget there) shares the request.
    expect(claimFetch('p', NOW, storage, 'a')).toBe(0);
    const wait = claimFetch('p', NOW + 1000, storage, 'b');
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(20_000);
    // Done: the other window may go.
    releaseFetch('p', storage, 'b');
    expect(claimFetch('p', NOW + 1000, storage, 'b')).toBeGreaterThan(0);
    releaseFetch('p', storage, 'a');
    expect(claimFetch('p', NOW + 1000, storage, 'b')).toBe(0);
  });

  it('lets a claim run out, and ignores one from a clock put back', () => {
    const storage = memory();
    claimFetch('p', NOW, storage, 'a');
    expect(claimFetch('p', NOW + 20_001, storage, 'b')).toBe(0);
    storage.setItem('tarn.weather.fetching.p', `a ${NOW + 10 * HOUR}`);
    expect(claimFetch('p', NOW, storage, 'b')).toBe(0);
    storage.setItem('tarn.weather.fetching.p', 'junk');
    expect(claimFetch('p', NOW, storage, 'b')).toBe(0);
  });
});

describe('usableSettings', () => {
  const google = {provider: 'google', units: 'auto'} as const;

  it('uses Open-Meteo where this computer has no Google key', () => {
    expect(usableSettings(google, false)).toEqual({
      provider: 'open-meteo',
      units: 'auto',
    });
    expect(usableSettings(google, true)).toBe(google);
  });
});

describe('requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fakeBrowser.reset();
  });

  /** Answers every request with `body`, and returns the requests made. */
  function answer(body: unknown): {url: string; init?: RequestInit}[] {
    const calls: {url: string; init?: RequestInit}[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({url, init});
      return new Response(JSON.stringify(body));
    });
    return calls;
  }

  it('send a place rounded to about a kilometer, even one stored unrounded', async () => {
    const calls = answer({});
    const place = {name: 'Berlin', lat: 52.520008, lon: 13.404954};
    await fetchForecast(place, {
      provider: 'open-meteo',
      units: 'celsius',
    }).catch(() => {});
    expect(calls[0]!.url).toContain('latitude=52.52&');
    expect(calls[0]!.url).toContain('longitude=13.4&');
  });

  it('send the Google key in a header, never in the address', async () => {
    const calls = answer({temperature: {degrees: 20}, timeZone: {id: 'UTC'}});
    await setGoogleKey('test-key');
    await fetchForecast(
      {name: 'Berlin', lat: 52.52, lon: 13.4},
      {provider: 'google', units: 'celsius'},
    );
    expect(calls).toHaveLength(3);
    for (const {url, init} of calls) {
      expect(url).not.toContain('test-key');
      expect(new Headers(init?.headers).get('X-Goog-Api-Key')).toBe('test-key');
      expect(init?.credentials).toBe('omit');
    }
  });
});
