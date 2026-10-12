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
import {WIDGET_SIZES, type WidgetSize} from '../layout/bands';
import {
  CLOCK_STYLES,
  DEFAULT_SETTINGS,
  MAX_WIDGETS,
  TAB_ICONS,
  WIDGET_KINDS,
  newWidgetId,
  type ClockStyle,
  type Settings,
  type TabIcon,
  type WidgetEntry,
  type WidgetKind,
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
    samples: {state: true},
  };

  static override styles = css`
    /* The page itself never scrolls (global.css); the panel scrolls here. */
    :host {
      display: block;
      height: 100%;
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

    .widgets {
      display: grid;
      gap: 8px;
    }

    .widget {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px 10px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgb(255 255 255 / 0.05);
      border: 1px solid var(--glass-border);
    }

    .widget .tools {
      display: flex;
      gap: 2px;
    }

    .icon-button {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      font: inherit;
      font-size: 14px;
      color: var(--text-dim);
      background: transparent;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }

    .icon-button:hover:not(:disabled) {
      color: var(--text);
      background: var(--glass-active);
    }

    .icon-button:disabled {
      opacity: 0.3;
      cursor: default;
    }

    .icon-button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 1px;
    }

    .widget .segmented {
      grid-column: 1 / -1;
      justify-self: start;
    }

    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .add button {
      padding: 7px 12px;
      font: inherit;
      font-size: 13px;
      color: var(--text);
      background: rgb(255 255 255 / 0.08);
      border: 1px solid var(--glass-border);
      border-radius: 999px;
      cursor: pointer;
    }

    .add button:hover:not(:disabled) {
      background: rgb(255 255 255 / 0.14);
    }

    .add button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 1px;
    }

    .empty {
      padding: 12px 14px;
      font-size: 13px;
      color: var(--text-dim);
      border-radius: 14px;
      border: 1px dashed var(--glass-border);
    }

    footer {
      margin-top: 30px;
      font-size: 12px;
      color: var(--text-dim);
      text-align: center;
    }
  `;

  declare settings: Settings;
  /** Test layouts, loaded only in dev builds (release builds drop the code). */
  declare samples: typeof import('../widgets/samples') | null;
  private unwatch: () => void = () => {};

  constructor() {
    super();
    this.settings = DEFAULT_SETTINGS;
    this.samples = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    answerPanelPresence();
    if (import.meta.env.DEV) {
      void import('../widgets/samples').then(m => (this.samples = m));
    }
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

      ${this.renderHome()}
      ${
        this.samples
          ? this.samples.testLayouts(widgets => this.applyPatch({widgets}))
          : nothing
      }

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

      <footer>Search and more widgets are on the way.</footer>
    `;
  }

  private renderHome() {
    const {clock, widgets} = this.settings;
    return html`
      <section aria-labelledby="home">
        <h2 id="home">Home</h2>
        <div class="row">
          <div class="label" id="clock-label">Clock</div>
          <div
            class="segmented"
            role="radiogroup"
            aria-labelledby="clock-label"
          >
            ${CLOCK_STYLES.map(
              style => html`
                <button
                  role="radio"
                  aria-checked=${style === clock}
                  @click=${() => this.setClock(style)}
                >
                  ${style === 'center' ? 'Show' : 'Hide'}
                </button>
              `,
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="widgets">
        <h2 id="widgets">Widgets</h2>
        <div class="widgets">
          ${
            widgets.length
              ? widgets.map((widget, i) => this.renderWidget(widget, i))
              : html`<div class="empty">
                  No widgets. The page stays calm: just the background and the
                  clock.
                </div>`
          }
        </div>
        <div class="add">
          ${WIDGET_KINDS.map(
            kind => html`
              <button
                ?disabled=${widgets.length >= MAX_WIDGETS}
                @click=${() => this.addWidget(kind)}
              >
                + ${KIND_NAMES[kind]}
              </button>
            `,
          )}
        </div>
      </section>
    `;
  }

  private renderWidget(widget: WidgetEntry, index: number) {
    const count = this.settings.widgets.length;
    const name = KIND_NAMES[widget.kind];
    return html`
      <div class="widget">
        <div class="label">${name}</div>
        <div class="tools">
          <button
            class="icon-button"
            aria-label="Move ${name} earlier"
            ?disabled=${index === 0}
            @click=${() => this.moveWidget(index, -1)}
          >
            ↑
          </button>
          <button
            class="icon-button"
            aria-label="Move ${name} later"
            ?disabled=${index === count - 1}
            @click=${() => this.moveWidget(index, 1)}
          >
            ↓
          </button>
          <button
            class="icon-button"
            aria-label="Remove ${name}"
            @click=${() => this.removeWidget(index)}
          >
            ×
          </button>
        </div>
        <div class="segmented" role="radiogroup" aria-label="${name} size">
          ${WIDGET_SIZES.map(
            size => html`
              <button
                role="radio"
                aria-checked=${size === widget.size}
                @click=${() => this.resizeWidget(index, size)}
              >
                ${SIZE_NAMES[size]}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  private setClock(clock: ClockStyle): void {
    this.applyPatch({clock});
  }

  private addWidget(kind: WidgetKind): void {
    const widget: WidgetEntry = {
      id: newWidgetId(kind),
      kind,
      size: DEFAULT_SIZE[kind],
    };
    this.applyPatch({widgets: [...this.settings.widgets, widget]});
  }

  private removeWidget(index: number): void {
    this.applyPatch({
      widgets: this.settings.widgets.filter((_, i) => i !== index),
    });
  }

  private moveWidget(index: number, by: -1 | 1): void {
    const widgets = [...this.settings.widgets];
    const [moved] = widgets.splice(index, 1);
    if (!moved) return;
    widgets.splice(index + by, 0, moved);
    this.applyPatch({widgets});
  }

  private resizeWidget(index: number, size: WidgetSize): void {
    this.applyPatch({
      widgets: this.settings.widgets.map((w, i) =>
        i === index ? {...w, size} : w,
      ),
    });
  }

  /** Shows the change at once, then saves it; open tabs follow live. */
  private applyPatch(patch: Partial<Settings>): void {
    this.settings = {...this.settings, ...patch};
    void saveSettings(patch);
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

const KIND_NAMES: Record<WidgetKind, string> = {
  favorites: 'Favorites',
  notes: 'Notes',
  focus: 'Focus timer',
};

const SIZE_NAMES: Record<WidgetSize, string> = {
  s: 'Small',
  m: 'Medium',
  l: 'Large',
  xl: 'Extra large',
};

const DEFAULT_SIZE: Record<WidgetKind, WidgetSize> = {
  favorites: 'l',
  notes: 'm',
  focus: 's',
};

customElements.define('tarn-panel', TarnPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-panel': TarnPanel;
  }
}
