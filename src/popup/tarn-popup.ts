/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {canHandOff} from '../app/handoff';
import {openSidePanel, prepareSidePanel} from '../app/side-panel';
import {setTarnEnabled} from '../settings/enabled';
import {DEFAULT_SETTINGS, type Settings} from '../settings/schema';
import {loadSettings} from '../settings/store';
import '../ui/tarn-switch';
import {LocaleController, t, useLanguage} from '../i18n';

/**
 * The toolbar popup: Tarn's name and state, one switch that turns its new
 * tab on or off, and a quiet link to settings.
 */
export class TarnPopup extends LitElement {
  static override properties = {
    settings: {state: true},
    loaded: {state: true},
  };

  static override styles = css`
    :host {
      --bg: #ffffff;
      --ink: #1d1d1f;
      --dim: #6e6e73;
      --hover: rgb(0 0 0 / 0.05);
      --switch-on: #34c759;
      --switch-off: #e5e5ea;
      --switch-focus: rgb(0 0 0 / 0.4);
      box-sizing: border-box;
      display: block;
      width: 260px;
      padding: 14px 14px 10px;
      font-family:
        system-ui,
        -apple-system,
        'Segoe UI',
        Roboto,
        sans-serif;
      color: var(--ink);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #2a2a2c;
        --ink: #f5f5f7;
        --dim: #98989d;
        --hover: rgb(255 255 255 / 0.07);
        --switch-on: #30d158;
        --switch-off: #48484a;
        --switch-focus: rgb(255 255 255 / 0.6);
      }
    }

    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }

    .state {
      margin-top: 2px;
      font-size: 12px;
      color: var(--dim);
    }

    .link {
      display: flex;
      align-items: center;
      gap: 6px;
      width: calc(100% + 12px);
      margin: 8px -6px 0;
      padding: 6px;
      border: 0;
      border-radius: 6px;
      font: inherit;
      font-size: 13px;
      color: var(--dim);
      background: none;
      cursor: pointer;
      text-align: left;
    }

    .link:hover {
      color: var(--ink);
      background: var(--hover);
    }

    .link svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .note {
      margin: 8px 0 2px;
      font-size: 12px;
      line-height: 1.45;
      color: var(--dim);
    }
  `;

  declare settings: Settings;
  declare loaded: boolean;

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.settings = DEFAULT_SETTINGS;
    this.loaded = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void prepareSidePanel();
    void loadSettings().then(settings => {
      this.settings = settings;
      this.loaded = true;
      void useLanguage(settings.language);
    });
  }

  override render() {
    const {enabled} = this.settings;
    return html`
      <div class="top">
        <div>
          <h1>Tarn</h1>
          <div class="state">${enabled ? t('popup.on') : t('popup.off')}</div>
        </div>
        <tarn-switch
          label=${t('popup.newTab')}
          .checked=${enabled}
          ?disabled=${!this.loaded || !canHandOff}
          @change=${this.onEnabledChange}
        ></tarn-switch>
      </div>
      <button class="link" @click=${this.openSettings}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
          />
        </svg>
        ${t('common.settings')}
      </button>
      ${canHandOff ? nothing : html`<p class="note">${t('popup.firefox')}</p>`}
    `;
  }

  private onEnabledChange = async (event: CustomEvent<boolean>) => {
    this.settings = await setTarnEnabled(event.detail);
  };

  /** Settings live in the side panel; opened inside this click. */
  private openSettings = () => {
    openSidePanel();
    window.close();
  };
}

customElements.define('tarn-popup', TarnPopup);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-popup': TarnPopup;
  }
}
