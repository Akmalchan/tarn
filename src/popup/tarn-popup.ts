/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {browser} from 'wxt/browser';
import {canHandOff} from '../app/handoff';
import {setTarnEnabled} from '../settings/enabled';
import {DEFAULT_SETTINGS, type Settings} from '../settings/schema';
import {loadSettings} from '../settings/store';
import {canManageRivals} from '../takeover/rivals';
import '../ui/tarn-switch';

/** The toolbar popup: one switch that turns Tarn's new tab on or off. */
export class TarnPopup extends LitElement {
  static override properties = {
    settings: {state: true},
    loaded: {state: true},
  };

  static override styles = css`
    :host {
      display: block;
      width: 300px;
      padding: 16px;
      font-family:
        system-ui,
        -apple-system,
        'Segoe UI',
        Roboto,
        sans-serif;
      color: rgb(244 247 251);
      background: linear-gradient(180deg, #0d2740 0%, #05080f 100%);
      -webkit-font-smoothing: antialiased;
    }

    header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    header img {
      width: 28px;
      height: 28px;
    }

    h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgb(255 255 255 / 0.06);
      border: 1px solid rgb(255 255 255 / 0.1);
    }

    .label {
      font-size: 14px;
      font-weight: 500;
    }

    .hint {
      margin-top: 2px;
      font-size: 12px;
      color: rgb(244 247 251 / 0.6);
    }

    .fix {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      margin-top: 8px;
      padding: 10px 14px;
      font: inherit;
      font-size: 13px;
      text-align: left;
      color: rgb(244 247 251 / 0.8);
      background: transparent;
      border: 1px solid rgb(255 255 255 / 0.1);
      border-radius: 14px;
      cursor: pointer;
      transition: background-color 150ms ease;
    }

    .fix .go {
      color: #a9cfe0;
      white-space: nowrap;
    }

    .fix:hover {
      background: rgb(255 255 255 / 0.06);
    }

    .note {
      margin: 12px 2px 0;
      font-size: 12px;
      line-height: 1.45;
      color: rgb(244 247 251 / 0.55);
    }
  `;

  declare settings: Settings;
  declare loaded: boolean;

  constructor() {
    super();
    this.settings = DEFAULT_SETTINGS;
    this.loaded = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void loadSettings().then(settings => {
      this.settings = settings;
      this.loaded = true;
    });
  }

  override render() {
    const {enabled} = this.settings;
    return html`
      <header>
        <img src="/icon/48.png" alt="" />
        <h1>Tarn</h1>
      </header>
      <div class="row">
        <div>
          <div class="label">Tarn new tab</div>
          <div class="hint">
            ${
              enabled
                ? 'New tabs open Tarn.'
                : 'New tabs open the default page.'
            }
          </div>
        </div>
        <tarn-switch
          label="Tarn new tab"
          .checked=${enabled}
          ?disabled=${!this.loaded || !canHandOff}
          @change=${this.onEnabledChange}
        ></tarn-switch>
      </div>
      ${
        canManageRivals
          ? html`<button class="fix" @click=${this.openTakeover}>
              <span>Other new tab taking over?</span>
              <span class="go">Fix it →</span>
            </button>`
          : nothing
      }
      ${
        canHandOff
          ? nothing
          : html`<p class="note">
              In Firefox, turn Tarn off from Add-ons and themes (about:addons).
            </p>`
      }
      <p class="note">
        Tip: pin Tarn from the puzzle menu to keep this one click away.
      </p>
    `;
  }

  private onEnabledChange = async (event: CustomEvent<boolean>) => {
    this.settings = await setTarnEnabled(event.detail);
  };

  private openTakeover = () => {
    void browser.tabs.create({url: browser.runtime.getURL('/takeover.html')});
    window.close();
  };
}

customElements.define('tarn-popup', TarnPopup);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-popup': TarnPopup;
  }
}
