/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {widgetStyles} from './styles';

const DURATION_MS = 25 * 60_000;
/** Circumference of the progress ring (radius 45 in a 100-unit box). */
const RING = 2 * Math.PI * 45;

/**
 * Timer state. While running, only the end time is stored, so every open
 * tab shows the same countdown and nothing needs to tick in the background.
 */
interface FocusState {
  /** When the running timer ends (epoch ms), or null when paused. */
  readonly endsAt: number | null;
  /** Time left while paused. */
  readonly remaining: number;
}

const IDLE: FocusState = {endsAt: null, remaining: DURATION_MS};

function normalize(raw: unknown): FocusState {
  if (typeof raw !== 'object' || raw === null) return IDLE;
  const {endsAt, remaining} = raw as Record<string, unknown>;
  return {
    endsAt:
      typeof endsAt === 'number' && Number.isFinite(endsAt) ? endsAt : null,
    remaining:
      typeof remaining === 'number' &&
      remaining >= 0 &&
      remaining <= DURATION_MS
        ? remaining
        : DURATION_MS,
  };
}

/** A 25-minute focus timer. It ticks once a second, only while visible. */
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

      .dial {
        position: relative;
        margin-top: auto;
      }

      .ring {
        display: none;
      }

      .time {
        font-size: 34px;
        font-weight: 250;
        line-height: 1;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
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

      /* Tall and large tiles: a ring that empties as time runs out. */
      @container (min-height: 250px) {
        :host {
          --ring: 168px;
          align-items: center;
        }
        h3 {
          display: block;
          align-self: flex-start;
        }
        .dial {
          display: grid;
          place-items: center;
          width: var(--ring);
          height: var(--ring);
          margin: auto;
        }
        .ring {
          display: block;
          position: absolute;
          inset: 0;
          transform: rotate(-90deg);
        }
        .time {
          font-size: calc(var(--ring) * 0.22);
        }
        .actions {
          justify-content: center;
        }
      }

      @container (min-height: 250px) and (max-width: 200px) {
        :host {
          --ring: 100px;
        }
      }

      /* A small tile has room for one button. */
      @container (max-width: 200px) and (max-height: 140px) {
        .actions button + button {
          display: none;
        }
      }

      .track {
        stroke: var(--chip);
      }

      .progress {
        stroke: var(--ink);
        transition: stroke-dashoffset 1s linear;
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
    this.widgetId = '';
    this.state = IDLE;
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
    const {endsAt} = this.state;
    const left = this.left();
    const finished = endsAt !== null && left === 0;
    const minutes = Math.floor(left / 60_000);
    const seconds = Math.floor((left % 60_000) / 1000);
    const label =
      endsAt !== null ? 'Pause' : left < DURATION_MS ? 'Resume' : 'Start';
    return html`
      <h3>Focus</h3>
      <div class="dial">
        <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            class="track"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke-width="4"
          ></circle>
          <circle
            class="progress"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray=${RING}
            stroke-dashoffset=${RING * (1 - left / DURATION_MS)}
          ></circle>
        </svg>
        <div class="time" role="timer" aria-live="off">
          ${minutes}:${String(seconds).padStart(2, '0')}
        </div>
      </div>
      <div class="actions">
        ${
          finished
            ? html`<span class="done">Break time</span>`
            : html`<button @click=${this.toggle}>${label}</button>`
        }
        ${
          (left < DURATION_MS && endsAt === null) || finished
            ? html`<button @click=${this.reset}>Reset</button>`
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

  private toggle = () => {
    this.now = Date.now();
    const left = this.left();
    const next: FocusState =
      this.state.endsAt === null
        ? {endsAt: this.now + left, remaining: left}
        : {endsAt: null, remaining: left};
    this.apply(next);
    void saveWidgetData(this.widgetId, next);
  };

  private reset = () => {
    this.apply(IDLE);
    void saveWidgetData(this.widgetId, IDLE);
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
