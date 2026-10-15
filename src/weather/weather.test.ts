/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import {fromGoogle, fromWmo} from './conditions';
import {roundCoordinate, temperatureUnit} from './config';
import {REFRESH_MS, isCurrent} from './forecast';
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
