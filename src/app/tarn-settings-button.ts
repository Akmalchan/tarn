/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {LitElement, css, html, nothing} from 'lit';
import {finishTip, takeTip} from './first-run';
import {openSidePanel, prepareSidePanel, watchSidePanel} from './side-panel';
import {LocaleController, t} from '../i18n';

/**
 * "settings" from Google's Material Icons, Apache License 2.0.
 * https://github.com/google/material-design-icons
 */
const MATERIAL_SETTINGS =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z';

/** The scene's fade and settle (docs/design.md, Motion) are over by then. */
const TIP_AFTER_MS = 1800;
const TIP_OUT_MS = 200;

/**
 * A small settings button in the bottom-right corner. Opens Tarn in the
 * browser's side panel, and steps aside while that panel is open. On the
 * first new tabs after an install it is awake and points itself out with
 * a small card (`first-run.ts`).
 */
export class TarnSettingsButton extends LitElement {
  static override properties = {
    panelOpen: {type: Boolean, reflect: true, attribute: 'panel-open'},
    tip: {type: String, reflect: true},
  };

  static override styles = css`
    /* The host is an invisible zone around the corner: the button wakes up
       as the pointer approaches, before it is actually touched. */
    :host {
      position: fixed;
      right: 0;
      bottom: 0;
      padding: 28px 14px 14px 32px;
      transition: opacity 200ms ease;
    }

    :host([panel-open]) {
      opacity: 0;
      pointer-events: none;
    }

    /* At rest: just a faint gear. Near: a round glass button around it. */
    .gear {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      color: rgb(255 255 255 / 0.38);
      background: rgb(255 255 255 / 0);
      border: 0;
      border-radius: 50%;
      cursor: pointer;
      transition:
        color 250ms ease,
        background-color 250ms ease;
    }

    :host(:hover) .gear,
    .gear:focus-visible {
      color: rgb(255 255 255 / 0.95);
      background: rgb(255 255 255 / 0.16);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
    }

    .gear:hover {
      background: rgb(255 255 255 / 0.22);
    }

    button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }

    svg {
      width: 20px;
      height: 20px;
      /* Keeps the faint gear readable on light backgrounds too. */
      filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.18));
      transition: transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    :host(:hover) svg,
    button.gear:focus-visible svg {
      transform: rotate(60deg);
    }

    @media (prefers-reduced-motion: reduce) {
      :host(:hover) svg,
      button.gear:focus-visible svg {
        transform: none;
      }
    }

    /* The first-run tip: the gear wakes up and wears a soft ring. */
    :host([tip]) .gear {
      color: rgb(255 255 255 / 0.95);
      background: rgb(255 255 255 / 0.16);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
    }

    .ring {
      position: absolute;
      right: 10px;
      bottom: 10px;
      width: 40px;
      height: 40px;
      border: 1.5px solid rgb(255 255 255 / 0.55);
      border-radius: 50%;
      pointer-events: none;
      animation: ring 2.4s ease-out 2;
    }

    @keyframes ring {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      70% {
        transform: scale(1.35);
        opacity: 0;
      }
      71% {
        transform: scale(1);
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }

    .card {
      position: absolute;
      right: 14px;
      bottom: 58px;
      width: 268px;
      padding: 16px 16px 12px;
      font-family: var(--font-sans);
      color: rgb(244 247 251);
      background: rgb(14 18 28 / 0.55);
      backdrop-filter: blur(28px) saturate(1.4);
      -webkit-backdrop-filter: blur(28px) saturate(1.4);
      border: 1px solid rgb(255 255 255 / 0.14);
      border-radius: 16px;
      box-shadow: 0 18px 40px -18px rgb(0 0 0 / 0.55);
      opacity: 0;
      transform: translateY(6px);
      transition:
        opacity 320ms ease,
        transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    :host([tip='in']) .card {
      opacity: 1;
      transform: none;
    }

    :host([tip='out']) .card,
    :host([tip='out']) .ring {
      opacity: 0;
      transition-duration: ${TIP_OUT_MS}ms;
    }

    /* Points down at the gear. */
    .card::after {
      position: absolute;
      right: 10px;
      bottom: -7px;
      width: 12px;
      height: 12px;
      content: '';
      background: inherit;
      border-right: inherit;
      border-bottom: inherit;
      transform: rotate(45deg);
    }

    h2 {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
    }

    p {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: rgb(244 247 251 / 0.7);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
      margin-top: 12px;
    }

    .actions button {
      height: 28px;
      padding: 0 12px;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
      transition: background-color 200ms ease;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      border-radius: 999px;
    }

    .actions button:hover {
      background: rgb(255 255 255 / 0.12);
    }

    .actions .later {
      margin-left: -8px;
      padding: 0 8px;
      font-weight: 500;
      color: rgb(244 247 251 / 0.7);
    }

    .actions .open,
    .actions .open:hover {
      color: rgb(14 18 28);
      background: rgb(244 247 251 / 0.92);
    }

    @media (prefers-reduced-motion: reduce) {
      .ring {
        animation: none;
      }

      .card {
        transform: none;
      }
    }
  `;

