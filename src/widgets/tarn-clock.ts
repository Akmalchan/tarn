/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import type {ClockStyle} from '../settings/schema';
import {clockShowsWeather, clockTime} from './clock-faces';
import './tarn-weather';

/**
 * The big clock and date above the widgets. One size on every screen; only
 * a phone-narrow window gets a smaller one. It updates once a minute, on the
 * minute, and not at all while the tab is hidden. `face` picks the style:
 * classic (thin, with the date), bold, minimal (time only), serif, stacked
 * (hours over minutes), outline, or pixel (8-bit). None loads a font: serif
 * uses the system's, pixel is drawn (clock-faces.ts).
 */
export class TarnClock extends LitElement {
  static override properties = {
    now: {state: true},
    face: {type: String, reflect: true},
    weather: {type: Boolean},
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      color: var(--ink);
      text-shadow: var(--ink-shadow);
      user-select: none;
    }

    time {
      font-size: 112px;
      font-weight: 200;
      line-height: 0.92;
      letter-spacing: -0.04em;
      font-variant-numeric: tabular-nums;
    }

    :host([face='bold']) time {
      font-weight: 600;
      letter-spacing: -0.05em;
    }

    :host([face='serif']) time {
      font-family: ui-serif, 'New York', 'Iowan Old Style', Georgia, serif;
      font-weight: 400;
      letter-spacing: -0.02em;
    }

    :host([face='stacked']) time {
      display: grid;
      font-size: 104px;
      font-weight: 700;
      line-height: 0.84;
      letter-spacing: -0.05em;
    }

    :host([face='outline']) time {
      font-weight: 500;
      -webkit-text-fill-color: transparent;
      -webkit-text-stroke: 1.5px var(--ink);
      text-shadow: none;
    }

    :host([face='pixel']) time {
      line-height: 1;
    }

    .pixel {
      display: block;
      height: 0.6em;
      margin: 0.08em 0 0.1em;
    }

    .date {
      margin-top: 12px;
      font-size: 19px;
      font-weight: 450;
      color: var(--ink-dim);
    }

    .dot {
      margin: 0 0.45em;
    }

    @media (max-width: 480px) {
      time {
        font-size: 72px;
      }
      .date {
        font-size: 16px;
      }
    }
  `;

  declare now: Date;
  declare face: Exclude<ClockStyle, 'none'>;
  /** Show the weather on the date line (Settings > Clock), if the face can. */
  declare weather: boolean;
  private timer = 0;

  constructor() {
    super();
    this.now = new Date();
    this.face = 'center';
    this.weather = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.onVisibility);
    clearTimeout(this.timer);
  }

  override render() {
    const time = this.now
      .toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})
      .replace(/\s?[AP]M$/i, '');
    const date = this.now.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    return html`
      <time datetime=${this.now.toISOString()}
        >${clockTime(this.face, time)}</time
      >
      ${
        this.face === 'minimal'
          ? nothing
          : html`<div class="date">
              ${date}${
                this.weather && clockShowsWeather(this.face)
                  ? html`<span class="dot" aria-hidden="true">·</span
                      ><tarn-weather
                        inline
                        .widgetId=${'clock'}
                      ></tarn-weather>`
                  : nothing
              }
            </div>`
      }
    `;
  }

  private tick = () => {
    clearTimeout(this.timer);
    this.now = new Date();
    if (document.visibilityState !== 'visible') return;
    const untilNextMinute = 60_000 - (Date.now() % 60_000) + 20;
    this.timer = window.setTimeout(this.tick, untilNextMinute);
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.tick();
    else clearTimeout(this.timer);
  };
}

customElements.define('tarn-clock', TarnClock);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-clock': TarnClock;
  }
}
