/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import type {ClockStyle} from '../settings/schema';
import {clockText, clockTime, faceFilters, faceStyles} from './clock-faces';
import {LocaleController, locale} from '../i18n';

/**
 * The big clock and date above the widgets. One size on every screen; only
 * a phone-narrow window gets a smaller one. It updates once a minute, on the
 * minute, and not at all while the tab is hidden. `face` picks the style
 * (clock-faces.ts): classic (thin, with the date), glass, bold, rounded,
 * duo (heavy hours, hairline minutes), tall, minimal (time only), serif,
 * stacked, outline, pixel (8-bit) or analog. None loads a font: serif uses
 * the system's; glass, rounded and outline are SVG filters over the
 * bundled one; pixel and analog are drawn.
 */
export class TarnClock extends LitElement {
  static override properties = {
    now: {state: true},
    face: {type: String, reflect: true},
  };

  static override styles = css`
    ${faceStyles}

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

    :host([face='stacked']) time {
      font-size: 104px;
    }

    :host([face='pixel']) time {
      line-height: 1;
    }

    .date {
      margin-top: 12px;
      font-size: 19px;
      font-weight: 450;
      color: var(--ink-dim);
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
  private timer = 0;

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.now = new Date();
    this.face = 'center';
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
    const time = clockText(this.now);
    const date = this.now.toLocaleDateString(locale(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    return html`
      ${faceFilters}
      <time class="t ${this.face}" datetime=${this.now.toISOString()}
        >${clockTime(this.face, time, this.now)}</time
      >
      ${
        this.face === 'minimal'
          ? nothing
          : html`<div class="date">${date}</div>`
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
