/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {browser} from 'wxt/browser';
import '../backdrop/tarn-backdrop';
import type {TarnBackdrop} from '../backdrop/tarn-backdrop';
import './tarn-settings-button';
import '../widgets/tarn-board';
import '../widgets/tarn-clock';
import type {
  ReorderDetail,
  TarnBoard,
  TilesDetail,
} from '../widgets/tarn-board';
import {SCENES, sceneById, sceneTone} from '../backdrop/scenes';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
} from '../settings/schema';
import {loadSettings, saveSettings, watchSettings} from '../settings/store';
import {
  arrival,
  isRememberedOff,
  refreshFavicon,
  rememberedScene,
} from './first-paint';
import {canHandOff, handOffToBrowserNewTab} from './handoff';
import {watchSidePanel} from './side-panel';
import {mirrorSettings, rememberedHome} from './mirror';
import {rememberTiles} from './tile-memory';

const IDLE_HIDE_MS = 2500;

/** Root of the new tab page. */
export class TarnApp extends LitElement {
  static override properties = {
    settings: {state: true},
    controlsVisible: {state: true},
    revealed: {state: true},
    settled: {state: true},
    handingOff: {state: true},
    editing: {state: true},
  };

  static override styles = css`
    :host {
      display: block;
      height: 100%;

      /* Widget and clock colors on dark scenes. */
      --ink: rgb(244 247 251);
      --ink-dim: rgb(244 247 251 / 0.66);
      --ink-faint: rgb(244 247 251 / 0.4);
      --tile-line: rgb(255 255 255 / 0.14);
      --tile-fill: rgb(255 255 255 / 0.03);
      --tile-fill-solid: rgb(255 255 255 / 0.1);
      --tile-highlight: rgb(255 255 255 / 0.08);
      --chip: rgb(255 255 255 / 0.14);
      --chip-hover: rgb(255 255 255 / 0.22);
      --chip-strong: rgb(30 34 44 / 0.85);
      /* A widget being dragged: a nearly solid card. */
      --tile-held: rgb(20 25 34 / 0.86);
      /* Keeps white text readable over bright patches (Ember's orange). */
      --ink-shadow: 0 1px 3px rgb(0 0 0 / 0.28);
    }

    /* Light scenes (Bloom): dark text, brighter frost. */
    :host([tone='light']) {
      --ink: rgb(22 26 38);
      --ink-dim: rgb(22 26 38 / 0.64);
      --ink-faint: rgb(22 26 38 / 0.4);
      --tile-line: rgb(255 255 255 / 0.55);
      --tile-fill: rgb(255 255 255 / 0.06);
      --tile-fill-solid: rgb(255 255 255 / 0.45);
      --tile-highlight: rgb(255 255 255 / 0.5);
      --chip: rgb(255 255 255 / 0.45);
      --chip-hover: rgb(255 255 255 / 0.65);
      --chip-strong: rgb(255 255 255 / 0.9);
      --tile-held: rgb(246 246 251 / 0.88);
      --focus-ring: rgb(22 26 38 / 0.6);
      --ink-shadow: none;
    }

    /* The clock and widgets: one group a little above the middle. Free space
       splits 2 : 3 above and below; a crowded page scrolls instead. */
    .page {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0 24px;
      overflow-y: auto;
      scrollbar-width: none;
    }

    .page::before {
      content: '';
      flex: 2 1 40px;
    }

    .page::after {
      content: '';
      flex: 3 1 96px;
    }

    .group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 56px;
    }

    tarn-clock {
      animation: controls-in 200ms ease-out both;
    }

    .group[data-in-place] tarn-clock {
      animation: none;
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
  /**
   * Set when the scene appears: `inPlace` on a reload, `live` unless only
   * the still gradient could be shown (no WebGL).
   */
  declare revealed: {inPlace: boolean; live: boolean} | null;
  /** Set once the scene has settled; `live` is false for the still fallback. */
  declare settled: {live: boolean} | null;
  /** Tarn is switched off: render nothing while the browser's page loads. */
  declare handingOff: boolean;
  /** The settings panel is open: widgets can be rearranged by dragging. */
  declare editing: boolean;

  private idleTimer = 0;
  private schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  private unwatch: () => void = () => {};
  private unwatchPanel: () => void = () => {};

  constructor() {
    super();
    // Start on the remembered scene; synced storage confirms it a moment
    // later, so opening a tab never flashes the default scene first.
    this.settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...rememberedHome(),
      scene: rememberedScene(),
    });
    this.controlsVisible = false;
    this.revealed = null;
    this.settled = null;
    this.handingOff = canHandOff && isRememberedOff();
    this.editing = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.handingOff) {
      // Switched off: show nothing and swap in the browser's own page. If
      // that fails, show Tarn after all.
      void handOffToBrowserNewTab().then(ok => (this.handingOff = ok));
    }
    void loadSettings().then(settings => {
      this.applySettings(settings);
      // The first-paint mirror can be stale (e.g. switched off on another
      // device). Only this initial check hands off; an open tab is never
      // yanked away when the setting changes later.
      if (!settings.enabled) void handOffToBrowserNewTab();
    });
    this.unwatch = watchSettings(this.applySettings);
    this.unwatchPanel = watchSidePanel(open => (this.editing = open));
    window.addEventListener('pointermove', this.onActivity, {passive: true});
    window.addEventListener('keydown', this.onKeyDown);
    this.schemeQuery.addEventListener('change', this.onSchemeChange);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    this.unwatchPanel();
    window.removeEventListener('pointermove', this.onActivity);
    window.removeEventListener('keydown', this.onKeyDown);
    this.schemeQuery.removeEventListener('change', this.onSchemeChange);
    clearTimeout(this.idleTimer);
  }

  override render() {
    if (this.handingOff) return nothing;
    const current = this.settings.scene;
    return html`
      <tarn-backdrop
        remember
        .scene=${current}
        @tarn-revealed=${this.onRevealed}
        @tarn-settled=${this.onSettled}
      ></tarn-backdrop>
      ${this.settled || this.resumed ? this.renderPage() : nothing}
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

