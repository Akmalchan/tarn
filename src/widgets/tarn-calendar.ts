/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, nothing, svg} from 'lit';
import {
  firstWeekday,
  monthWeeks,
  NEW_DAY,
  sameDay,
  startOfDay,
  untilMidnight,
  weekOf,
} from '../calendar/dates';
import {LocaleController, locale, t} from '../i18n';
import {widgetStyles} from './styles';

/** A day can be missed while the computer sleeps: checked at least this often. */
const HOUR_MS = 3_600_000;

const CHEVRON_LEFT = svg`<path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
const CHEVRON_RIGHT = svg`<path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * The calendar: today (small), this week (medium) or the month (large),
 * in the language's own words and week start. Offline: dates only for now.
 * Wakes only at midnight.
 */
export class TarnCalendar extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    heading: {attribute: false},
    today: {state: true},
    shown: {state: true},
    tall: {state: true},
  };

  static override styles = [
    widgetStyles,
    css`
      :host {
        gap: 6px;
      }

      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 20px;
      }

      /* The same heading as every widget: the month (or the two months a
         week spans), after the widget's own name if it has one. */
      h3 {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .nav {
        display: none;
        gap: 2px;
      }

      .nav button {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        padding: 0;
        color: var(--ink-dim);
        background: transparent;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
      }

      .nav button:hover {
        color: var(--ink);
        background: var(--chip-hover);
      }

      .nav .today {
        width: auto;
        padding: 0 9px;
        font-size: 11.5px;
        font-weight: 600;
        border-radius: 999px;
      }

      .nav svg {
        width: 16px;
        height: 16px;
      }

      /* Weekday letters sit right above the dates; the week (medium) is
         centered in the tile, the month's weeks (large) spread to fill it. */
      .grid {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        gap: 6px;
      }

      .weekdays,
      .days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        text-align: center;
        font-size: 12.5px;
        font-variant-numeric: tabular-nums;
      }

      .days {
        row-gap: 2px;
      }

      .weekday {
        font-size: 10.5px;
        font-weight: 600;
        color: var(--ink-faint);
        text-transform: uppercase;
      }

      .day {
        position: relative;
        display: grid;
        place-items: center;
        justify-self: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
      }

      .day.other {
        color: var(--ink-faint);
      }

      .day.today {
        font-weight: 600;
        color: var(--tile-held, #141922);
        background: var(--ink);
        text-shadow: none;
      }

      /* Small: today, big. */
      .single {
        display: none;
        flex: 1;
        flex-direction: column;
        justify-content: center;
      }

      /* Like a heading, so it lines up with the other widgets' names. */
      .single .weekday-name {
        overflow: hidden;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--ink-dim);
      }

      .single .date {
        /* Pulls the digits' built-in left space back to the text edge. */
        margin-left: -0.05em;
        font-size: 52px;
        font-weight: 250;
        line-height: 1.05;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }

      .single .next {
        overflow: hidden;
        font-size: 12px;
        color: var(--ink-dim);
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      @container (max-width: 200px) {
        .head,
        .grid {
          display: none;
        }
        .single {
          display: flex;
        }
      }

      /* Large: the month, and arrows to look at others. */
      @container (min-height: 250px) {
        :host {
          gap: 8px;
        }
        .nav {
          display: flex;
        }
        .grid {
          gap: 4px;
        }
        .days {
          flex: 1;
          align-content: space-evenly;
        }
        .weekdays,
        .days {
          font-size: 13px;
        }
        .day {
          width: 30px;
          height: 30px;
        }
      }
    `,
  ];

  declare widgetId: string;
  /** The widget's name: the user's, or the default. */
  declare heading: string;
  /** Local midnight today; changes at midnight. */
  declare today: Date;
  /** The month the large calendar shows (its 1st). */
  declare shown: Date;
  /** A large tile (two rows): it shows the month instead of the week. */
  declare tall: boolean;
  private timer = 0;
  private sizes = new ResizeObserver(([entry]) => {
    this.tall = (entry?.contentRect.height ?? 0) >= 200;
  });

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgetId = '';
    this.heading = t('widget.calendar');
    this.today = startOfDay(new Date());
    this.shown = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    this.tall = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.onVisibility);
    // After the computer sleeps, the midnight timer runs late: the clock's
    // minute tick, coming back to the window, or the hourly check catch up.
    window.addEventListener(NEW_DAY, this.tick);
    window.addEventListener('focus', this.tick);
    this.sizes.observe(this);
    this.tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener(NEW_DAY, this.tick);
    window.removeEventListener('focus', this.tick);
    this.sizes.disconnect();
    clearTimeout(this.timer);
  }

  override render() {
    const first = firstWeekday(locale());
    const tall = this.shown;
    const weeks = this.tall
      ? monthWeeks(tall.getFullYear(), tall.getMonth(), first)
      : [weekOf(this.today, first)];
    const narrow = new Intl.DateTimeFormat(locale(), {weekday: 'narrow'});
    const monthName = this.tall
      ? monthLabel(tall, this.today)
      : weekLabel(weeks[0]!, this.today);
    const named = this.heading !== t('widget.calendar');
    return html`
      <div class="head">
        <h3>${named ? `${this.heading} · ${monthName}` : monthName}</h3>
        <div class="nav">
          ${
            this.isThisMonth()
              ? nothing
              : html`<button
                  class="today"
                  title=${t('calendar.today')}
                  @click=${this.showToday}
                >
                  ${t('calendar.today')}
                </button>`
          }
          <button
            aria-label=${t('calendar.previous')}
            title=${t('calendar.previous')}
            @click=${() => this.step(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">${CHEVRON_LEFT}</svg>
          </button>
          <button
            aria-label=${t('calendar.next')}
            title=${t('calendar.next')}
            @click=${() => this.step(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">${CHEVRON_RIGHT}</svg>
          </button>
        </div>
      </div>
      <div class="grid" role="grid" aria-label=${monthName}>
        <div class="weekdays" aria-hidden="true">
          ${weeks[0]!.map(
            day => html`<span class="weekday">${narrow.format(day)}</span>`,
          )}
        </div>
        <div class="days">
          ${weeks.flat().map(day => {
            const today = sameDay(day, this.today);
            const other = this.tall && day.getMonth() !== tall.getMonth();
            const classes = [
              'day',
              today ? 'today' : '',
              other ? 'other' : '',
            ].join(' ');
            return html`<span
              class=${classes}
              role="gridcell"
              aria-current=${today ? 'date' : nothing}
              >${day.getDate()}</span
            >`;
          })}
        </div>
      </div>
      ${this.renderSingle()}
    `;
  }

  /** The small tile: weekday, date and month. */
  private renderSingle() {
    const weekday = new Intl.DateTimeFormat(locale(), {weekday: 'long'});
    const month = new Intl.DateTimeFormat(locale(), {month: 'long'});
    return html`
      <div class="single">
        <span class="weekday-name">${weekday.format(this.today)}</span>
        <span class="date">${this.today.getDate()}</span>
        <span class="next">${capitalize(month.format(this.today))}</span>
      </div>
    `;
  }

  private isThisMonth(): boolean {
    return (
      this.shown.getFullYear() === this.today.getFullYear() &&
      this.shown.getMonth() === this.today.getMonth()
    );
  }

  private showToday = () => {
    this.shown = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
  };

  /** Another month; stepping back to this one shows today again. */
  private step(months: number): void {
    this.shown = new Date(
      this.shown.getFullYear(),
      this.shown.getMonth() + months,
      1,
    );
  }

  /** At midnight "today" moves on; in between, a check once an hour. */
  private tick = () => {
    clearTimeout(this.timer);
    const now = new Date();
    const today = startOfDay(now);
    if (!sameDay(today, this.today)) {
      // A new day: follow it, unless another month is being looked at.
      if (this.isThisMonth()) {
        this.shown = new Date(today.getFullYear(), today.getMonth(), 1);
      }
      this.today = today;
    }
    if (document.visibilityState !== 'visible') return;
    this.timer = window.setTimeout(
      this.tick,
      Math.min(untilMidnight(now) + 1000, HOUR_MS),
    );
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.tick();
    else clearTimeout(this.timer);
  };
}

/** "October", or "October 2027" for another year. */
function monthLabel(month: Date, today: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    month: 'long',
    year: month.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(month);
}

/** The week's month, or both months when it spans two ("Sep – Oct"). */
function weekLabel(week: readonly Date[], today: Date): string {
  const first = week[0]!;
  const last = week[week.length - 1]!;
  if (first.getMonth() === last.getMonth()) return monthLabel(first, today);
  const short = new Intl.DateTimeFormat(locale(), {month: 'short'});
  return `${short.format(first)} – ${short.format(last)}`;
}

/** A month name as a label: "октябрь" becomes "Октябрь". */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(locale()) + text.slice(1);
}

customElements.define('tarn-calendar', TarnCalendar);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-calendar': TarnCalendar;
  }
}
