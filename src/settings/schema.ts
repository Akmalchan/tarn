/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {DEFAULT_SCENE_ID, SCENES} from '../backdrop/scenes';
import {isPhotoId} from '../wallpapers/store';
import {WIDGET_SIZES, type WidgetSize} from '../layout/bands';
import {LANGUAGE_SETTINGS, type LanguageSetting} from '../i18n/languages';

export {LANGUAGE_SETTINGS, type LanguageSetting} from '../i18n/languages';
import {migrateSettings} from './migrate';

/**
 * The icon in the tab. 'chrome' shows Chrome's own new-tab icon; 'none'
 * shows nothing, which never changes even mid-reload (see first-paint.ts).
 */
export type TabIcon = 'chrome' | 'none';
export const TAB_ICONS: readonly TabIcon[] = ['chrome', 'none'];

/**
 * The clock above the widgets, picked by face. 'center' is the classic thin
 * clock with the date (its id predates the other faces, so stored settings
 * keep working); 'none' hides it.
 */
export type ClockStyle =
  | 'center'
  | 'bold'
  | 'minimal'
  | 'serif'
  | 'stacked'
  | 'outline'
  | 'pixel'
  | 'none';
export const CLOCK_STYLES: readonly ClockStyle[] = [
  'center',
  'bold',
  'minimal',
  'serif',
  'stacked',
  'outline',
  'pixel',
  'none',
];

export type WidgetKind =
  'favorites' | 'notes' | 'tasks' | 'focus' | 'weather' | 'calendar';
export const WIDGET_KINDS: readonly WidgetKind[] = [
  'favorites',
  'notes',
  'tasks',
  'focus',
  'weather',
  'calendar',
];

/** The sizes each widget offers: only those its content looks right at. */
export const WIDGET_SIZE_OPTIONS: Readonly<
  Record<WidgetKind, readonly WidgetSize[]>
> = {
  favorites: ['s', 'm', 'l', 'xl'],
  notes: ['m', 'l', 'xl'],
  tasks: ['m', 'l', 'xl'],
  focus: ['s', 'm'],
  weather: ['s', 'm', 'l'],
  calendar: ['s', 'm', 'l'],
};

/** Size when first added. */
export const DEFAULT_WIDGET_SIZE: Readonly<Record<WidgetKind, WidgetSize>> = {
  favorites: 'l',
  notes: 'm',
  tasks: 'm',
  focus: 's',
  weather: 'm',
  calendar: 'l',
};

/** `size` if the widget offers it, otherwise the nearest size it does. */
export function fitWidgetSize(kind: WidgetKind, size: WidgetSize): WidgetSize {
  const options = WIDGET_SIZE_OPTIONS[kind];
  if (options.includes(size)) return size;
  const rank = WIDGET_SIZES.indexOf(size);
  return options.reduce((best, option) =>
    Math.abs(WIDGET_SIZES.indexOf(option) - rank) <
    Math.abs(WIDGET_SIZES.indexOf(best) - rank)
      ? option
      : best,
  );
}

/** The fields of a widget entry this version knows; others are kept as-is. */
export const WIDGET_ENTRY_FIELDS: readonly string[] = [
  'id',
  'kind',
  'size',
  'name',
];

/** A widget id as stored: lowercase letters, digits and dashes. */
export const WIDGET_ID = /^[a-z0-9-]{1,40}$/;

/** One widget on the page. Its content lives in local storage by `id`. */
export interface WidgetEntry {
  readonly id: string;
  readonly kind: WidgetKind;
  readonly size: WidgetSize;
  /** The user's name for it ("Project A"); the kind's name when unset. */
  readonly name?: string;
}

/** More than a page needs; keeps a corrupted list from growing forever. */
export const MAX_WIDGETS = 24;

/**
 * Where forecasts come from. 'google' needs the user's own API key, kept on
 * this computer only (weather/config.ts), never synced.
 */
export type WeatherProvider = 'open-meteo' | 'google';
export const WEATHER_PROVIDERS: readonly WeatherProvider[] = [
  'open-meteo',
  'google',
];

