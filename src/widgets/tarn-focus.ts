/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {live} from 'lit/directives/live.js';
import {
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {widgetStyles} from './styles';
import {LocaleController, t} from '../i18n';

const DEFAULT_MS = 25 * 60_000;
const MIN_MS = 10_000;
const MAX_MS = 10 * 60 * 60_000;

/**
 * Timer state. While running, only the end time is stored, so every open
 * tab shows the same countdown and nothing needs to tick in the background.
 */
interface FocusState {
  /** The timer's length, set by clicking the time and typing. */
  readonly duration: number;
  /** When the running timer ends (epoch ms), or null when paused. */
  readonly endsAt: number | null;
  /** Time left while paused. */
  readonly remaining: number;
}

const idle = (duration = DEFAULT_MS): FocusState => ({
  duration,
  endsAt: null,
  remaining: duration,
});

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && value >= min && value <= max;

function normalize(raw: unknown): FocusState {
  if (typeof raw !== 'object' || raw === null) return idle();
  const {duration, endsAt, remaining} = raw as Record<string, unknown>;
  const length = inRange(duration, MIN_MS, MAX_MS) ? duration : DEFAULT_MS;
  return {
    duration: length,
    endsAt:
      typeof endsAt === 'number' && Number.isFinite(endsAt) ? endsAt : null,
    remaining: inRange(remaining, 0, length) ? remaining : length,
  };
}

/** "25:00", or "1:30:00" past an hour. */
function format(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * What the user typed as a length: "45" is minutes, "12:30" minutes and
 * seconds, "1:30:00" hours too. Null if it isn't a time.
 */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length > 3 || parts.some(p => !/^\d{1,3}$/.test(p))) return null;
  const [a, b, c] = parts.map(Number) as [number, number?, number?];
  const ms =
    parts.length === 1
      ? a * 60_000
      : parts.length === 2
        ? a * 60_000 + b! * 1000
        : a * 3_600_000 + b! * 60_000 + c! * 1000;
  return ms >= MIN_MS && ms <= MAX_MS ? ms : null;
}

/**
 * A focus timer, 25 minutes unless you click the time and type another.
 * It ticks once a second, only while running and visible.
 */
export class TarnFocus extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    state: {state: true},
    now: {state: true},
  };

  static override styles = [
    widgetStyles,
    css`
      /* Small and medium tiles: the time and a button, nothing else. */
      h3 {
        display: none;
      }

      .time {
        width: 100%;
        min-width: 0;
        margin-top: auto;
        padding: 0;
        font: inherit;
        font-size: 34px;
        font-weight: 250;
        line-height: 1;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
        color: var(--ink);
        text-shadow: inherit;
        background: transparent;
        border: 0;
        border-radius: 6px;
        outline: none;
        cursor: text;
      }

      .time[readonly] {
        cursor: default;
      }

      .time:focus:not([readonly]) {
        background: var(--chip);
      }

      .actions {
        display: flex;
        gap: 6px;
        min-height: 30px;
      }

      .actions button {
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 500;
        border: 0;
        border-radius: 999px;
        background: var(--chip);
        cursor: pointer;
        transition: background-color 150ms ease;
      }

      .actions button:hover {
        background: var(--chip-hover);
      }

      .done {
        align-self: center;
        font-size: 12px;
        color: var(--ink-dim);
      }

      @container (min-width: 250px) {
        .time {
          font-size: 48px;
        }
      }

      /* A small tile has room for one button. */
      @container (max-width: 200px) {
        .actions button + button {
          display: none;
        }
      }
    `,
  ];

  declare widgetId: string;
  declare state: FocusState;
  declare now: number;
  private timer = 0;
  private unwatch: () => void = () => {};

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgetId = '';
    this.state = idle();
    this.now = Date.now();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.apply(peekWidgetData(this.widgetId, normalize));
    void loadWidgetData(this.widgetId, normalize).then(s => this.apply(s));
    this.unwatch = watchWidgetData(this.widgetId, normalize, s =>
      this.apply(s),
    );
    document.addEventListener('visibilitychange', this.schedule);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    document.removeEventListener('visibilitychange', this.schedule);
    clearTimeout(this.timer);
  }

  override render() {
    const {endsAt, duration} = this.state;
    const left = this.left();
    const running = endsAt !== null;
    const finished = running && left === 0;
    const label = running
      ? t('focus.pause')
      : left < duration
        ? t('focus.resume')
        : t('focus.start');
    return html`
      <h3>${t('focus.title')}</h3>
      <input
        class="time"
        role="timer"
        aria-label=${running ? t('focus.timeLeft') : t('focus.length')}
        title=${running ? '' : t('focus.change')}
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        ?readonly=${running}
        .value=${live(format(left))}
        @focus=${this.onTimeFocus}
        @keydown=${this.onTimeKey}
        @change=${this.onTimeChange}
        @blur=${this.onTimeBlur}
      />
      <div class="actions">
        ${
          finished
            ? html`<span class="done">${t('focus.break')}</span>`
            : html`<button @click=${this.toggle}>${label}</button>`
        }
        ${
          (left < duration && !running) || finished
            ? html`<button @click=${this.reset}>${t('focus.reset')}</button>`
            : nothing
        }
      </div>
    `;
  }

  private left(): number {
    const {endsAt, remaining} = this.state;
    return endsAt === null ? remaining : Math.max(0, endsAt - this.now);
  }

  private apply(state: FocusState): void {
    this.state = state;
    this.now = Date.now();
    this.schedule();
  }

  private store(state: FocusState): void {
    this.apply(state);
    void saveWidgetData(this.widgetId, state);
  }

  private toggle = () => {
    this.now = Date.now();
    const left = this.left();
    const {duration, endsAt} = this.state;
    this.store(
      endsAt === null
        ? {duration, endsAt: this.now + left, remaining: left}
        : {duration, endsAt: null, remaining: left},
    );
  };

  private reset = () => this.store(idle(this.state.duration));

  private onTimeFocus = (event: FocusEvent) => {
    const input = event.target as HTMLInputElement;
    if (!input.readOnly) input.select();
  };

  private onTimeKey = (event: KeyboardEvent) => {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') input.blur();
    if (event.key === 'Escape') {
      input.value = format(this.left());
      input.blur();
    }
  };

  /** A typed length becomes the timer's new length, ready to start. */
  private onTimeChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const duration = parseDuration(input.value);
    if (duration !== null && this.state.endsAt === null) {
      this.store(idle(duration));
    }
    input.value = format(this.left());
  };

  private onTimeBlur = (event: FocusEvent) => {
    (event.target as HTMLInputElement).value = format(this.left());
  };

  /** One tick per second while running and visible; nothing otherwise. */
  private schedule = () => {
    clearTimeout(this.timer);
    this.now = Date.now();
    if (this.state.endsAt === null || document.visibilityState !== 'visible') {
      return;
    }
    if (this.left() === 0) return;
    this.timer = window.setTimeout(this.schedule, 1000 - (this.now % 1000) + 5);
  };
}

customElements.define('tarn-focus', TarnFocus);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-focus': TarnFocus;
  }
}