  declare panelOpen: boolean;
  /** The first-run tip: absent, fading in ('in') or out ('out'). */
  declare tip: 'in' | 'out' | undefined;
  private unwatch: () => void = () => {};
  private stopWaiting: () => void = () => {};

  constructor() {
    super();
    new LocaleController(this);
    this.panelOpen = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void prepareSidePanel();
    this.unwatch = watchSidePanel(open => {
      this.panelOpen = open;
      if (open) this.endTip();
    });
    this.waitForTip();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    this.stopWaiting();
  }

  /**
   * The tip waits for the scene to settle and for the person to move the
   * mouse or press a key, so it never competes with the arrival or with
   * the browser's own "keep this page?" bubble.
   */
  private waitForTip(): void {
    const start = performance.now();
    const wake = () => {
      this.stopWaiting();
      const left = TIP_AFTER_MS - (performance.now() - start);
      const timer = setTimeout(() => void this.showTip(), Math.max(0, left));
      this.stopWaiting = () => clearTimeout(timer);
    };
    addEventListener('pointermove', wake, {once: true, passive: true});
    addEventListener('keydown', wake, {once: true});
    this.stopWaiting = () => {
      removeEventListener('pointermove', wake);
      removeEventListener('keydown', wake);
    };
  }

  private async showTip(): Promise<void> {
    // The dev build (npm run dev) shows it on every new tab, for review.
    const show = import.meta.env.DEV || (await takeTip().catch(() => false));
    if (this.panelOpen || !show) return;
    if (this.panelOpen) return;
    this.tip = 'out';
    await this.updateComplete;
    // One frame at opacity 0 first, so the card fades in.
    requestAnimationFrame(() => {
      if (this.tip) this.tip = 'in';
    });
    addEventListener('keydown', this.onKey);
  }

  private endTip(): void {
    removeEventListener('keydown', this.onKey);
    if (!this.tip) return;
    void finishTip().catch(() => {});
    this.tip = 'out';
    setTimeout(() => (this.tip = undefined), TIP_OUT_MS);
  }

  private onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.endTip();
  };

  override render() {
    return html`
      ${this.tip ? this.renderTip() : nothing}
      <button
        class="gear"
        title=${t('common.settings')}
        aria-label=${t('common.openSettings')}
        ?inert=${this.panelOpen}
        @click=${this.open}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d=${MATERIAL_SETTINGS} />
        </svg>
      </button>
    `;
  }

  private renderTip() {
    return html`
      <span class="ring"></span>
      <aside class="card" aria-labelledby="tip-title" aria-live="polite">
        <h2 id="tip-title">${t('tip.title')}</h2>
        <p>${t('tip.body')}</p>
        <div class="actions">
          <button class="later" @click=${this.endTip}>${t('tip.gotIt')}</button>
          <button class="open" @click=${this.open}>
            ${t('common.openSettings')}
          </button>
        </div>
      </aside>
    `;
  }

  private open = () => {
    this.endTip();
    openSidePanel();
    // Hide right away; the panel's open event confirms it a moment later.
    if (!import.meta.env.FIREFOX) this.panelOpen = true;
  };
}

customElements.define('tarn-settings-button', TarnSettingsButton);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-settings-button': TarnSettingsButton;
  }
}
