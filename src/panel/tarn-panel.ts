/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {keyed} from 'lit/directives/keyed.js';
import {browser} from 'wxt/browser';
import {mirrorSettings} from '../app/mirror';
import {canHandOff} from '../app/handoff';
import {answerPanelPresence} from '../app/side-panel';
import {SCENES, sceneById, sceneStill, sceneTone} from '../backdrop/scenes';
import type {Scene} from '../backdrop/scenes/types';
import {setTarnEnabled} from '../settings/enabled';
import {WIDGET_SIZES, type WidgetSize} from '../layout/bands';
import {
  CLOCK_STYLES,
  DEFAULT_SETTINGS,
  MAX_WIDGETS,
  TAB_ICONS,
  WIDGET_KINDS,
  newWidgetId,
  normalizeSettings,
  type ClockStyle,
  type Settings,
  type TabIcon,
  type WidgetEntry,
  type WidgetKind,
} from '../settings/schema';
import {loadSettings, saveSettings, watchSettings} from '../settings/store';
import {GLYPHS, type GlyphName} from '../ui/glyphs';

/**
 * The pages of the panel. Home shows what most people change; each section
 * ends in a row that opens more, and Advanced sits last. See
 * docs/design/settings-panel.md.
 */
type Page = 'home' | 'backgrounds' | 'widgets' | 'advanced';

/** Scenes on the first screen; with more, an "All backgrounds" row appears. */
const HOME_SCENES = 4;

/**
 * Settings, docked in the browser's side panel next to the new tab. Every
 * change is saved immediately; open new tabs pick it up live through
 * storage change events.
 */
export class TarnPanel extends LitElement {
  static override properties = {
    settings: {state: true},
    samples: {state: true},
    page: {state: true},
    query: {state: true},
    toast: {state: true},
    jsonDraft: {state: true},
    jsonStatus: {state: true},
    confirmReset: {state: true},
  };

