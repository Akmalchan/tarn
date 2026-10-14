/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing, type PropertyValues} from 'lit';
import {browser} from 'wxt/browser';
import {DEFAULT_SETTINGS, type WeatherSettings} from '../settings/schema';
import {loadSettings, watchSettings} from '../settings/store';
import {conditionName} from '../weather/conditions';
import {roundCoordinate, watchGoogleKey} from '../weather/config';
import {REFRESH_MS, fetchForecast, isCurrent} from '../weather/forecast';
import {weatherGlyph} from '../weather/glyphs';
import {searchPlaces} from '../weather/open-meteo';
import {WeatherError, type Forecast, type Place} from '../weather/types';
import {
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {sheetStyles, widgetStyles} from './styles';
import {LocaleController, locale, t} from '../i18n';

interface WeatherData {
  readonly place: Place | null;
  readonly forecast: Forecast | null;
  /** After a failed update, when the next try may happen (epoch ms). */
  readonly retryAt?: number;
}

const EMPTY: WeatherData = {place: null, forecast: null};
/** After a failed request, try again this much later. */
const RETRY_MS = 5 * 60_000;
/** After a rejected key or a used-up quota: until the key changes, or this. */
const KEY_RETRY_MS = 6 * 60 * 60_000;

/** Whether `zone` is a time zone this browser can format in. */
function isTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string') return false;
  try {
    new Intl.DateTimeFormat(undefined, {timeZone: zone});
    return true;
  } catch {
    return false;
  }
}

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

function normalize(raw: unknown): WeatherData {
  if (typeof raw !== 'object' || raw === null) return EMPTY;
  const {place, forecast} = raw as Record<string, unknown>;
  const p = place as Partial<Place> | null;
  const validPlace =
    p && typeof p.name === 'string' && isNumber(p.lat) && isNumber(p.lon)
      ? {
          name: p.name.slice(0, 80),
          detail: typeof p.detail === 'string' ? p.detail.slice(0, 120) : '',
          lat: p.lat,
          lon: p.lon,
          ...(p.here === true ? {here: true} : {}),
        }
      : null;
  const f = forecast as Partial<Forecast> | null;
  const validForecast =
    validPlace &&
    f &&
    isNumber(f.fetched) &&
    isNumber(f.now?.temp) &&
    isTimeZone(f.timeZone) &&
    Array.isArray(f.hours) &&
    Array.isArray(f.days)
      ? {
          ...(f as Forecast),
          hours: f.hours.filter(h => isNumber(h?.time) && isNumber(h?.temp)),
          days: f.days.filter(
            d =>
              typeof d?.date === 'string' && isNumber(d.min) && isNumber(d.max),
          ),
        }
      : null;
  const {retryAt} = raw as {retryAt?: unknown};
  return {
    place: validPlace,
    forecast: validForecast,
    ...(isNumber(retryAt) ? {retryAt} : {}),
  };
}

/**
 * The weather where you choose. Nothing goes over the network until a
 * place is picked; then at most one request per 30 minutes, only while a
 * tab is visible, and the last forecast shows at once on every new tab.
 */
