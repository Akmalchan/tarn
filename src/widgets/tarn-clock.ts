/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import type {ClockStyle} from '../settings/schema';
import {clockText, clockTime, faceFilters, faceStyles} from './clock-faces';
import {darkInk, lightInk} from '../ui/ink';
import {LocaleController, locale} from '../i18n';

/**
 * The big clock and date above the widgets. One size on every screen; only
 * a phone-narrow window gets a smaller one. It updates once a minute, on the
 * minute, and not at all while the tab is hidden. `face` picks the style
 * (clock-faces.ts): classic (thin, with the date), glass, bold, rounded,
 * minimal (time only), serif, stacked, outline, pixel (8-bit), flip, lcd,
 * neon, fraktur, gotisch or analog. Serif uses the system's font; glass,
 * rounded and outline are SVG filters over the bundled one; pixel, lcd and
 * analog are drawn; fraktur and gotisch load their own bundled fonts, only
 * when shown. `tone` is what the clock is drawn for (a light or dark
 * wallpaper, or the user's color; `clockTone`); it sets the ink, and
 * faces that change with it follow.
 */
export class TarnClock extends LitElement {
  static override properties = {
    now: {state: true},
    face: {type: String, reflect: true},
    tone: {type: String, reflect: true},
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

    :host([tone='dark']) {
      ${darkInk}
    }

    :host([tone='light']) {
      ${lightInk}
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
      time,
      :host([face='stacked']) time {
        font-size: 72px;
      }
      .date {
        font-size: 16px;
      }
    }
  `;

  declare now: Date;
  declare face: Exclude<ClockStyle, 'none'>;
  declare tone: 'light' | 'dark';
  /** The time shown before this one, so the flip face can flip from it. */
  private previous = '';
  private timer = 0;

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.now = new Date();
    this.face = 'center';
    this.tone = 'dark';
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
    const previous = this.previous || time;
    const date = this.now.toLocaleDateString(locale(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    return html`
      ${faceFilters}
      <time class="t ${this.face}" datetime=${this.now.toISOString()}
        >${clockTime(this.face, time, this.now, previous)}</time
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
    this.previous = clockText(this.now);
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
