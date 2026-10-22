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
import {applyAppearance} from '../ui/appearance';
import {surface} from '../ui/ink';

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
    showAll: {state: true},
  };

  static override styles = css`
    /* The system's light or dark mode (ui/ink.ts). */
    :host {
      ${surface}
      --tag: light-dark(rgb(58 155 193 / 0.14), rgb(58 155 193 / 0.25));
      --tag-ink: light-dark(#1f6178, #a9cfe0);
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 24px;
      color: var(--ink);
    }

    .card {
      position: relative;
      width: min(480px, 100%);
      padding: 28px;
      border-radius: 24px;
      background: var(--surface);
      border: 1px solid var(--tile-line);
      box-shadow: var(--surface-shadow);
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
      color: var(--ink-dim);
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
      background: var(--chip);
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
      background: var(--tag);
      color: var(--tag-ink);
    }

    button {
      width: 100%;
      padding: 12px 16px;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      color: var(--surface);
      background: var(--ink);
      border: 0;
      border-radius: 12px;
      cursor: pointer;
      transition: opacity 150ms ease;
    }

    /* "Show all extensions": a quiet disclosure, not a second action. */
    button.more {
      width: auto;
      margin: -8px 0 16px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      color: var(--ink-dim);
      background: none;
      border-radius: 8px;
    }

    button.more:hover {
      background: var(--chip);
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
  declare showAll: boolean;

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    void loadSettings().then(settings => {
      applyAppearance(settings.appearance);
      return useLanguage(settings.language);
    });
    this.step = 'loading';
    this.rivals = [];
    this.selected = new Set();
    this.busy = false;
    this.denied = false;
    this.showAll = false;
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
    const likely = this.rivals.filter(r => r.likelyNewTab);
    const others = this.rivals.filter(r => !r.likelyNewTab);
    const shown = this.showAll ? [...likely, ...others] : likely;
    return html`
      <h1>
        ${t(likely.length ? 'takeover.chooseTitle' : 'takeover.noneTitle')}
      </h1>
      <p>${t(likely.length ? 'takeover.chooseBody' : 'takeover.noneBody')}</p>
      ${
        shown.length
          ? html`<ul>
              ${shown.map(rival => this.renderRival(rival))}
            </ul>`
          : nothing
      }
      ${
        others.length
          ? html`<button
              class="more"
              aria-expanded=${this.showAll}
              @click=${this.toggleShowAll}
            >
              ${t(this.showAll ? 'takeover.showNewTabs' : 'takeover.showAll')}
            </button>`
          : nothing
      }
      <button
        ?disabled=${this.busy || !this.selected.size}
        @click=${this.takeOver}
      >
        ${t('takeover.switchOff')}
      </button>
    `;
  }

  private renderRival(rival: Rival) {
    return html`
      <li>
        <label>
          <input
            type="checkbox"
            .checked=${this.selected.has(rival.id)}
            @change=${() => this.toggle(rival.id)}
          />
          ${rival.iconUrl ? html`<img src=${rival.iconUrl} alt="" />` : nothing}
          <span class="name">${rival.name}</span>
          ${
            rival.likelyNewTab
              ? html`<span class="tag">${t('takeover.newTabTag')}</span>`
              : nothing
          }
        </label>
      </li>
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

  /** Hiding the others also unticks them, so nothing hidden is switched off. */
  private toggleShowAll = () => {
    this.showAll = !this.showAll;
    if (!this.showAll) {
      this.selected = new Set(
        [...this.selected].filter(
          id => this.rivals.find(r => r.id === id)?.likelyNewTab,
        ),
      );
    }
  };

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