  private renderPage() {
    const {clock, widgets} = this.settings;
    return html`
      <div class="page" @scroll=${this.onScroll}>
        <div class="group" ?data-in-place=${this.resumed}>
          ${clock === 'none' ? nothing : html`<tarn-clock face=${clock}></tarn-clock>`}
          ${
            widgets.length
              ? html`<tarn-board
                  .widgets=${widgets}
                  ?instant=${this.resumed}
                  glass=${this.liveScene ? 'shader' : 'css'}
                  ?editing=${this.editing}
                  @tarn-reorder=${this.onReorder}
                  @tarn-tiles=${this.onTiles}
                ></tarn-board>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  override willUpdate(): void {
    this.setAttribute('tone', sceneTone(sceneById(this.settings.scene)));
  }

  /**
   * A reload continues the page exactly: the clock and widgets draw at once
   * over the ghost frame, which already shows their frost. A new tab fades
   * them in at once, with the scene's first frame.
   */
  private readonly resumed = arrival() === 'resume';

  /** Whether the live scene (and its shader glass) is on screen. */
  private get liveScene(): boolean {
    return this.settled ? this.settled.live : this.resumed;
  }

  /** Widgets moved: the backdrop frosts the scene behind them. */
  /** Widgets were dragged into a new order: show it, then save it. */
  private onReorder = (event: CustomEvent<ReorderDetail>) => {
    const {widgets} = event.detail;
    this.applySettings({...this.settings, widgets});
    void saveSettings({widgets});
  };

  private onTiles = (event: CustomEvent<TilesDetail>) => {
    const {rects, strength, radius} = event.detail;
    const backdrop =
      this.renderRoot.querySelector<TarnBackdrop>('tarn-backdrop');
    const live = this.liveScene;
    backdrop?.setTiles(live ? rects : [], strength, radius);
    if (live && (strength === 1 || !rects.length)) rememberTiles(rects, radius);
  };

  private scrollFrame = 0;
  private onScroll = () => {
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.renderRoot.querySelector<TarnBoard>('tarn-board')?.report();
    });
  };

  /** The tab icon's tint depends on light or dark mode. */
  private onSchemeChange = () => {
    void refreshFavicon(this.settings.tabIcon);
  };

  private onSettled = (event: CustomEvent<{live: boolean}>) => {
    this.settled = event.detail;
  };

  private onRevealed = (
    event: CustomEvent<{inPlace: boolean; live: boolean}>,
  ) => {
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
