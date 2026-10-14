/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing, svg} from 'lit';
import {
  dayKey,
  firstWeekday,
  monthWeeks,
  sameDay,
  startOfDay,
  untilMidnight,
  weekOf,
} from '../calendar/dates';
import {eventsIn, hasSources} from '../calendar/sources';
import type {CalendarEvent} from '../calendar/types';
import {LocaleController, locale, t} from '../i18n';
import {widgetStyles} from './styles';

const CHEVRON_LEFT = svg`<path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
const CHEVRON_RIGHT = svg`<path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * The calendar: today (small), this week (medium) or the month (large),
 * in the language's own words and week start. Offline: dates only for now.
 * Events come from sources registered in calendar/sources.ts, so adding
 * one later (a calendar link) needs no change here. Wakes only at midnight.
 */
export class TarnCalendar extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    heading: {attribute: false},
    today: {state: true},
    shown: {state: true},
    events: {state: true},
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

      .month {
        margin: 0;
        overflow: hidden;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        text-overflow: ellipsis;
        text-transform: capitalize;
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

      .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        flex: 1;
        align-content: space-evenly;
        row-gap: 2px;
        text-align: center;
        font-size: 12.5px;
        font-variant-numeric: tabular-nums;
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

      .day.busy::after {
        content: '';
        position: absolute;
        bottom: 2px;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.7;
      }

      /* Small: today, big. */
      .single {
        display: none;
        flex: 1;
        flex-direction: column;
        justify-content: center;
      }

      .single .weekday-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-dim);
        text-transform: capitalize;
      }

      .single .date {
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
  declare events: readonly CalendarEvent[];
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
    this.events = [];
    this.tall = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.sizes.observe(this);
    this.tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.sizes.disconnect();
    clearTimeout(this.timer);
  }

  override render() {
    const first = firstWeekday(locale());
    const tall = this.shown;
    const weeks = this.tall
      ? monthWeeks(tall.getFullYear(), tall.getMonth(), first)
      : [weekOf(this.today, first)];
    const shownMonth = this.tall ? tall : this.today;
    const busy = new Set(this.events.flatMap(eventDays));
    const narrow = new Intl.DateTimeFormat(locale(), {weekday: 'narrow'});
    const monthName = new Intl.DateTimeFormat(locale(), {
      month: 'long',
      year:
        shownMonth.getFullYear() === this.today.getFullYear()
          ? undefined
          : 'numeric',
    }).format(shownMonth);
    return html`
      <div class="head">
        <h3 class="month">${monthName}</h3>
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
        ${weeks[0]!.map(
          day =>
            html`<span class="weekday" aria-hidden="true"
              >${narrow.format(day)}</span
            >`,
        )}
        ${weeks.flat().map(day => {
          const today = sameDay(day, this.today);
          const other = this.tall && day.getMonth() !== tall.getMonth();
          const classes = [
            'day',
            today ? 'today' : '',
            other ? 'other' : '',
            busy.has(dayKey(day)) ? 'busy' : '',
          ].join(' ');
          return html`<span
            class=${classes}
            role="gridcell"
            aria-current=${today ? 'date' : nothing}
            >${day.getDate()}</span
          >`;
        })}
      </div>
      ${this.renderSingle()}
    `;
  }

  /** The small tile: weekday, date, and the next event when there is one. */
  private renderSingle() {
    const weekday = new Intl.DateTimeFormat(locale(), {weekday: 'long'});
    const month = new Intl.DateTimeFormat(locale(), {month: 'long'});
    const next = this.events.find(event => event.end > Date.now());
    return html`
      <div class="single">
        <span class="weekday-name">${weekday.format(this.today)}</span>
        <span class="date">${this.today.getDate()}</span>
        <span class="next"
          >${next ? next.title : month.format(this.today)}</span
        >
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
    void this.loadEvents();
  };

  /** Another month; stepping back to this one shows today again. */
  private step(months: number): void {
    this.shown = new Date(
      this.shown.getFullYear(),
      this.shown.getMonth() + months,
      1,
    );
    void this.loadEvents();
  }

  /** At midnight "today" moves on; nothing runs in between. */
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
    void this.loadEvents();
    if (document.visibilityState !== 'visible') return;
    this.timer = window.setTimeout(this.tick, untilMidnight(now) + 1000);
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.tick();
    else clearTimeout(this.timer);
  };

  /** Events for what's on screen, from any registered source. */
  private async loadEvents(): Promise<void> {
    if (!hasSources()) return;
    const from = new Date(
      this.shown.getFullYear(),
      this.shown.getMonth() - 1,
      20,
    );
    const to = new Date(
      this.shown.getFullYear(),
      this.shown.getMonth() + 1,
      15,
    );
    this.events = await eventsIn({from: from.getTime(), to: to.getTime()});
  }
}

/** The local days an event covers, as day keys. */
function eventDays(event: CalendarEvent): string[] {
  const days: string[] = [];
  const day = startOfDay(new Date(event.start));
  const last = event.allDay ? event.end - 1 : event.end;
  while (day.getTime() <= last && days.length < 62) {
    days.push(dayKey(day));
    day.setDate(day.getDate() + 1);
  }
  return days;
}

customElements.define('tarn-calendar', TarnCalendar);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-calendar': TarnCalendar;
  }
}
