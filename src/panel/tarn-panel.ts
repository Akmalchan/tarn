/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {mirrorSettings} from '../app/mirror';
import {canHandOff} from '../app/handoff';
import {answerPanelPresence} from '../app/side-panel';
import {SCENES, sceneStill} from '../backdrop/scenes';
import {setTarnEnabled} from '../settings/enabled';
import {
  DEFAULT_SETTINGS,
  TAB_ICONS,
  type Settings,
  type TabIcon,
} from '../settings/schema';
import {loadSettings, saveSettings, watchSettings} from '../settings/store';
import '../ui/tarn-switch';

/**
 * Settings, docked in the browser's side panel next to the new tab. Every
 * change is saved immediately; open new tabs pick it up live through
 * storage change events.
 */
export class TarnPanel extends LitElement {
  static override properties = {
    settings: {state: true},
  };

  static override styles = css`
    :host {
      display: block;
      min-height: 100vh;
      padding: 18px 16px 28px;
      background: linear-gradient(180deg, #0b1b2c 0%, #05080f 60%);
      overflow-y: auto;
    }

    header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 22px;
    }

    header img {
      width: 28px;
      height: 28px;
    }

    h1 {
      flex: 1;
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .close {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      padding: 0;
      font-size: 18px;
      line-height: 1;
      color: var(--text-dim);
      background: transparent;
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .close:hover {
      color: var(--text);
      background: var(--glass-active);
    }

    h2 {
      margin: 0 0 10px 2px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    section + section {
      margin-top: 26px;
    }

    .scenes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px;
    }

    .scene {
      display: block;
      padding: 0;
      font: inherit;
      text-align: left;
      color: var(--text);
      background: transparent;
      border: 0;
      cursor: pointer;
    }

    .preview {
      aspect-ratio: 16 / 10;
      border-radius: 14px;
      border: 1px solid var(--glass-border);
      transition:
        transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 200ms ease;
    }

    .scene:hover .preview {
      transform: translateY(-2px);
    }

    .scene[aria-pressed='true'] .preview {
      box-shadow:
        0 0 0 2px #05080f,
        0 0 0 4px #a9cfe0;
    }

    .scene span {
      display: block;
      margin: 8px 2px 0;
      font-size: 13px;
    }

    .scene:focus-visible {
      outline: none;
    }

    .scene:focus-visible .preview {
      box-shadow:
        0 0 0 2px #05080f,
        0 0 0 4px var(--focus-ring);
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgb(255 255 255 / 0.05);
      border: 1px solid var(--glass-border);
    }

    .label {
      font-size: 14px;
      font-weight: 500;
    }

    .hint {
      margin-top: 2px;
      font-size: 12px;
      color: var(--text-dim);
    }

    .row + .row {
      margin-top: 8px;
    }

    .segmented {
      display: flex;
      flex: none;
      padding: 2px;
      border-radius: 999px;
      background: rgb(255 255 255 / 0.08);
    }

    .segmented button {
      padding: 5px 11px;
      font: inherit;
      font-size: 12px;
      color: var(--text-dim);
      background: transparent;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition:
        color 150ms ease,
        background-color 150ms ease;
    }

    .segmented button[aria-checked='true'] {
      color: var(--text);
      background: rgb(255 255 255 / 0.16);
    }

    .segmented button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 1px;
    }

    footer {
      margin-top: 30px;
      font-size: 12px;
      color: var(--text-dim);
      text-align: center;
    }
  `;

  declare settings: Settings;
  private unwatch: () => void = () => {};

  constructor() {
    super();
    this.settings = DEFAULT_SETTINGS;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    answerPanelPresence();
    void loadSettings().then(s => (this.settings = s));
    this.unwatch = watchSettings(s => (this.settings = s));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
  }

  override render() {
    const {scene: current, enabled} = this.settings;
    return html`
      <header>
        <img src="/icon/48.png" alt="" />
        <h1>Tarn</h1>
        <button
          class="close"
          aria-label="Close settings"
          @click=${() => window.close()}
        >
          ×
        </button>
      </header>

      <section aria-labelledby="bg">
        <h2 id="bg">Background</h2>
        <div class="scenes">
          ${SCENES.map(
            scene => html`
              <button
                class="scene"
                aria-pressed=${scene.id === current}
                @click=${() => this.selectScene(scene.id)}
              >
                <div
                  class="preview"
                  style="background: ${sceneStill(scene)}"
                ></div>
                <span>${scene.name}</span>
              </button>
            `,
          )}
        </div>
      </section>

      <section aria-labelledby="general">
        <h2 id="general">General</h2>
        <div class="row">
          <div>
            <div class="label">Tarn new tab</div>
            <div class="hint">
              ${enabled ? 'New tabs open Tarn.' : 'New tabs open the default page.'}
            </div>
          </div>
          <tarn-switch
            label="Tarn new tab"
            .checked=${enabled}
            ?disabled=${!canHandOff}
            @change=${this.onEnabledChange}
          ></tarn-switch>
        </div>
        ${import.meta.env.FIREFOX ? nothing : this.renderTabIcon()}
      </section>

      <footer>Widgets, search and more are on the way.</footer>
    `;
  }

  private renderTabIcon() {
    const {tabIcon} = this.settings;
    return html`
      <div class="row">
        <div>
          <div class="label" id="tab-icon">Tab icon</div>
          <div class="hint">
            ${
              tabIcon === 'none'
                ? 'No icon. The tab never changes, even for a split second.'
                : 'Chrome’s own new-tab icon.'
            }
          </div>
        </div>
        <div class="segmented" role="radiogroup" aria-labelledby="tab-icon">
          ${TAB_ICONS.map(
            icon => html`
              <button
                role="radio"
                aria-checked=${icon === tabIcon}
                @click=${() => this.setTabIcon(icon)}
              >
                ${icon === 'chrome' ? 'Chrome' : 'None'}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  private async setTabIcon(tabIcon: TabIcon): Promise<void> {
    this.settings = {...this.settings, tabIcon};
    mirrorSettings(this.settings);
    this.settings = await saveSettings({tabIcon});
  }

  private selectScene(id: string): void {
    this.settings = {...this.settings, scene: id};
    // Mirror for first paint too, so the next new tab opens on it directly.
    mirrorSettings(this.settings);
    void saveSettings({scene: id});
  }

  private onEnabledChange = async (event: CustomEvent<boolean>) => {
    this.settings = await setTarnEnabled(event.detail);
  };
}

customElements.define('tarn-panel', TarnPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-panel': TarnPanel;
  }
}