  static override styles = css`
    /* Light first, with a dark twin. Black and white; system greys. */
    :host {
      --bg: #f2f2f7;
      --group: #ffffff;
      --ink: #000000;
      --muted: rgb(60 60 67 / 0.6);
      --hair: rgb(60 60 67 / 0.2);
      --field: rgb(118 118 128 / 0.12);
      --tile: #000000;
      --tile-ink: #ffffff;
      --seg-on: #ffffff;
      --press: rgb(0 0 0 / 0.06);
      --track: rgb(120 120 128 / 0.22);
      --on: #000000;
      --knob-on: #ffffff;
      display: block;
      height: 100%;
      overflow-y: auto;
      color: var(--ink);
      background: var(--bg);
      font:
        400 15px/1.35 var(--font-sans),
        system-ui,
        sans-serif;
      -webkit-font-smoothing: antialiased;
      color-scheme: light;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #000000;
        --group: #1c1c1e;
        --ink: #ffffff;
        --muted: rgb(235 235 245 / 0.6);
        --hair: rgb(84 84 88 / 0.65);
        --field: rgb(118 118 128 / 0.24);
        --tile: #ffffff;
        --tile-ink: #000000;
        --seg-on: #636366;
        --press: rgb(255 255 255 / 0.08);
        --track: rgb(120 120 128 / 0.32);
        --on: #ffffff;
        --knob-on: #000000;
        color-scheme: dark;
      }
    }

    .page {
      display: grid;
      gap: 22px;
      align-content: start;
      padding: 16px 16px 40px;
    }

    .page.forward {
      animation: forward 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .page.backward {
      animation: backward 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    @keyframes forward {
      from {
        transform: translateX(24px);
        opacity: 0.3;
      }
    }

    @keyframes backward {
      from {
        transform: translateX(-24px);
        opacity: 0.3;
      }
    }

    .top {
      display: grid;
      gap: 12px;
    }

    .back {
      display: flex;
      align-items: center;
      justify-self: start;
      padding: 2px 6px 2px 0;
      font: inherit;
      color: var(--ink);
      background: none;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }

    .back svg {
      width: 22px;
      height: 22px;
      margin-left: -6px;
      fill: currentColor;
    }

    /* Sub-page titles only. Home has none: Chrome's side panel header
       already says "Settings" (the manifest's short_name). */
    h1 {
      margin: -2px 0 0;
      font-size: 21px;
      font-weight: 650;
      letter-spacing: -0.01em;
    }

    .search {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 10px;
      color: var(--muted);
      background: var(--field);
      border-radius: 10px;
    }

    .search svg {
      flex: none;
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .search input {
      flex: 1;
      min-width: 0;
      font: inherit;
      color: var(--ink);
      background: none;
      border: 0;
      outline: none;
    }

    .search input::-webkit-search-cancel-button {
      display: none;
    }

    kbd {
      padding: 0 5px;
      font:
        500 11px ui-monospace,
        monospace;
      color: var(--muted);
      border: 1px solid var(--hair);
      border-radius: 5px;
    }

    section {
      display: grid;
      gap: 7px;
    }

    h2 {
      margin: 0 0 0 16px;
      font-size: 13px;
      font-weight: 400;
      color: var(--muted);
    }

    .group {
      overflow: hidden;
      background: var(--group);
      border-radius: 12px;
    }

    .row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      width: 100%;
      min-height: 46px;
      padding: 8px 14px 8px 12px;
      font: inherit;
      color: inherit;
      text-align: left;
      background: none;
      border: 0;
    }

    .row + .row::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      left: 52px;
      border-top: 0.5px solid var(--hair);
    }

    button.row {
      cursor: pointer;
    }

    button.row:hover:not(:disabled) {
      background: var(--press);
    }

    button.row:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .row[data-flash] {
      animation: flash 1.4s ease;
    }

    @keyframes flash {
      0%,
      45% {
        background: var(--field);
      }
    }

    .ico {
      display: grid;
      flex: none;
      place-items: center;
      width: 28px;
      height: 28px;
      overflow: hidden;
      color: var(--tile-ink);
      background: var(--tile);
      border-radius: 7px;
    }

    .ico svg {
      width: 17px;
      height: 17px;
      fill: currentColor;
    }

    .ico img {
      display: block;
      width: 28px;
      height: 28px;
    }

    .txt {
      display: grid;
      flex: 1;
      gap: 1px;
      min-width: 0;
    }

    .sub {
      font-size: 12.5px;
      color: var(--muted);
    }

    .chev {
      flex: none;
      width: 16px;
      height: 16px;
      fill: var(--muted);
    }

    .value {
      font-size: 14px;
      color: var(--muted);
    }

    .sw {
      position: relative;
      flex: none;
      width: 51px;
      height: 31px;
      padding: 0;
      background: var(--track);
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition: background-color 200ms ease;
    }

    .sw::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 27px;
      height: 27px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow:
        0 3px 8px rgb(0 0 0 / 0.15),
        0 1px 1px rgb(0 0 0 / 0.16);
      transition: transform 250ms cubic-bezier(0.3, 1.3, 0.6, 1);
    }

    .sw[aria-checked='true'] {
      background: var(--on);
    }

    .sw[aria-checked='true']::after {
      background: var(--knob-on);
      transform: translateX(20px);
    }

    .sw:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .seg {
      display: inline-flex;
      flex: none;
      justify-self: start;
      padding: 2px;
      background: var(--field);
      border-radius: 9px;
    }

    .seg button {
      padding: 4px 10px;
      font: 500 12.5px var(--font-sans);
      color: var(--ink);
      background: none;
      border: 0;
      border-radius: 7px;
      cursor: pointer;
    }

    .seg button[aria-checked='true'] {
      background: var(--seg-on);
      box-shadow:
        0 3px 8px rgb(0 0 0 / 0.12),
        0 1px 1px rgb(0 0 0 / 0.06);
    }

    .scenes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 12px;
    }

    .faces {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .pick {
      display: grid;
      gap: 7px;
      padding: 0;
      font: 500 13px var(--font-sans);
      color: inherit;
      text-align: center;
      background: none;
      border: 0;
      cursor: pointer;
    }

    .thumb {
      display: grid;
      place-items: center;
      align-content: center;
      aspect-ratio: 16 / 10;
      border-radius: 12px;
      box-shadow: inset 0 0 0 0.5px var(--hair);
      transition: box-shadow 150ms ease;
    }

    .faces .thumb {
      aspect-ratio: 4 / 5;
      gap: 2px;
    }

    .pick[aria-checked='true'] .thumb {
      box-shadow:
        0 0 0 2.5px var(--bg),
        0 0 0 4.5px var(--ink);
    }

    .thumb.dark {
      color: #f4f7fb;
    }

    .thumb.light {
      color: #000000;
    }

    .thumb .t {
      font-size: 21px;
      font-weight: 200;
      line-height: 1;
      letter-spacing: -0.04em;
      font-variant-numeric: tabular-nums;
    }

    .thumb .t.bold {
      font-weight: 650;
      letter-spacing: -0.05em;
    }

    .thumb .d {
      font-size: 7.5px;
      opacity: 0.75;
    }

    .thumb .off {
      font-size: 12px;
      opacity: 0.75;
    }

    .wrow {
      align-items: flex-start;
    }

    .wrow .seg {
      margin-top: 6px;
    }

    .tools {
      display: flex;
      gap: 2px;
    }

    .ib {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      color: var(--muted);
      background: none;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }

    .ib svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .ib:hover:not(:disabled) {
      color: var(--ink);
      background: var(--press);
    }

    .ib:disabled {
      opacity: 0.3;
      cursor: default;
    }

    .addmark {
      flex: none;
      width: 22px;
      height: 22px;
      fill: var(--ink);
    }

    .keys {
      display: flex;
      gap: 4px;
      align-items: center;
      color: var(--muted);
    }

    .note,
    .none {
      margin: 0 16px;
      font-size: 12.5px;
      color: var(--muted);
    }

    textarea {
      display: block;
      box-sizing: border-box;
      width: 100%;
      min-height: 220px;
      padding: 12px 14px;
      font:
        12px/1.5 ui-monospace,
        'SF Mono',
        Menlo,
        monospace;
      color: var(--ink);
      background: none;
      border: 0;
      resize: vertical;
      outline: none;
    }

    .actions {
      border-top: 0.5px solid var(--hair);
    }

    .status {
      flex: 1;
      font-size: 12.5px;
      color: var(--muted);
    }

    .text-button {
      padding: 4px 2px;
      font: 600 15px var(--font-sans);
      color: var(--ink);
      background: none;
      border: 0;
      cursor: pointer;
    }

    .text-button:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .toast {
      position: fixed;
      right: 16px;
      bottom: 16px;
      left: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      font-size: 14px;
      color: var(--bg);
      background: var(--ink);
      border-radius: 14px;
      box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.45);
    }

    .toast button {
      font: 600 14px var(--font-sans);
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }

    /* Dev-only test layouts (widgets/samples.ts). */
    .devtools section h2 {
      margin: 0 0 0 16px;
    }

    .devtools .add {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .devtools .add button {
      padding: 6px 10px;
      font: 500 12.5px var(--font-sans);
      color: var(--ink);
      background: var(--group);
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }

    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .page.forward,
      .page.backward,
      .row[data-flash] {
        animation: none;
      }
      .sw,
      .sw::after {
        transition: none;
      }
    }
  `;

