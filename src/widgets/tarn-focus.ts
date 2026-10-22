/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
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
import {
  DEFAULT_MS,
  MAX_MS,
  MIN_MS,
  cleanDuration,
  format,
  nextTickMs,
  parseDuration,
} from './focus-time';
import {isComposing} from '../app/shortcuts';

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
  // Lengths from before the 9-hour limit come back as 9 hours.
  const length = inRange(duration, MIN_MS, Infinity)
    ? Math.min(duration, MAX_MS)
    : DEFAULT_MS;
  return {
    duration: length,
    endsAt:
      typeof endsAt === 'number' && Number.isFinite(endsAt) ? endsAt : null,
    remaining: inRange(remaining, 0, length) ? remaining : length,
  };
}

/**
 * A focus timer, 25 minutes unless you click the time and type another.
 * It ticks once a second, only while running and visible.
 */
export class TarnFocus extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    heading: {attribute: false},
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
        /* As big as the tile allows (its width less the 18px sides):
           --chars is the text's length and a digit is about 0.53em wide,
           so "9:00:00" still fits a small tile. */
        font-size: min(34px, calc((100cqw - 36px) / (var(--chars, 5) * 0.53)));
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
          font-size: min(
            48px,
            calc((100cqw - 36px) / (var(--chars, 5) * 0.53))
          );
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
  /** The widget's name: the user's, or the default ("Timer"). */
  declare heading: string;
  declare state: FocusState;
  declare now: number;
  private timer = 0;
  private unwatch: () => void = () => {};

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgetId = '';
    this.heading = t('widget.focus');
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
      <h3>${this.heading}</h3>
      <input
        class="time"
        role="timer"
        aria-label=${running ? t('focus.timeLeft') : t('focus.length')}
        title=${running ? '' : t('focus.change')}
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        style="--chars: ${format(left).length}"
        ?readonly=${running}
        .value=${live(format(left))}
        @input=${this.onTimeInput}
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
    if (isComposing(event)) return;
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') input.blur();
    if (event.key === 'Escape') {
      this.showLeft(input);
      input.blur();
    }
  };

  /** Drops letters and other stray characters as they're typed. */
  private onTimeInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const clean = cleanDuration(input.value);
    if (clean !== input.value) {
      const caret = Math.min(
        clean.length,
        (input.selectionStart ?? clean.length) -
          (input.value.length - clean.length),
      );
      input.value = clean;
      input.setSelectionRange(Math.max(caret, 0), Math.max(caret, 0));
    }
    // The text shrinks to fit while it grows.
    input.style.setProperty('--chars', String(Math.max(clean.length, 5)));
  };

  /** A typed length becomes the timer's new length, ready to start. */
  private onTimeChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const duration = parseDuration(input.value);
    if (duration !== null && this.state.endsAt === null) {
      this.store(idle(duration));
    }
    this.showLeft(input);
  };

  private onTimeBlur = (event: FocusEvent) => {
    this.showLeft(event.target as HTMLInputElement);
  };

  /** Back to the time left, at its own size. */
  private showLeft(input: HTMLInputElement): void {
    const text = format(this.left());
    input.value = text;
    input.style.setProperty('--chars', String(text.length));
  }

  /** One tick per second while running and visible; nothing otherwise. */
  private schedule = () => {
    clearTimeout(this.timer);
    this.now = Date.now();
    if (this.state.endsAt === null || document.visibilityState !== 'visible') {
      return;
    }
    const left = this.left();
    if (left === 0) return;
    // On the countdown's own seconds (the time shown rounds up), so each
    // digit and the end come right on time, not up to a second late.
    this.timer = window.setTimeout(this.schedule, nextTickMs(left));
  };
}

customElements.define('tarn-focus', TarnFocus);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-focus': TarnFocus;
  }
}