/** 'auto' follows the language: °F where that's usual, °C elsewhere. */
export type WeatherUnits = 'auto' | 'celsius' | 'fahrenheit';
export const WEATHER_UNITS: readonly WeatherUnits[] = [
  'auto',
  'celsius',
  'fahrenheit',
];

export interface WeatherSettings {
  readonly provider: WeatherProvider;
  readonly units: WeatherUnits;
}

/** Everything the user can change. Small and serializable; synced across devices. */
export interface Settings {
  /** Whether new tabs show Tarn, or hand off to the browser's own page. */
  readonly enabled: boolean;
  readonly scene: string;
  readonly tabIcon: TabIcon;
  readonly clock: ClockStyle;
  /** In the user's order. Empty by default: a calm page is the default. */
  readonly widgets: readonly WidgetEntry[];
  readonly weather: WeatherSettings;
  /** 'auto' follows the browser's languages. */
  readonly language: LanguageSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  scene: DEFAULT_SCENE_ID,
  tabIcon: 'chrome',
  clock: 'center',
  widgets: [],
  weather: {provider: 'open-meteo', units: 'auto'},
  language: 'auto',
};

/**
 * Turns whatever is in storage (missing, old, hand-edited) into valid
 * settings. Unknown values fall back to defaults instead of throwing.
 */
export function normalizeSettings(raw: unknown): Settings {
  const value = migrateSettings(raw);
  // A user's photo (`photo:<id>`) is kept even if this device doesn't have
  // it; the background falls back to the default scene at render time.
  const scene =
    typeof value.scene === 'string' &&
    (SCENES.some(s => s.id === value.scene) || isPhotoId(value.scene))
      ? value.scene
      : DEFAULT_SETTINGS.scene;
  const enabled =
    typeof value.enabled === 'boolean'
      ? value.enabled
      : DEFAULT_SETTINGS.enabled;
  const tabIcon = TAB_ICONS.includes(value.tabIcon as TabIcon)
    ? (value.tabIcon as TabIcon)
    : DEFAULT_SETTINGS.tabIcon;
  const clock = CLOCK_STYLES.includes(value.clock as ClockStyle)
    ? (value.clock as ClockStyle)
    : DEFAULT_SETTINGS.clock;
  return {
    enabled,
    scene,
    tabIcon,
    clock,
    widgets: normalizeWidgets(value.widgets),
    weather: normalizeWeather(value.weather),
    language: LANGUAGE_SETTINGS.includes(value.language as LanguageSetting)
      ? (value.language as LanguageSetting)
      : DEFAULT_SETTINGS.language,
  };
}

function normalizeWeather(raw: unknown): WeatherSettings {
  const value = isRecord(raw) ? raw : {};
  const fallback = DEFAULT_SETTINGS.weather;
  return {
    provider: WEATHER_PROVIDERS.includes(value.provider as WeatherProvider)
      ? (value.provider as WeatherProvider)
      : fallback.provider,
    units: WEATHER_UNITS.includes(value.units as WeatherUnits)
      ? (value.units as WeatherUnits)
      : fallback.units,
  };
}

/** Keeps valid entries in order; drops broken ones and duplicate ids. */
function normalizeWidgets(raw: unknown): WidgetEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const widgets: WidgetEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const {id, kind, size, name} = item;
    if (
      typeof id !== 'string' ||
      !WIDGET_ID.test(id) ||
      seen.has(id) ||
      !WIDGET_KINDS.includes(kind as WidgetKind)
    ) {
      continue;
    }
    seen.add(id);
    const label = typeof name === 'string' ? name.trim().slice(0, 40) : '';
    widgets.push({
      id,
      kind: kind as WidgetKind,
      size: fitWidgetSize(
        kind as WidgetKind,
        WIDGET_SIZES.includes(size as WidgetSize)
          ? (size as WidgetSize)
          : DEFAULT_WIDGET_SIZE[kind as WidgetKind],
      ),
      ...(label ? {name: label} : {}),
    });
    if (widgets.length === MAX_WIDGETS) break;
  }
  return widgets;
}

/** A new widget's id: its kind plus a short random suffix. */
export function newWidgetId(kind: WidgetKind): string {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
