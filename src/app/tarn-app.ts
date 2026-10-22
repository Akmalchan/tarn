/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {browser} from 'wxt/browser';
import {startsStill, type TarnBackdrop} from '../backdrop/tarn-backdrop';
import './tarn-settings-button';
import '../widgets/tarn-board';
import '../widgets/tarn-clock';
import {clockInk, clockTone} from '../widgets/clock-faces';
import '../search/tarn-search';
import type {
  ReorderDetail,
  TarnBoard,
  TilesDetail,
} from '../widgets/tarn-board';
import {sceneById, sceneTone, shownSceneId} from '../backdrop/scenes';
import {
  DEFAULT_SETTINGS,
  MAX_WIDGETS,
  normalizeSettings,
  type Settings,
  type WidgetKind,
} from '../settings/schema';
import {loadSettings, saveSettings, watchSettings} from '../settings/store';
import {watchSaveProblems, type SaveProblem} from '../settings/problems';
import {
  CUSTOM_TAB_ICON_KEY,
  arrival,
  isRememberedOff,
  refreshFavicon,
  rememberedScene,
} from './first-paint';
import {canHandOff, handOffToBrowserNewTab} from './handoff';
import {watchSidePanel} from './side-panel';
import {mirrorSettings, rememberedHome} from './mirror';
import {rememberTiles} from './tile-memory';
import {useLanguage} from '../i18n';
import {
  draggedKind,
  draggedSize,
  droppedCode,
  fromPanel,
} from '../widgets/drag-new';
import {saveWidgetData} from '../widgets/data';
import {setCodeScene} from '../widgets/code/stage';
import {darkInk, lightInk, surface} from '../ui/ink';
import {chordKeys, isTyping, shortcutFor, shortcutList} from './shortcuts';
import {t} from '../i18n';
import {applyAppearance} from '../ui/appearance';

/** Root of the new tab page. */
export class TarnApp extends LitElement {
  static override properties = {
    settings: {state: true},
    revealed: {state: true},
    settled: {state: true},
    handingOff: {state: true},
    editing: {state: true},
    incoming: {state: true},
    showKeys: {state: true},
    scrolling: {state: true},
    stale: {state: true},
  };

