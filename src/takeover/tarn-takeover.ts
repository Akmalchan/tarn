/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {browser} from 'wxt/browser';
import '../backdrop/tarn-backdrop';
import {rememberEnabled} from '../app/first-paint';
import {saveSettings} from '../settings/store';
import {
  disableRivals,
  hasManagePermission,
  listRivals,
  requestManagePermission,
  type Rival,
} from './rivals';
import {LocaleController, t, useLanguage} from '../i18n';
import {loadSettings} from '../settings/store';

type Step = 'loading' | 'permission' | 'choose' | 'done';

/**
 * Lets the user switch off other new-tab extensions so Tarn takes over.
 * Lives in a full tab rather than the popup because the permission prompt
 * would close a popup mid-request.
 */
export class TarnTakeover extends LitElement {
  static override properties = {
    step: {state: true},
    rivals: {state: true},
    selected: {state: true},
    busy: {state: true},
    denied: {state: true},
  };

  static override styles = css`
    :host {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 24px;
    }

    .card {
      position: relative;
      width: min(480px, 100%);
      padding: 28px;
      border-radius: 24px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(28px) saturate(1.4);
      -webkit-backdrop-filter: blur(28px) saturate(1.4);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    p {
      margin: 0 0 20px;
      font-size: 14px;
      line-height: 1.55;
      color: var(--text-dim);
    }

    ul {
      list-style: none;
      margin: 0 0 20px;
      padding: 0;
      max-height: 320px;
      overflow-y: auto;
    }

    li label {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      cursor: pointer;
      transition: background-color 150ms ease;
    }

    li label:hover {
      background: var(--glass-active);
    }

    input[type='checkbox'] {
      width: 16px;
      height: 16px;
      accent-color: #3a9bc1;
      flex: none;
    }

    li img {
      width: 24px;
      height: 24px;
      flex: none;
    }

    .name {
      flex: 1;
      font-size: 14px;
    }

    .tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgb(58 155 193 / 0.25);
      color: #a9cfe0;
    }

    button {
      width: 100%;
      padding: 12px 16px;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      color: #05080f;
      background: #e6f2f8;
      border: 0;
      border-radius: 12px;
      cursor: pointer;
      transition: opacity 150ms ease;
    }

    button:disabled {
      opacity: 0.45;
      cursor: default;
    }

    button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }

    .fine {
      margin: 12px 0 0;
      font-size: 12px;
    }
  `;

  declare step: Step;
  declare rivals: Rival[];
  declare selected: Set<string>;
  declare busy: boolean;
  declare denied: boolean;

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    void loadSettings().then(settings => useLanguage(settings.language));
    this.step = 'loading';
    this.rivals = [];
    this.selected = new Set();
    this.busy = false;
    this.denied = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this.start();
  }

  override render() {
    return html`
      <tarn-backdrop scene="tarn"></tarn-backdrop>
      <div class="card">${this.renderStep()}</div>
    `;
  }

  private renderStep() {
    switch (this.step) {
      case 'loading':
        return nothing;
      case 'permission':
        return html`
          <h1>${t('takeover.permissionTitle')}</h1>
          <p>${t('takeover.permissionBody')}</p>
          <button ?disabled=${this.busy} @click=${this.askPermission}>
            ${t('takeover.allow')}
          </button>
          <p class="fine">
            ${this.denied ? t('takeover.denied') : t('takeover.confirmNote')}
          </p>
        `;
      case 'choose':
        return this.renderChoose();
      case 'done':
        return html`
          <h1>${t('takeover.doneTitle')}</h1>
          <p>${t('takeover.doneBody')}</p>
          <button @click=${this.openNewTab}>${t('takeover.openNewTab')}</button>
        `;
    }
  }

  private renderChoose() {
    if (!this.rivals.length) {
      return html`
        <h1>${t('takeover.clearTitle')}</h1>
        <p>${t('takeover.clearBody')}</p>
        <button @click=${this.openNewTab}>${t('takeover.openNewTab')}</button>
      `;
    }
    return html`
      <h1>${t('takeover.chooseTitle')}</h1>
      <p>${t('takeover.chooseBody')}</p>
      <ul>
        ${this.rivals.map(
          rival => html`
            <li>
              <label>
                <input
                  type="checkbox"
                  .checked=${this.selected.has(rival.id)}
                  @change=${() => this.toggle(rival.id)}
                />
                ${
                  rival.iconUrl
                    ? html`<img src=${rival.iconUrl} alt="" />`
                    : nothing
                }
                <span class="name">${rival.name}</span>
                ${
                  rival.likelyNewTab
                    ? html`<span class="tag">${t('takeover.newTabTag')}</span>`
                    : nothing
                }
              </label>
            </li>
          `,
        )}
      </ul>
      <button
        ?disabled=${this.busy || !this.selected.size}
        @click=${this.takeOver}
      >
        ${t('takeover.switchOff')}
      </button>
    `;
  }

  private async start(): Promise<void> {
    if (await hasManagePermission()) await this.loadRivals();
    else this.step = 'permission';
  }

  private askPermission = async () => {
    this.busy = true;
    const granted = await requestManagePermission().catch(() => false);
    this.busy = false;
    if (granted) await this.loadRivals();
    else this.denied = true;
  };

  private async loadRivals(): Promise<void> {
    this.rivals = await listRivals();
    this.selected = new Set(
      this.rivals.filter(r => r.likelyNewTab).map(r => r.id),
    );
    this.step = 'choose';
  }

  private toggle(id: string): void {
    const next = new Set(this.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected = next;
  }

  private takeOver = async () => {
    this.busy = true;
    await disableRivals([...this.selected]);
    rememberEnabled(true);
    await saveSettings({enabled: true});
    this.busy = false;
    this.step = 'done';
  };

  private openNewTab = () => {
    void browser.tabs.create({});
  };
}

customElements.define('tarn-takeover', TarnTakeover);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-takeover': TarnTakeover;
  }
}