export class TarnWeather extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    heading: {attribute: false},
    editing: {attribute: false},
    data: {state: true},
    settings: {state: true},
    problem: {state: true},
    picking: {state: true},
    results: {state: true},
    note: {state: true},
  };

  static override styles = [
    widgetStyles,
    sheetStyles,
    css`
      :host {
        position: relative;
      }

      .body {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .glyph {
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .glyph .dot {
        stroke-width: 2.4;
      }

      .now {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          'place icon'
          'temp icon'
          'cond cond';
        align-items: start;
        column-gap: 8px;
      }

      .place {
        grid-area: place;
        min-width: 0;
        padding: 0;
        overflow: hidden;
        font-size: 13px;
        font-weight: 600;
        text-align: start;
        white-space: nowrap;
        text-overflow: ellipsis;
        background: none;
        border: 0;
        cursor: pointer;
      }

      /* While arranging: an obvious way to pick another place. */
      .change {
        position: absolute;
        bottom: 12px;
        left: 50%;
        z-index: 1;
        padding: 7px 14px;
        font-size: 12.5px;
        font-weight: 600;
        white-space: nowrap;
        color: var(--tile-held, #141922);
        text-shadow: none;
        background: var(--ink);
        border: 0;
        border-radius: 999px;
        box-shadow: 0 4px 14px rgb(0 0 0 / 0.25);
        transform: translateX(-50%);
        cursor: pointer;
      }

      .change:hover {
        opacity: 0.9;
      }

      .place:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .temp {
        grid-area: temp;
        font-size: 44px;
        font-weight: 250;
        line-height: 1.05;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }

      .now .icon {
        grid-area: icon;
        width: 30px;
        height: 30px;
        margin-top: 2px;
      }

      .cond {
        grid-area: cond;
        overflow: hidden;
        font-size: 12px;
        color: var(--ink-dim);
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .hours,
      .days,
      .credit {
        display: none;
      }

      .hours {
        grid-template-columns: repeat(var(--count), minmax(0, 1fr));
        gap: 2px;
        text-align: center;
        font-size: 10.5px;
        font-variant-numeric: tabular-nums;
      }

      .hour {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .hour .when {
        color: var(--ink-dim);
        white-space: nowrap;
      }

      .hour .icon {
        width: 20px;
        height: 20px;
      }

      .days {
        flex-direction: column;
        gap: 2px;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }

      .day {
        display: grid;
        grid-template-columns: 3.2em 20px 2.8em 1fr 2.8em;
        align-items: center;
        gap: 8px;
        min-height: 24px;
      }

      .day .icon {
        width: 18px;
        height: 18px;
      }

      .day .min {
        text-align: end;
        color: var(--ink-dim);
      }

      .bar {
        position: relative;
        height: 4px;
        border-radius: 2px;
        background: var(--chip);
      }

      .bar i {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 2px;
        background: var(--ink-dim);
      }

      .credit {
        margin-top: auto;
        overflow: hidden;
        font-size: 10px;
        color: var(--ink-faint);
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .credit a {
        color: inherit;
      }

      /* No place yet: the widget's name, a calm weather glyph, and what
         to do; the whole tile picks a place. */
      .empty {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr auto;
        grid-template-areas:
          'heading'
          'icon'
          'cta';
        width: 100%;
        height: 100%;
        padding: 0;
        font: inherit;
        color: var(--ink);
        text-align: start;
        background: none;
        border: 0;
        cursor: pointer;
      }

      .empty .heading {
        grid-area: heading;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-dim);
      }

      .empty .icon {
        grid-area: icon;
        align-self: center;
        width: 40px;
        height: 40px;
        color: var(--ink-dim);
      }

      .empty .cta {
        grid-area: cta;
        display: inline-flex;
        align-items: baseline;
        gap: 5px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }

      .empty .cta span {
        color: var(--ink-dim);
        transition: transform 150ms ease;
      }

      .empty:hover .cta span {
        transform: translateX(2px);
      }

      .empty .note {
        display: none;
        grid-area: note;
        font-size: 13px;
        line-height: 1.35;
        color: var(--ink-dim);
      }

      .empty:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 4px;
        border-radius: 12px;
      }

      /* Medium: the sentence beside the glyph. */
      @container (min-width: 250px) {
        .empty {
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-areas:
            'heading heading'
            'icon note'
            'cta cta';
          column-gap: 16px;
        }
        .empty .note {
          display: block;
          align-self: center;
        }
      }

      /* Large: a bigger glyph, the sentence under it. */
      @container (min-width: 250px) and (min-height: 250px) {
        .empty {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: auto 1fr auto auto;
          grid-template-areas:
            'heading'
            'icon'
            'note'
            'cta';
          row-gap: 10px;
        }
        .empty .icon {
          width: 64px;
          height: 64px;
        }
        .empty .note {
          max-width: 24ch;
          font-size: 14px;
        }
      }

      .use-location {
        align-self: flex-start;
      }
    `,
  ];

  declare widgetId: string;
  /** The widget's name: the user's, or the default. */
  declare heading: string;
  /** Widgets are being arranged: the place can be changed from a button. */
  declare editing: boolean;
  declare data: WeatherData;
  /** Provider and units, from settings (null until loaded). */
  declare settings: WeatherSettings | null;
  /** Why the forecast can't be updated right now, if it can't. */
  declare problem: string;
  declare picking: boolean;
  declare results: Place[];
  /** A message inside the picker (searching, location refused). */
  declare note: string;

  private unwatch: () => void = () => {};
  private unwatchSettings: () => void = () => {};
  private unwatchKey: () => void = () => {};
  private timer = 0;
  private searchTimer = 0;
  private searchId = 0;
  private fetching = false;

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgetId = '';
    this.heading = t('widget.weather');
    this.editing = false;
    this.data = EMPTY;
    this.settings = null;
    this.problem = '';
    this.picking = false;
    this.results = [];
    this.note = '';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.data = peekWidgetData(this.widgetId, normalize);
    void loadWidgetData(this.widgetId, normalize).then(this.apply);
    this.unwatch = watchWidgetData(this.widgetId, normalize, this.apply);
    void loadSettings().then(s => this.useSettings(s.weather));
    this.unwatchSettings = watchSettings(s => this.useSettings(s.weather));
    // A new Google key: try again now rather than waiting out the error.
    this.unwatchKey = watchGoogleKey(() => this.retryNow());
    document.addEventListener('visibilitychange', this.refresh);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    this.unwatchSettings();
    this.unwatchKey();
    document.removeEventListener('visibilitychange', this.refresh);
    clearTimeout(this.timer);
    clearTimeout(this.searchTimer);
  }

  override updated(changed: PropertyValues<this>): void {
    if (!changed.has('picking')) return;
    const dialog = this.renderRoot.querySelector('dialog');
    if (this.picking && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('input')?.focus();
    }
  }

  override render() {
    const {place, forecast} = this.data;
    if (!place) {
      // Waiting for a place: the shape of a forecast, faint, with the one
      // thing to do. The whole tile picks a place.
      return html`
        <button class="empty" @click=${this.openPicker}>
          <span class="heading">${this.heading}</span>
          <span class="icon">${weatherGlyph('partly', true)}</span>
          <span class="cta"
            >${t('weather.choose')}<span aria-hidden="true">›</span></span
          >
          <span class="note">${t('weather.empty')}</span>
        </button>
        ${this.renderPicker()}
      `;
    }
    const shown =
      forecast && forecast.lat === place.lat && forecast.lon === place.lon
        ? forecast
        : null;
    return html`
      <div class="body">
        ${this.renderNow(place, shown)}
        ${shown ? this.renderHours(shown) : nothing}
        ${shown ? this.renderDays(shown) : nothing}
        <div class="credit">${this.credit()}</div>
      </div>
      ${
        this.editing
          ? html`<button class="change" data-edit @click=${this.openPicker}>
              ${t('weather.change')}
            </button>`
          : nothing
      }
      ${this.renderPicker()}
    `;
  }

  private renderNow(place: Place, forecast: Forecast | null) {
    const today = forecast?.days[0];
    const condition = forecast
      ? `${conditionName(forecast.now.condition)}${
          today
            ? ` · ${t('weather.highLow', {high: deg(today.max), low: deg(today.min)})}`
            : ''
        }`
      : '';
    const temp = forecast ? deg(forecast.now.temp) : '–°';
    return html`
      <div class="now" title=${this.creditText()}>
        <button
          class="place"
          data-edit
          title=${t('weather.change')}
          @click=${this.openPicker}
        >
          ${placeName(place)}
        </button>
        <div class="temp" style="--chars: ${temp.length}">${temp}</div>
        <div class="icon">
          ${forecast ? weatherGlyph(forecast.now.condition, forecast.now.day) : nothing}
        </div>
        <div class="cond">${this.problem || condition}</div>
      </div>
    `;
  }

  private renderHours(forecast: Forecast) {
    const hour = new Intl.DateTimeFormat(locale(), {
      hour: 'numeric',
      timeZone: forecast.timeZone,
    });
    const now = Date.now();
    const upcoming = forecast.hours.filter(h => h.time > now - 3_600_000);
    return html`
      <div class="hours">
        ${upcoming.slice(0, 6).map(
          (h, i) => html`
            <div class="hour">
              <span class="when"
                >${i === 0 ? t('weather.now') : shortHour(hour, h.time)}</span
              >
              <span class="icon">${weatherGlyph(h.condition, h.day)}</span>
              <span>${deg(h.temp)}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  private renderDays(forecast: Forecast) {
    const days = forecast.days;
    if (!days.length) return nothing;
    const low = Math.min(...days.map(d => d.min));
    const high = Math.max(...days.map(d => d.max));
    const span = Math.max(high - low, 1);
    const weekday = new Intl.DateTimeFormat(locale(), {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return html`
      <div class="days">
        ${days.slice(0, 7).map(
          (d, i) => html`
            <div class="day">
              <span
                >${i === 0 ? t('weather.today') : safeFormat(weekday, Date.parse(`${d.date}T12:00:00Z`))}</span
              >
              <span class="icon">${weatherGlyph(d.condition)}</span>
              <span class="min">${deg(d.min)}</span>
              <span class="bar"
                ><i
                  style="left:${((d.min - low) / span) * 100}%;right:${((high - d.max) / span) * 100}%"
                ></i
              ></span>
              <span>${deg(d.max)}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  private credit() {
    return this.provider() === 'google'
      ? 'Includes weather data from Google'
      : html`${t('weather.by')}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener"
            >Open-Meteo</a
          >`;
  }

  private creditText(): string {
    return this.provider() === 'google'
      ? 'Includes weather data from Google'
      : `${t('weather.by')} Open-Meteo.com`;
  }

  private provider() {
    return (this.settings ?? DEFAULT_SETTINGS.weather).provider;
  }

  private renderPicker() {
    if (!this.picking) return nothing;
    const google = this.provider() === 'google';
    return html`
      <dialog data-edit @close=${this.closePicker}>
        <form method="dialog" @submit=${this.onPickerSubmit}>
          <h4>${t('weather.choose')}</h4>
          <input
            type="search"
            aria-label=${t('weather.city')}
            placeholder=${t('weather.search')}
            autocomplete="off"
            spellcheck="false"
            @input=${this.onSearchInput}
          />
          ${
            this.results.length
              ? html`<div class="search-results" role="list">
                  ${this.results.map(
                    place => html`
                      <button
                        type="button"
                        class="result"
                        role="listitem"
                        @click=${() => this.pick(place)}
                      >
                        <span>${place.name}</span>
                        <small>${place.detail}</small>
                      </button>
                    `,
                  )}
                </div>`
              : nothing
          }
          ${this.note ? html`<p class="error">${this.note}</p>` : nothing}
          <button
            type="button"
            class="use-location"
            @click=${this.useMyLocation}
          >
            ${t('weather.useLocation')}
          </button>
          <p class="privacy">
            ${t('weather.privacy', {
              provider: google ? t('weather.providerGoogle') : 'Open-Meteo',
            })}
          </p>
          <div class="buttons">
            <button type="button" @click=${() => this.closePicker()}>
              ${t('common.cancel')}
            </button>
          </div>
        </form>
      </dialog>
    `;
  }

  // ---- Data ----------------------------------------------------------------

  private apply = (data: WeatherData) => {
    this.data = data;
    this.refresh();
  };

  private useSettings(settings: WeatherSettings): void {
    const changed =
      settings.provider !== this.settings?.provider ||
      settings.units !== this.settings?.units;
    this.settings = settings;
    if (changed) this.retryNow();
  }

  /** Something that could fix a failure changed: forget the wait, try now. */
  private retryNow(): void {
    this.problem = '';
    if (this.data.retryAt === undefined) {
      this.refresh();
      return;
    }
    const rest: WeatherData = {
      place: this.data.place,
      forecast: this.data.forecast,
    };
    this.data = rest;
    void saveWidgetData(this.widgetId, rest).then(() => this.refresh());
  }

  /**
   * Fetches when the forecast is missing or old, and otherwise sleeps until
   * it will be. Nothing runs while the tab is hidden or with no place.
   */
  private refresh = () => {
    clearTimeout(this.timer);
    const {place, forecast, retryAt} = this.data;
    const settings = this.settings;
    if (!this.isConnected || !place || !settings) return;
    if (document.visibilityState !== 'visible') return;
    if (isCurrent(forecast, place, settings)) {
      const due = forecast.fetched + REFRESH_MS - Date.now();
      this.timer = window.setTimeout(this.refresh, Math.max(due, 1000));
      return;
    }
    // A failed update waits its turn, across tab switches and new tabs.
    if (retryAt !== undefined && retryAt > Date.now()) {
      this.timer = window.setTimeout(this.refresh, retryAt - Date.now());
      return;
    }
    void this.fetchNow();
  };

  private async fetchNow(): Promise<void> {
    if (this.fetching || !this.isConnected) return;
    const settings = this.settings;
    if (!settings) return;
    this.fetching = true;
    let stored: WeatherData = this.data;
    try {
      // Another tab may have just fetched it.
      stored = await loadWidgetData(this.widgetId, normalize);
      const place = stored.place;
      if (!place) return;
      if (isCurrent(stored.forecast, place, settings)) {
        this.data = stored;
        return;
      }
      const forecast = await fetchForecast(place, settings);
      // The place may have changed while the request was out: keep the new
      // one, and fetch for it next.
      const latest = await loadWidgetData(this.widgetId, normalize);
      if (latest.place?.lat !== place.lat || latest.place.lon !== place.lon) {
        this.data = latest;
        return;
      }
      this.problem = '';
      const next = {place: latest.place, forecast};
      this.data = next;
      await saveWidgetData(this.widgetId, next);
    } catch (error) {
      this.problem = describe(error, this.data.forecast);
      const keyProblem =
        error instanceof WeatherError &&
        (error.reason === 'key' || error.reason === 'quota');
      const next = {
        ...stored,
        retryAt: Date.now() + (keyProblem ? KEY_RETRY_MS : RETRY_MS),
      };
      this.data = next;
      await saveWidgetData(this.widgetId, next);
    } finally {
      this.fetching = false;
      // Every way out schedules what comes next (a timer, or nothing).
      this.refresh();
    }
  }

  // ---- Picker --------------------------------------------------------------

  private openPicker = () => {
    this.results = [];
    this.note = '';
    this.picking = true;
  };

  private closePicker = () => {
    this.renderRoot.querySelector('dialog')?.close();
    this.picking = false;
  };

  /** Enter picks the best match for what's typed now, not a moment ago. */
  private onPickerSubmit = async (event: Event) => {
    event.preventDefault();
    clearTimeout(this.searchTimer);
    const input =
      this.renderRoot.querySelector<HTMLInputElement>('dialog input');
    await this.search(input?.value ?? '');
    const first = this.results[0];
    if (first) this.pick(first);
  };

  private onSearchInput = (event: Event) => {
    const query = (event.target as HTMLInputElement).value;
    clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => void this.search(query), 300);
  };

  private async search(query: string): Promise<void> {
    const id = ++this.searchId;
    if (query.trim().length < 2) {
      this.results = [];
      this.note = '';
      return;
    }
    try {
      const results = await searchPlaces(query, locale());
      if (id !== this.searchId) return;
      this.results = results;
      this.note = results.length ? '' : t('weather.noPlaces');
    } catch {
      if (id === this.searchId) this.note = t('weather.cantSearch');
    }
  }

  private useMyLocation = async () => {
    this.note = '';
    const granted = await browser.permissions
      .request({permissions: ['geolocation']})
      .catch(() => false);
    if (!granted) {
      this.note = t('weather.locationDenied');
      return;
    }
    this.note = t('weather.finding');
    navigator.geolocation.getCurrentPosition(
      position => {
        // Cancelled while waiting: leave the place as it was.
        if (!this.picking) return;
        this.pick({
          name: '',
          here: true,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        this.note = t('weather.locationFailed');
      },
      {maximumAge: REFRESH_MS, timeout: 15_000},
    );
  };

  private pick(place: Place): void {
    const rounded: Place = {
      ...place,
      lat: roundCoordinate(place.lat),
      lon: roundCoordinate(place.lon),
    };
    this.closePicker();
    this.problem = '';
    const next = {place: rounded, forecast: null};
    this.data = next;
    void saveWidgetData(this.widgetId, next).then(() => this.refresh());
  }
}

/** A place's name; "My location" in the current language. */
function placeName(place: Place): string {
  return place.here ? t('weather.myLocation') : place.name;
}

/** A temperature, rounded, with a degree sign. */
function deg(value: number): string {
  return `${Math.round(value)}°`;
}

/**
 * Just the hour, as tightly as the language allows: "10PM", "21" (not
 * "21 Uhr" or "21時"); hour labels sit close together.
 */
function shortHour(format: Intl.DateTimeFormat, time: number): string {
  try {
    return format
      .formatToParts(time)
      .filter(part => part.type === 'hour' || part.type === 'dayPeriod')
      .map(part => part.value.replace(/\./g, ''))
      .join('');
  } catch {
    return '';
  }
}

function safeFormat(format: Intl.DateTimeFormat, time: number): string {
  try {
    return format.format(time);
  } catch {
    return '';
  }
}

/** A short line for the widget when the forecast can't update. */
function describe(error: unknown, shown: Forecast | null): string {
  if (error instanceof WeatherError && error.reason === 'key') {
    return t('weather.checkKey');
  }
  if (!shown) return t('weather.unavailable');
  const minutes = Math.round((Date.now() - shown.fetched) / 60_000);
  if (minutes < 90) return '';
  const hours = Math.round(minutes / 60);
  return t('weather.offline', {hours});
}

customElements.define('tarn-weather', TarnWeather);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-weather': TarnWeather;
  }
}