  static override styles = css`
    :host {
      display: block;
      height: 100%;

      /* Widget and clock colors on dark scenes. */
      ${darkInk}
      --tile-line: rgb(255 255 255 / 0.14);
      --tile-fill: rgb(255 255 255 / 0.03);
      --tile-fill-solid: rgb(255 255 255 / 0.1);
      --tile-highlight: rgb(255 255 255 / 0.08);
      --chip: rgb(255 255 255 / 0.14);
      --chip-hover: rgb(255 255 255 / 0.22);
      --chip-strong: rgb(30 34 44 / 0.85);
      /* A widget being dragged: a nearly solid card. */
      --tile-held: rgb(20 25 34 / 0.86);
    }

    /* Light scenes (Bloom): dark text, brighter frost. */
    :host([tone='light']) {
      ${lightInk}
      --tile-line: rgb(255 255 255 / 0.55);
      --tile-fill: rgb(255 255 255 / 0.06);
      --tile-fill-solid: rgb(255 255 255 / 0.45);
      --tile-highlight: rgb(255 255 255 / 0.5);
      --chip: rgb(255 255 255 / 0.45);
      --chip-hover: rgb(255 255 255 / 0.65);
      --chip-strong: rgb(255 255 255 / 0.9);
      --tile-held: rgb(246 246 251 / 0.88);
      --focus-ring: rgb(22 26 38 / 0.6);
    }

    /* The clock and widgets: one group a little above the middle. Free space
       splits 2 : 3 above and below; a crowded page scrolls instead, and
       always keeps at least 40px above the clock and below the widgets
       (an empty spacer would otherwise shrink to nothing). */
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
      min-height: 40px;
    }

    .page::after {
      content: '';
      flex: 3 1 96px;
      min-height: 40px;
    }

    .group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 56px;
    }

    tarn-clock,
    tarn-search {
      animation: controls-in 200ms ease-out both;
    }

    .group[data-in-place] tarn-clock,
    .group[data-in-place] tarn-search {
      animation: none;
    }

    /* The search box belongs with the clock (32px under it) and sits a
       little closer to the widgets than the clock does (40px). */
    tarn-clock + tarn-search {
      margin-top: -24px;
    }

    tarn-search {
      margin-bottom: -16px;
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

    /* Tarn was updated while this tab stayed open: one quiet line at the
       bottom, on a solid surface, until the tab is reloaded. */
    .stale {
      ${surface}
      position: fixed;
      bottom: 20px;
      left: 50%;
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: calc(100% - 32px);
      padding: 8px 8px 8px 16px;
      font-size: 13px;
      color: var(--ink);
      background: var(--surface);
      border: 1px solid var(--tile-line);
      border-radius: 12px;
      box-shadow: var(--surface-shadow);
      transform: translateX(-50%);
      animation: controls-in 200ms ease-out both;
    }

    .stale button {
      flex: none;
      padding: 5px 12px;
      font: 600 13px var(--font-sans);
      color: var(--ink);
      background: var(--chip);
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }

    .stale button:hover {
      background: var(--chip-hover);
    }

    .stale button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }

    /* The ? sheet: a solid card over a faint veil, in the page's ink. A
       modal dialog the size of the page, so it takes focus, keeps it and
       gives it back. */
    .keys-veil {
      position: fixed;
      inset: 0;
      box-sizing: border-box;
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 24px;
      color: inherit;
      border: 0;
      background: rgb(0 0 0 / 0.32);
      /* Only while the sheet is open, so it costs nothing otherwise. */
      backdrop-filter: blur(14px);
      animation: controls-in 160ms ease-out both;
    }

    .keys-veil[open] {
      display: grid;
      place-items: center;
    }

    .keys-veil::backdrop {
      background: none;
    }

    /* The shortcuts sheet: the system's light or dark mode (ui/ink.ts). */
    .keys {
      ${surface}
      min-width: min(320px, 100%);
      padding: 18px 22px 20px;
      color: var(--ink);
      background: var(--surface);
      border: 1px solid var(--tile-line);
      border-radius: 18px;
      box-shadow: var(--surface-shadow);
      animation: keys-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    @keyframes keys-in {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.98);
      }
    }

    .keys:focus {
      outline: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .keys {
        animation-name: controls-in;
      }
    }

    .keys h2 {
      margin: 0 0 14px;
      font-size: 15px;
      font-weight: 600;
    }

    .keys dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px 16px;
      align-items: center;
      margin: 0;
    }

    .keys dt {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: flex-end;
      color: var(--ink-dim);
    }

    .keys .plus {
      font-size: 12px;
    }

    .keys .or {
      margin: 0 4px;
      font-size: 12px;
    }

    .keys dd {
      margin: 0;
      font-size: 14px;
    }

    .keys kbd {
      min-width: 24px;
      padding: 3px 7px;
      font: 600 12px / 16px var(--font-sans);
      text-align: center;
      color: var(--ink);
      background: var(--chip);
      border-radius: 6px;
    }
  `;

  declare settings: Settings;
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
  /** A widget being dragged in from the settings panel, until it drops. */
  declare incoming: WidgetKind | null;
  /** The ? sheet of shortcuts is open. */
  declare showKeys: boolean;
  /**
   * The page is scrolling: tiles use CSS glass, which the compositor moves
   * with them, instead of the scene's frost, which is drawn at 20-30 fps a
   * frame behind and visibly lagged and jumped under the tiles.
   */
  declare scrolling: boolean;
  /** Tarn was updated since this tab opened: changes can't be saved here. */
  declare stale: boolean;
  private scrollEnd = 0;
  /** The scene's frost is off (set before, cleared before `scrolling`). */
  private frostPaused = false;
  private lastTiles: TilesDetail | null = null;
  private incomingTimer = 0;

  private schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  private unwatch: () => void = () => {};
  private unwatchPanel: () => void = () => {};
  private unwatchProblems: () => void = () => {};