  declare settings: Settings;
  /** Test layouts, loaded only in dev builds (release builds drop the code). */
  declare samples: typeof import('../widgets/samples') | null;
  declare page: Page;
  declare query: string;
  declare toast: {text: string; undo?: () => void} | null;
  /** The settings.json being edited, or null to show the live settings. */
  declare jsonDraft: string | null;
  declare jsonStatus: string;
  declare confirmReset: boolean;

  private unwatch: () => void = () => {};
  private direction: 'forward' | 'backward' | '' = '';
  /** A row to scroll to and highlight after the next render. */
  private flashTarget = '';
  private toastTimer = 0;
  private resetTimer = 0;
  private readonly version = browser.runtime.getManifest().version;

  constructor() {
    super();
    this.settings = DEFAULT_SETTINGS;
    this.samples = null;
    this.page = 'home';
    this.query = '';
    this.toast = null;
    this.jsonDraft = null;
    this.jsonStatus = '';
    this.confirmReset = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    answerPanelPresence();
    if (import.meta.env.DEV) {
      void import('../widgets/samples').then(m => (this.samples = m));
    }
    void loadSettings().then(s => (this.settings = s));
    this.unwatch = watchSettings(s => (this.settings = s));
    window.addEventListener('keydown', this.onKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    window.removeEventListener('keydown', this.onKeyDown);
    clearTimeout(this.toastTimer);
    clearTimeout(this.resetTimer);
  }

  override updated(): void {
    if (!this.flashTarget) return;
    const row = this.renderRoot.querySelector<HTMLElement>(
      `[data-target='${this.flashTarget}']`,
    );
    this.flashTarget = '';
    if (!row) return;
    row.scrollIntoView({block: 'center'});
    row.setAttribute('data-flash', '');
    setTimeout(() => row.removeAttribute('data-flash'), 1400);
  }

  override render() {
    const body = this.query.trim()
      ? this.renderResults()
      : {
          home: () => this.renderHome(),
          backgrounds: () => this.renderBackgrounds(),
          widgets: () => this.renderWidgets(),
          advanced: () => this.renderAdvanced(),
        }[this.page]();
    return html`
      ${keyed(
        this.page,
        html`<div class="page ${this.direction}">
          <div class="top">
            ${
              this.page === 'home'
                ? nothing
                : html`<button class="back" @click=${() => this.go('home')}>
                      ${glyph('back')}Settings
                    </button>
                    <h1>${PAGE_TITLES[this.page]}</h1>`
            }
            <label class="search">
              ${glyph('search')}
              <input
                type="search"
                placeholder="Search"
                aria-label="Search settings"
                .value=${this.query}
                @input=${this.onSearch}
                @keydown=${this.onSearchKey}
              />
              <kbd>/</kbd>
            </label>
          </div>
          ${body}
        </div>`,
      )}
      ${
        this.toast
          ? html`<div class="toast" role="status">
              <span>${this.toast.text}</span>
              ${
                this.toast.undo
                  ? html`<button @click=${this.onUndo}>Undo</button>`
                  : nothing
              }
            </div>`
          : nothing
      }
      <input
        id="import"
        type="file"
        accept="application/json,.json"
        hidden
        @change=${this.onImportFile}
      />
    `;
  }

  // Pages -------------------------------------------------------------------

  private renderHome() {
    const {widgets, enabled} = this.settings;
    const names = widgets.map(w => KIND_NAMES[w.kind]);
    return html`
      <section data-target="background">
        <h2>Background</h2>
        <div class="scenes">
          ${SCENES.slice(0, HOME_SCENES).map(scene => this.sceneButton(scene))}
        </div>
        ${
          SCENES.length > HOME_SCENES
            ? html`<div class="group">
                ${this.navRow(
                  'photo',
                  'All backgrounds',
                  `${SCENES.length} scenes`,
                  'backgrounds',
                )}
              </div>`
            : nothing
        }
      </section>

      <section data-target="clock">
        <h2>Clock</h2>
        <div class="faces" role="radiogroup" aria-label="Clock">
          ${CLOCK_STYLES.map(face => this.faceButton(face))}
        </div>
      </section>

      <div class="group">
        ${this.navRow(
          'widgets',
          'Widgets',
          names.length ? listNames(names) : 'None yet',
          'widgets',
          'widgets',
        )}
      </div>

      <section>
        <h2>Tarn</h2>
        <div class="group">
          <div class="row" data-target="enabled">
            <span class="ico"><img src="/icon/48.png" alt="" /></span>
            <span class="txt"
              >Use Tarn for new tabs
              <span class="sub"
                >${
                  enabled
                    ? 'New tabs open Tarn.'
                    : 'New tabs open the default page.'
                }</span
              ></span
            >
            <button
              class="sw"
              role="switch"
              aria-label="Use Tarn for new tabs"
              aria-checked=${enabled}
              ?disabled=${!canHandOff}
              @click=${this.toggleEnabled}
            ></button>
          </div>
        </div>
      </section>

      <div class="group">
        ${this.navRow(
          'sliders',
          'Advanced',
          'Tab icon, keyboard, backup, settings.json',
          'advanced',
        )}
      </div>
    `;
  }

  private renderBackgrounds() {
    return html`
      <section data-target="all-backgrounds">
        <div class="scenes">
          ${SCENES.map(scene => this.sceneButton(scene))}
        </div>
      </section>
    `;
  }

  private renderWidgets() {
    const {widgets} = this.settings;
    const full = widgets.length >= MAX_WIDGETS;
    return html`
      <section data-target="widgets">
        <h2>On your tab</h2>
        ${
          widgets.length
            ? html`<div class="group">
                ${widgets.map((widget, i) => this.widgetRow(widget, i))}
              </div>`
            : html`<p class="none">
                No widgets. The page stays calm: just the background and the
                clock.
              </p>`
        }
      </section>

      <section>
        <h2>Add a widget</h2>
        <div class="group">
          ${WIDGET_KINDS.map(
            kind => html`
              <button
                class="row"
                ?disabled=${full}
                @click=${() => this.addWidget(kind)}
              >
                ${icon(KIND_GLYPHS[kind])}
                <span class="txt"
                  >${KIND_NAMES[kind]}
                  <span class="sub">${KIND_NOTES[kind]}</span></span
                >
                <svg class="addmark" viewBox="0 0 24 24" aria-hidden="true">
                  ${GLYPHS.plus}
                </svg>
              </button>
            `,
          )}
        </div>
        ${
          full
            ? html`<p class="note">That's the most a page can hold.</p>`
            : nothing
        }
      </section>
    `;
  }

  private renderAdvanced() {
    const {tabIcon} = this.settings;
    return html`
      ${
        import.meta.env.FIREFOX
          ? nothing
          : html`<section>
              <h2>Tab</h2>
              <div class="group">
                <div class="row" data-target="tab-icon">
                  ${icon('tab')}
                  <span class="txt"
                    >Tab icon
                    <span class="sub"
                      >${
                        tabIcon === 'none'
                          ? 'No icon in the tab.'
                          : 'Chrome’s own new-tab icon.'
                      }</span
                    ></span
                  >
                  <div class="seg" role="radiogroup" aria-label="Tab icon">
                    ${TAB_ICONS.map(
                      value => html`
                        <button
                          role="radio"
                          aria-checked=${value === tabIcon}
                          @click=${() => this.setTabIcon(value)}
                        >
                          ${value === 'chrome' ? 'Chrome' : 'None'}
                        </button>
                      `,
                    )}
                  </div>
                </div>
              </div>
            </section>`
      }

      <section>
        <h2>Keyboard</h2>
        <div class="group">
          <div class="row" data-target="keys">
            ${icon('keyboard')}
            <span class="txt">Switch background</span>
            <span class="keys"><kbd>1</kbd>–<kbd>${SCENES.length}</kbd></span>
          </div>
          <div class="row">
            ${icon('search')}
            <span class="txt">Search settings</span>
            <span class="keys"><kbd>/</kbd></span>
          </div>
        </div>
      </section>

      <section>
        <h2>Backup</h2>
        <div class="group">
          <button
            class="row"
            data-target="backup"
            @click=${this.exportSettings}
          >
            ${icon('share')}
            <span class="txt"
              >Export settings <span class="sub">Saves a .json file</span></span
            >
          </button>
          <button class="row" @click=${this.pickImport}>
            ${icon('tray')}
            <span class="txt"
              >Import settings
              <span class="sub">From a file you exported</span></span
            >
          </button>
          <button class="row" data-target="reset" @click=${this.onReset}>
            ${icon('reset')}
            <span class="txt"
              >${this.confirmReset ? 'Click again to reset' : 'Reset to defaults'}
              <span class="sub"
                >Background, clock, widgets and tab icon</span
              ></span
            >
          </button>
        </div>
        <p class="note">Import and reset never turn Tarn on or off.</p>
      </section>

      <section>
        <h2>settings.json</h2>
        <div class="group" data-target="json">
          <textarea
            spellcheck="false"
            aria-label="settings.json"
            .value=${this.jsonDraft ?? JSON.stringify(this.settings, null, 2)}
            @input=${this.onJsonInput}
          ></textarea>
          <div class="row actions">
            <span class="status"
              >${this.jsonStatus || 'Edit, then apply. Invalid values fall back to defaults.'}</span
            >
            <button
              class="text-button"
              ?disabled=${this.jsonDraft === null}
              @click=${this.applyJson}
            >
              Apply
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2>About</h2>
        <div class="group">
          <div class="row" data-target="about">
            ${icon('info')}
            <span class="txt">Version</span>
            <span class="value">${this.version}</span>
          </div>
          <button class="row" @click=${this.copyDiagnostics}>
            ${icon('doc')}
            <span class="txt"
              >Copy diagnostics
              <span class="sub"
                >Version, browser and settings, for bug reports</span
              ></span
            >
          </button>
        </div>
      </section>

      ${
        this.samples
          ? html`<div class="devtools">
              ${this.samples.testLayouts(widgets => this.applyPatch({widgets}))}
            </div>`
          : nothing
      }
    `;
  }

  private renderResults() {
    const query = this.query.trim().toLowerCase();
    const hits = SEARCH_INDEX.filter(entry =>
      `${entry.label} ${entry.where} ${entry.words}`
        .toLowerCase()
        .includes(query),
    );
    if (!hits.length) {
      return html`<p class="none">
        No settings match “${this.query.trim()}”.
      </p>`;
    }
    return html`
      <section>
        <h2>Results</h2>
        <div class="group">
          ${hits.map(
            entry => html`
              <button
                class="row"
                @click=${() => this.go(entry.page, entry.target)}
              >
                ${icon(entry.glyph)}
                <span class="txt"
                  >${entry.label}<span class="sub">${entry.where}</span></span
                >
                ${chevron()}
              </button>
            `,
          )}
        </div>
      </section>
    `;
  }

  // Parts -------------------------------------------------------------------

  private sceneButton(scene: Scene) {
    return html`
      <button
        class="pick"
        role="radio"
        aria-checked=${scene.id === this.settings.scene}
        @click=${() => this.selectScene(scene.id)}
      >
        <span class="thumb" style="background: ${sceneStill(scene)}"></span>
        ${scene.name}
      </button>
    `;
  }

  /** A clock face, drawn on the current background so it previews truly. */
  private faceButton(face: ClockStyle) {
    const scene = sceneById(this.settings.scene);
    const now = new Date();
    const time = now
      .toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})
      .replace(/\s?[AP]M$/i, '');
    const date = now.toLocaleDateString([], {
      weekday: 'short',
      day: 'numeric',
    });
    return html`
      <button
        class="pick"
        role="radio"
        aria-checked=${face === this.settings.clock}
        @click=${() => this.applyPatch({clock: face})}
      >
        <span
          class="thumb ${sceneTone(scene)}"
          style="background: ${sceneStill(scene)}"
        >
          ${
            face === 'none'
              ? html`<span class="off">Off</span>`
              : html`<span class="t ${face}">${time}</span>
                  ${face === 'minimal' ? nothing : html`<span class="d">${date}</span>`}`
          }
        </span>
        ${FACE_NAMES[face]}
      </button>
    `;
  }

  private widgetRow(widget: WidgetEntry, index: number) {
    const name = KIND_NAMES[widget.kind];
    const last = this.settings.widgets.length - 1;
    return html`
      <div class="row wrow">
        ${icon(KIND_GLYPHS[widget.kind])}
        <span class="txt"
          >${name}
          <span class="seg" role="radiogroup" aria-label="${name} size">
            ${WIDGET_SIZES.map(
              size => html`
                <button
                  role="radio"
                  title=${SIZE_NAMES[size]}
                  aria-checked=${size === widget.size}
                  @click=${() => this.resizeWidget(index, size)}
                >
                  ${size.toUpperCase()}
                </button>
              `,
            )}
          </span></span
        >
        <span class="tools">
          <button
            class="ib"
            aria-label="Move ${name} up"
            ?disabled=${index === 0}
            @click=${() => this.moveWidget(index, -1)}
          >
            ${glyph('up')}
          </button>
          <button
            class="ib"
            aria-label="Move ${name} down"
            ?disabled=${index === last}
            @click=${() => this.moveWidget(index, 1)}
          >
            ${glyph('down')}
          </button>
          <button
            class="ib"
            aria-label="Remove ${name}"
            @click=${() => this.removeWidget(index)}
          >
            ${glyph('minus')}
          </button>
        </span>
      </div>
    `;
  }

  private navRow(
    glyphName: GlyphName,
    title: string,
    sub: string,
    page: Page,
    target = '',
  ) {
    return html`
      <button
        class="row"
        data-target=${target || nothing}
        @click=${() => this.go(page)}
      >
        ${icon(glyphName)}
        <span class="txt">${title}<span class="sub">${sub}</span></span>
        ${chevron()}
      </button>
    `;
  }

  // Navigation and search ---------------------------------------------------

  private go(page: Page, target = ''): void {
    this.direction = page === 'home' ? 'backward' : 'forward';
    if (page === this.page) this.direction = '';
    this.page = page;
    this.query = '';
    this.flashTarget = target;
    this.jsonDraft = null;
    this.jsonStatus = '';
    this.scrollTop = 0;
  }

  private onSearch = (event: Event) => {
    this.query = (event.target as HTMLInputElement).value;
  };

  private onSearchKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.query = '';
      (event.target as HTMLInputElement).blur();
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
    const active = this.shadowRoot?.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement
    )
      return;
    event.preventDefault();
    this.renderRoot
      .querySelector<HTMLInputElement>('input[type=search]')
      ?.focus();
  };

  // Changes -----------------------------------------------------------------

  private addWidget(kind: WidgetKind): void {
    const widget: WidgetEntry = {
      id: newWidgetId(kind),
      kind,
      size: DEFAULT_SIZE[kind],
    };
    this.applyPatch({widgets: [...this.settings.widgets, widget]});
    this.showToast(`${KIND_NAMES[kind]} added`);
  }

  private removeWidget(index: number): void {
    const removed = this.settings.widgets[index];
    if (!removed) return;
    this.applyPatch({
      widgets: this.settings.widgets.filter((_, i) => i !== index),
    });
    this.showToast(`${KIND_NAMES[removed.kind]} removed`, () => {
      const widgets = [...this.settings.widgets];
      widgets.splice(index, 0, removed);
      this.applyPatch({widgets});
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

  private toggleEnabled = async () => {
    this.settings = await setTarnEnabled(!this.settings.enabled);
  };

  /**
   * Replaces everything a backup holds. `enabled` is left alone: turning
   * Tarn on or off goes through setTarnEnabled, never through a file.
   */
  private replaceSettings(raw: unknown): void {
    const next = normalizeSettings(raw);
    const patch: Partial<Settings> = {
      scene: next.scene,
      tabIcon: next.tabIcon,
      clock: next.clock,
      widgets: next.widgets,
    };
    this.settings = {...this.settings, ...patch};
    mirrorSettings(this.settings);
    void saveSettings(patch);
  }

  // Advanced ----------------------------------------------------------------

  private exportSettings = () => {
    const blob = new Blob([JSON.stringify(this.settings, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tarn-settings.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.showToast('Settings exported');
  };

  private pickImport = () => {
    this.renderRoot.querySelector<HTMLInputElement>('#import')?.click();
  };

  private onImportFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.replaceSettings(JSON.parse(await file.text()));
      this.showToast('Settings imported');
    } catch {
      this.showToast('That file isn’t a Tarn settings file');
    }
  };

  private onReset = () => {
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.resetTimer = window.setTimeout(
        () => (this.confirmReset = false),
        4000,
      );
      return;
    }
    clearTimeout(this.resetTimer);
    this.confirmReset = false;
    const before = this.settings;
    this.replaceSettings(DEFAULT_SETTINGS);
    this.showToast('Reset to defaults', () => this.replaceSettings(before));
  };

  private onJsonInput = (event: Event) => {
    this.jsonDraft = (event.target as HTMLTextAreaElement).value;
    this.jsonStatus = '';
  };

  private applyJson = () => {
    if (this.jsonDraft === null) return;
    try {
      this.replaceSettings(JSON.parse(this.jsonDraft));
      this.jsonDraft = null;
      this.jsonStatus = 'Applied.';
    } catch (error) {
      this.jsonStatus = `Not valid JSON: ${(error as Error).message}`;
    }
  };

  private copyDiagnostics = async () => {
    const report = {
      tarn: this.version,
      browser: navigator.userAgent,
      settings: this.settings,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      this.showToast('Diagnostics copied');
    } catch {
      this.showToast('Couldn’t copy. Use settings.json instead.');
    }
  };

  private showToast(text: string, undo?: () => void): void {
    this.toast = {text, undo};
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), 4000);
  }

  private onUndo = () => {
    this.toast?.undo?.();
    this.toast = null;
  };
}

const glyph = (name: GlyphName) =>
  html`<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name]}</svg>`;

const icon = (name: GlyphName) => html`<span class="ico">${glyph(name)}</span>`;

const chevron = () =>
  html`<svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
    ${GLYPHS.chevron}
  </svg>`;

/** "Favorites, Notes, Focus timer +2" */
function listNames(names: string[]): string {
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
}

const PAGE_TITLES: Record<Page, string> = {
  home: 'Settings',
  backgrounds: 'Backgrounds',
  widgets: 'Widgets',
  advanced: 'Advanced',
};

const FACE_NAMES: Record<ClockStyle, string> = {
  center: 'Classic',
  bold: 'Bold',
  minimal: 'Minimal',
  none: 'None',
};

const KIND_NAMES: Record<WidgetKind, string> = {
  favorites: 'Favorites',
  notes: 'Notes',
  focus: 'Focus timer',
};

const KIND_NOTES: Record<WidgetKind, string> = {
  favorites: 'Your sites, one click away',
  notes: 'A note that stays on this computer',
  focus: 'One task and a timer',
};

const KIND_GLYPHS: Record<WidgetKind, GlyphName> = {
  favorites: 'star',
  notes: 'note',
  focus: 'timer',
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

interface SearchEntry {
  label: string;
  where: string;
  page: Page;
  target: string;
  glyph: GlyphName;
  words: string;
}

/** What search finds, and where each setting lives. */
const SEARCH_INDEX: readonly SearchEntry[] = [
  {
    label: 'Background',
    where: 'Settings',
    page: 'home',
    target: 'background',
    glyph: 'photo',
    words: `scene wallpaper ${SCENES.map(s => s.name).join(' ')}`,
  },
  {
    label: 'Clock',
    where: 'Settings',
    page: 'home',
    target: 'clock',
    glyph: 'clock',
    words: 'time date face classic bold minimal hide',
  },
  {
    label: 'Widgets',
    where: 'Settings',
    page: 'widgets',
    target: 'widgets',
    glyph: 'widgets',
    words: 'favorites notes focus timer add remove size',
  },
  {
    label: 'Use Tarn for new tabs',
    where: 'Settings',
    page: 'home',
    target: 'enabled',
    glyph: 'tab',
    words: 'on off enable disable turn',
  },
  ...(import.meta.env.FIREFOX
    ? []
    : [
        {
          label: 'Tab icon',
          where: 'Advanced',
          page: 'advanced' as const,
          target: 'tab-icon',
          glyph: 'tab' as const,
          words: 'favicon chrome none',
        },
      ]),
  {
    label: 'Keyboard shortcuts',
    where: 'Advanced',
    page: 'advanced',
    target: 'keys',
    glyph: 'keyboard',
    words: 'keys hotkeys',
  },
  {
    label: 'Export and import',
    where: 'Advanced',
    page: 'advanced',
    target: 'backup',
    glyph: 'share',
    words: 'backup file save restore',
  },
  {
    label: 'Reset to defaults',
    where: 'Advanced',
    page: 'advanced',
    target: 'reset',
    glyph: 'reset',
    words: 'reset defaults start over',
  },
  {
    label: 'settings.json',
    where: 'Advanced',
    page: 'advanced',
    target: 'json',
    glyph: 'doc',
    words: 'json raw edit developer',
  },
  {
    label: 'Version and diagnostics',
    where: 'Advanced',
    page: 'advanced',
    target: 'about',
    glyph: 'info',
    words: 'about version debug copy bug',
  },
];

customElements.define('tarn-panel', TarnPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-panel': TarnPanel;
  }
}
