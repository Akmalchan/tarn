/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {browser} from 'wxt/browser';
import '../backdrop/tarn-backdrop';
import './tarn-settings-button';
import {SCENES} from '../backdrop/scenes';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
} from '../settings/schema';
import {loadSettings, saveSettings, watchSettings} from '../settings/store';
import {refreshFavicon, rememberedScene} from './first-paint';
import {handOffToBrowserNewTab} from './handoff';
import {mirrorSettings} from './mirror';

const IDLE_HIDE_MS = 2500;

/** Root of the new tab page. */
export class TarnApp extends LitElement {
  static override properties = {
    settings: {state: true},
    controlsVisible: {state: true},
    revealed: {state: true},
  };

  static override styles = css`
    :host {
      display: block;
      height: 100%;
    }

    /* Controls arrive after the scene, never before it: nothing but the
       background ever draws first. On reload they are simply there. */
    .controls {
      animation: controls-in 500ms ease-out both;
    }

    .controls[data-in-place] {
      animation: none;
    }

    @keyframes controls-in {
      from {
        opacity: 0;
      }
    }

    .scenes {
      position: fixed;
      left: 50%;
      bottom: 28px;
      display: flex;
      gap: 2px;
      padding: 4px;
      border-radius: 999px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(24px) saturate(1.4);
      -webkit-backdrop-filter: blur(24px) saturate(1.4);
      transform: translate(-50%, 8px);
      opacity: 0;
      transition:
        opacity 300ms ease,
        transform 300ms ease;
    }

    .scenes[data-visible],
    .scenes:hover,
    .scenes:focus-within {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    button {
      font: inherit;
      font-size: 13px;
      letter-spacing: 0.01em;
      color: var(--text-dim);
      background: transparent;
      border: 0;
      border-radius: 999px;
      padding: 6px 14px;
      cursor: pointer;
      transition:
        color 200ms ease,
        background-color 200ms ease;
    }

    button:hover {
      color: var(--text);
    }

    button[aria-pressed='true'] {
      color: var(--text);
      background: var(--glass-active);
    }

    button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 1px;
    }
  `;

  declare settings: Settings;
  declare controlsVisible: boolean;
  declare revealed: {inPlace: boolean} | null;

  private idleTimer = 0;
  private schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  private unwatch: () => void = () => {};

  constructor() {
    super();
    // Start on the remembered scene; synced storage confirms it a moment
    // later, so opening a tab never flashes the default scene first.
    this.settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      scene: rememberedScene(),
    });
    this.controlsVisible = false;
    this.revealed = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void loadSettings().then(settings => {
      this.applySettings(settings);
      // The first-paint mirror can be stale (e.g. switched off on another
      // device). Only this initial check hands off; an open tab is never
      // yanked away when the setting changes later.
      if (!settings.enabled) void handOffToBrowserNewTab();
    });
    this.unwatch = watchSettings(this.applySettings);
    window.addEventListener('pointermove', this.onActivity, {passive: true});
    window.addEventListener('keydown', this.onKeyDown);
    this.schemeQuery.addEventListener('change', this.onSchemeChange);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    window.removeEventListener('pointermove', this.onActivity);
    window.removeEventListener('keydown', this.onKeyDown);
    this.schemeQuery.removeEventListener('change', this.onSchemeChange);
    clearTimeout(this.idleTimer);
  }

  override render() {
    const current = this.settings.scene;
    return html`
      <tarn-backdrop
        remember
        .scene=${current}
        @tarn-revealed=${this.onRevealed}
      ></tarn-backdrop>
      ${
        this.revealed
          ? html`<div class="controls" ?data-in-place=${this.revealed.inPlace}>
              <nav
                class="scenes"
                aria-label="Background"
                ?data-visible=${this.controlsVisible}
              >
                ${SCENES.map(
                  (scene, i) => html`
                    <button
                      aria-pressed=${scene.id === current}
                      title="${scene.name} (${i + 1})"
                      @click=${() => this.selectScene(scene.id)}
                    >
                      ${scene.name}
                    </button>
                  `,
                )}
              </nav>
              <tarn-settings-button></tarn-settings-button>
            </div>`
          : nothing
      }
    `;
  }

  /** The tab icon's tint depends on light or dark mode. */
  private onSchemeChange = () => {
    void refreshFavicon(this.settings.tabIcon);
  };

  private onRevealed = (event: CustomEvent<{inPlace: boolean}>) => {
    if (!this.revealed) keepTarnWarm();
    this.revealed = event.detail;
  };

  private applySettings = (settings: Settings) => {
    this.settings = settings;
    mirrorSettings(settings);
    void refreshFavicon(settings.tabIcon);
  };

  private selectScene(id: string): void {
    this.applySettings({...this.settings, scene: id});
    void saveSettings({scene: id});
  }

  private onActivity = () => {
    this.controlsVisible = true;
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(
      () => (this.controlsVisible = false),
      IDLE_HIDE_MS,
    );
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      isTyping(event.target)
    )
      return;
    const scene = SCENES[Number(event.key) - 1];
    if (scene) {
      this.selectScene(scene.id);
      this.onActivity();
    }
  };
}

/**
 * Wakes the service worker so it can bring back the offscreen document that
 * keeps Tarn's process warm, in case Chrome closed it (background.ts).
 * Sent after the page is on screen, never in the way of first paint.
 */
function keepTarnWarm(): void {
  if (import.meta.env.FIREFOX) return;
  void browser.runtime.sendMessage({type: 'tarn:warm'}).catch(() => {});
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

customElements.define('tarn-app', TarnApp);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-app': TarnApp;
  }
}