  constructor() {
    super();
    // Start on the remembered scene; synced storage confirms it a moment
    // later, so opening a tab never flashes the default scene first.
    this.settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...rememberedHome(),
      scene: rememberedScene(),
    });
    this.resumedStill = this.resumed && startsStill(this.shownScene());
    this.revealed = null;
    this.settled = null;
    this.handingOff = canHandOff && isRememberedOff();
    this.editing = false;
    this.incoming = null;
    this.showKeys = false;
    this.scrolling = false;
    this.stale = false;
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
    this.unwatchProblems = watchSaveProblems(this.onSaveProblem);
    this.unwatchPanel = watchSidePanel(open => (this.editing = open));
    window.addEventListener('dragover', this.onDragOver);
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('dragleave', this.onDragLeave);
    window.addEventListener('drop', this.onDrop);
    window.addEventListener('keydown', this.onKey);
    this.schemeQuery.addEventListener('change', this.onSchemeChange);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    this.unwatchProblems();
    this.unwatchPanel();
    window.removeEventListener('dragover', this.onDragOver);
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('dragleave', this.onDragLeave);
    window.removeEventListener('drop', this.onDrop);
    window.removeEventListener('keydown', this.onKey);
    this.schemeQuery.removeEventListener('change', this.onSchemeChange);
  }

  override render() {
    if (this.handingOff) return nothing;
    const current = this.shownScene();
    return html`
      <tarn-backdrop
        remember
        ?awake=${this.editing}
        .scene=${current}
        @tarn-revealed=${this.onRevealed}
        @tarn-settled=${this.onSettled}
      ></tarn-backdrop>
      ${this.settled || this.resumed ? this.renderPage() : nothing}
      ${
        this.revealed
          ? html`<div class="controls" ?data-in-place=${this.revealed.inPlace}>
              <tarn-settings-button></tarn-settings-button>
            </div>`
          : nothing
      }
      ${this.showKeys ? this.renderKeys() : nothing}
      ${
        this.stale
          ? html`<div class="stale" role="status">
              <span>${t('saving.stale')}</span>
              <button @click=${() => location.reload()}>
                ${t('saving.reload')}
              </button>
            </div>`
          : nothing
      }
    `;
  }

  /** The ? sheet: every shortcut, over the page. */
  private renderKeys() {
    return html`<dialog
      class="keys-veil"
      aria-labelledby="keys-title"
      @click=${(event: MouseEvent) => {
        if (event.target === event.currentTarget) this.closeKeys();
      }}
      @close=${() => (this.showKeys = false)}
      @keydown=${(event: KeyboardEvent) => {
        // Nothing in the sheet to tab to: focus stays on it.
        if (event.key === 'Tab') event.preventDefault();
      }}
    >
      <div class="keys" tabindex="-1">
        <h2 id="keys-title">${t('keys.title')}</h2>
        <dl>
          ${shortcutList().map(
            row => html`
              <dt>${chordKeys(row)}</dt>
              <dd>${t(row.label)}</dd>
            `,
          )}
        </dl>
      </div>
    </dialog>`;
  }

  /** Closes the ? sheet; the dialog gives focus back to where it was. */
  private closeKeys(): void {
    const dialog =
      this.renderRoot.querySelector<HTMLDialogElement>('dialog.keys-veil');
    if (dialog?.open) dialog.close();
    else this.showKeys = false;
  }

  private renderPage() {
    const {clock, widgets, search} = this.settings;
    return html`
      <div class="page" @scroll=${this.onScroll}>
        <div class="group" ?data-in-place=${this.resumed}>
          ${
            clock === 'none'
              ? nothing
              : html`<tarn-clock
                  face=${clock}
                  tone=${clockTone(
                    this.settings.clockColor,
                    sceneTone(sceneById(this.shownScene())),
                    this.settings.clockHex,
                  )}
                  style=${clockInk(
                    this.settings.clockColor,
                    this.settings.clockHex,
                  )}
                ></tarn-clock>`
          }
          ${
            search.show
              ? html`<tarn-search
                  .settings=${search}
                  ?editing=${this.editing}
                  @tarn-remove-search=${this.onRemoveSearch}
                  glass=${
                    this.liveScene && widgets.length && !this.scrolling
                      ? 'shader'
                      : 'css'
                  }
                ></tarn-search>`
              : nothing
          }
          ${
            widgets.length || this.incoming
              ? html`<tarn-board
                  .widgets=${widgets}
                  ?instant=${this.resumed}
                  glass=${this.liveScene && !this.scrolling ? 'shader' : 'css'}
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
    const scene = sceneById(this.shownScene());
    const tone = sceneTone(scene);
    this.setAttribute('tone', tone);
    // Custom widgets draw with the wallpaper's colors and ink.
    setCodeScene(scene, tone);
  }

  private lastSearchLook = '';

  override updated(): void {
    // The ? sheet opens as a modal: focus moves in and stays until it closes.
    const keys =
      this.renderRoot.querySelector<HTMLDialogElement>('dialog.keys-veil');
    if (keys && !keys.open) {
      keys.showModal();
      keys.querySelector<HTMLElement>('.keys')?.focus();
    }
    // The search box became glass, or stopped being it: redraw the frost.
    const {show, style} = this.settings.search;
    const look = `${show}:${style}`;
    if (look !== this.lastSearchLook) {
      this.lastSearchLook = look;
      this.board?.refresh();
    }
  }

  /**
   * A reload continues the page exactly: the clock and widgets draw at once
   * over the ghost frame, which already shows their frost. A new tab fades
   * them in at once, with the scene's first frame.
   */
  private readonly resumed = arrival() === 'resume';
  /**
   * A reload of a scene this computer can't keep up with: it shows its
   * still picture, so widgets use CSS glass from the first frame.
   */
  private readonly resumedStill: boolean;

  /** Whether the live scene (and its shader glass) is on screen. */
  private get liveScene(): boolean {
    return this.settled
      ? this.settled.live
      : this.resumed && !this.resumedStill;
  }

  /** Widgets moved: the backdrop frosts the scene behind them. */
  /** Widgets were dragged into a new order: show it, then save it. */
  private onReorder = (event: CustomEvent<ReorderDetail>) => {
    const {widgets} = event.detail;
    this.applySettings({...this.settings, widgets});
    void saveSettings({widgets});
  };

  private onTiles = (event: CustomEvent<TilesDetail>) => {
    this.lastTiles = event.detail;
    this.sendTiles();
  };

  private sendTiles(): void {
    if (!this.lastTiles) return;
    const {strength, radius} = this.lastTiles;
    // A frosted search box is one more frosted shape, measured with the
    // tiles so it follows the same settle and scroll.
    const rects = [...this.lastTiles.rects, ...this.searchGlassRect()];
    const backdrop =
      this.renderRoot.querySelector<TarnBackdrop>('tarn-backdrop');
    // While scrolling the tiles carry their own CSS glass.
    const live = this.liveScene && !this.frostPaused;
    backdrop?.setTiles(live ? rects : [], strength, radius);
    if (live && (strength === 1 || !rects.length)) rememberTiles(rects, radius);
  }

  /** The search box's frame, when it's frosted glass: x, y, w, h or none. */
  private searchGlassRect(): number[] {
    if (!this.settings.search.show || this.settings.search.style !== 'glass') {
      return [];
    }
    const box = this.renderRoot.querySelector('tarn-search');
    if (!box) return [];
    const r = box.getBoundingClientRect();
    // The box itself is 46px tall; the dropdown hangs below it.
    return [r.x, r.y, r.width, 46];
  }

  // A widget dragged from the settings panel's "Add" list: the board shows
  // where it would land, and the drop adds it there.

  private get board(): TarnBoard | null {
    return this.renderRoot.querySelector<TarnBoard>('tarn-board');
  }

  /** Shortcuts (app/shortcuts.ts), unless off; only Cmd/Ctrl+K while typing. */
  private onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      if (this.showKeys) this.closeKeys();
      else if (isTyping(event)) {
        (event.composedPath()[0] as HTMLElement).blur();
      }
      return;
    }
    if (!this.settings.shortcuts) return;
    const shortcut = shortcutFor(event);
    if (!shortcut) return;
    // In a text field, keys are typing (Option + 1 types "¡"); only the
    // search chord reaches out of it, as in other apps.
    const chord = event.metaKey || event.ctrlKey;
    if (isTyping(event) && !(chord && shortcut.kind === 'search')) return;
    const board = this.renderRoot.querySelector('tarn-board');
    // While arranging, widget contents are inert.
    const widget = <K extends keyof HTMLElementTagNameMap>(tag: K) =>
      this.editing ? null : (board?.widget(tag) ?? null);
    let done = true;
    switch (shortcut.kind) {
      case 'search': {
        const search = this.renderRoot.querySelector('tarn-search');
        if (search) search.focusBox();
        else done = false;
        break;
      }
      case 'site':
        done = widget('tarn-favorites')?.openNumber(shortcut.number) ?? false;
        break;
      case 'help':
        if (this.showKeys) this.closeKeys();
        else this.showKeys = true;
        break;
    }
    // Only a key that did something is kept from the page.
    if (done) event.preventDefault();
  };

  private onDragOver = (event: DragEvent) => {
    const kind = draggedKind(event.dataTransfer);
    if (!kind || !this.editing) return;
    if (this.settings.widgets.length >= MAX_WIDGETS) return;
    // Accepting it: the browser shows a copy cursor and allows the drop.
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    this.incoming = kind;
    this.board?.hoverNew(
      kind,
      event.clientX,
      event.clientY,
      draggedSize(event.dataTransfer) ?? undefined,
    );
    // A safety net: a drag over the page keeps firing dragover, so a long
    // silence means it ended somewhere we didn't hear about.
    clearTimeout(this.incomingTimer);
    this.incomingTimer = window.setTimeout(this.endIncoming, 1500);
  };

  /**
   * Leaving one element for another is followed at once by a dragover
   * there; leaving the page (or Escape) is not, so the drag ends shortly.
   */
  private onDragLeave = (event: DragEvent) => {
    if (!this.incoming || event.relatedTarget !== null) return;
    clearTimeout(this.incomingTimer);
    this.incomingTimer = window.setTimeout(this.endIncoming, 120);
  };

  private onDrop = (event: DragEvent) => {
    if (!draggedKind(event.dataTransfer) || !this.incoming) return;
    event.preventDefault();
    clearTimeout(this.incomingTimer);
    // Only Tarn's own panel adds widgets; a web page's look-alike drag
    // is let go.
    if (!fromPanel(event.dataTransfer, this.incoming)) {
      this.endIncoming();
      return;
    }
    // A custom widget from an example brings its code: stored before the
    // widget appears, so it starts with it.
    const code =
      this.incoming === 'code' ? droppedCode(event.dataTransfer) : null;
    this.board?.dropNew(
      code?.name,
      code
        ? id => void saveWidgetData(id, {lang: 'glsl', code: code.code})
        : undefined,
    );
    this.incoming = null;
  };

  private endIncoming = () => {
    clearTimeout(this.incomingTimer);
    this.board?.leaveNew();
    this.incoming = null;
  };

  private scrollFrame = 0;
  private onScroll = () => {
    if (!this.frostPaused) {
      this.scrolling = true;
      this.frostPaused = true;
      this.sendTiles();
    }
    clearTimeout(this.scrollEnd);
    this.scrollEnd = window.setTimeout(() => {
      // Frost back first; CSS glass goes a few frames later, once the
      // scene has drawn it, so the tiles are never bare.
      this.frostPaused = false;
      this.sendTiles();
      this.scrollEnd = window.setTimeout(() => (this.scrolling = false), 80);
    }, 180);
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.renderRoot.querySelector<TarnBoard>('tarn-board')?.report();
    });
  };

  /** A new image of the user's own was chosen in settings. */
  private onStorage = (event: StorageEvent) => {
    if (event.key === CUSTOM_TAB_ICON_KEY) {
      void refreshFavicon(this.settings.tabIcon);
    }
  };

  /** The tab icon's tint depends on light or dark mode. */
  private onSchemeChange = () => {
    void refreshFavicon(this.settings.tabIcon);
    // The default wallpaper follows light and dark (`auto`).
    this.requestUpdate();
  };

  /** The wallpaper on screen: the setting, with `auto` resolved. */
  private shownScene(): string {
    return shownSceneId(this.settings.scene, this.settings.appearance);
  }

  private onSettled = (event: CustomEvent<{live: boolean}>) => {
    this.settled = event.detail;
    // The live scene can stop, or come back, after widgets are up (a shader
    // failed, the GPU context was lost): its frost goes or comes with it.
    this.sendTiles();
  };

  private onRevealed = (
    event: CustomEvent<{inPlace: boolean; live: boolean}>,
  ) => {
    if (!this.revealed) keepTarnWarm();
    this.revealed = event.detail;
  };

  /**
   * A change wasn't stored: show what is (the panel says why), or, in a
   * tab older than the installed Tarn, ask for a reload.
   */
  private onSaveProblem = (problem: SaveProblem) => {
    if (problem === 'stale') this.stale = true;
    else void loadSettings().then(this.applySettings, () => {});
  };

  /** The search box's Remove, in edit mode: hidden until Settings > Search. */
  private onRemoveSearch = () => {
    void saveSettings({search: {...this.settings.search, show: false}});
  };

  private applySettings = (settings: Settings) => {
    applyAppearance(settings.appearance);
    this.settings = settings;
    mirrorSettings(settings);
    void refreshFavicon(settings.tabIcon);
    void useLanguage(settings.language);
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

customElements.define('tarn-app', TarnApp);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-app': TarnApp;
  }
}
