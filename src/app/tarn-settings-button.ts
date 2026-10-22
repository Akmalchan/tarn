/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, nothing, svg} from 'lit';
import {browser} from 'wxt/browser';
import {finishTip, takeTip} from './first-run';
import {isComposing, keyName} from './shortcuts';
import {openSidePanel, prepareSidePanel, watchSidePanel} from './side-panel';
import {LocaleController, t, type MessageKey} from '../i18n';
import {surfacesDark} from '../ui/appearance';
import {surface} from '../ui/ink';

/**
 * "settings" from Google's Material Icons, Apache License 2.0.
 * https://github.com/google/material-design-icons
 */
const MATERIAL_SETTINGS =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z';

/** The scene's fade and settle (docs/design.md, Motion) are over by then. */
const TIP_AFTER_MS = 1800;
const TIP_OUT_MS = 200;

/** The first-run guide's pages, in order; some show only where they apply. */
type GuidePage = 'settings' | 'footer' | 'pin' | 'bookmarks';

const GUIDE_TEXT: Record<GuidePage, {title: MessageKey; body: MessageKey}> = {
  settings: {title: 'tip.title', body: 'tip.body'},
  footer: {title: 'tip.footer.title', body: 'tip.footer.body'},
  pin: {title: 'tip.pin.title', body: 'tip.pin.body'},
  bookmarks: {title: 'tip.bookmarks.title', body: 'tip.bookmarks.body'},
};

/**
 * Chrome's own new tab extras an extension can't change, only explain
 * (researched 2026-10-19): the footer Chrome adds under an extension's new
 * tab (Chrome 138+), Tarn pinned to the toolbar on install (Chrome turns
 * that on for new extensions), and the bookmarks bar Chrome hides on new
 * tabs. Firefox has none of them.
 */
async function guidePages(): Promise<GuidePage[]> {
  if (import.meta.env.FIREFOX) return ['settings'];
  let pinned = false;
  try {
    pinned = (await browser.action.getUserSettings()).isOnToolbar === true;
  } catch {
    // Older Chrome: no way to know, so no page about it.
  }
  return [
    'settings',
    'footer',
    ...(pinned ? ['pin' as const] : []),
    'bookmarks',
  ];
}

/** The keys that keep Chrome's bookmarks bar shown, for this computer. */
function bookmarkKeys(): string[] {
  return [keyName('command'), keyName('shift'), 'B'];
}

/** The same keys in a sentence: "⌘ ⇧ B", or "Ctrl + Shift + B". */
function bookmarkKeysText(): string {
  const keys = bookmarkKeys();
  return keys.join(keys[0] === '⌘' ? ' ' : ' + ');
}

/** The macOS-style pointer drawn over the pictures. */
const POINTER = svg`<svg class="pointer" viewBox="0 0 13 18" aria-hidden="true">
  <path d="M1.2 1.2v14l3.5-3.3 2.4 5.2 2.3-1-2.4-5.1 4.9-.4z" />
</svg>`;

/**
 * A crisp piece of the real Chrome UI (public/guide, taken from Chrome with
 * a clean profile and Tarn installed) on a calm backdrop, with the step
 * drawn over it in the page's language.
 */
function guideShot(page: GuidePage) {
  // Chrome's look in the picture matches the card (Settings > Advanced).
  const piece = html`<img
    class="piece"
    src="/guide/${page}-${surfacesDark() ? 'dark' : 'light'}.webp"
    alt=""
  />`;
  return html`<div class="shot" data-page=${page} aria-hidden="true">
    ${piece}
    ${
      page === 'settings'
        ? html`<span class="gear-copy"
              ><svg viewBox="0 0 24 24"><path d=${MATERIAL_SETTINGS} /></svg
            ></span>
            ${POINTER}`
        : nothing
    }
    ${
      page === 'footer'
        ? html`<img
              class="piece panel-piece"
              src="/guide/footer-panel-${surfacesDark() ? 'dark' : 'light'}.webp"
              alt=""
            />
            <span class="ring"></span>
            <span class="step one">1</span>
            <span class="step two">2</span>
            ${POINTER}`
        : nothing
    }
    ${
      page === 'pin'
        ? html`<div class="menu">
              <i class="short"></i><b>${t('tip.art.unpin')}</b><i></i
              ><i class="short"></i>
            </div>
            ${POINTER}`
        : nothing
    }
    ${
      page === 'bookmarks'
        ? html`<div class="keys">
            ${bookmarkKeys().map(k => html`<kbd>${k}</kbd>`)}
          </div>`
        : nothing
    }
  </div>`;
}

/**
 * A small settings button in the bottom-right corner. Opens Tarn in the
 * browser's side panel, and steps aside while that panel is open. On the
 * first new tabs after an install it is awake and points itself out with
 * a small card (`first-run.ts`).
 */
export class TarnSettingsButton extends LitElement {
  static override properties = {
    panelOpen: {type: Boolean, reflect: true, attribute: 'panel-open'},
    tip: {type: String, reflect: true},
    pages: {state: true},
    step: {state: true},
  };

  static override styles = css`
    /* The host is an invisible zone around the corner: the button wakes up
       as the pointer approaches, before it is actually touched. */
    :host {
      position: fixed;
      right: 0;
      bottom: 0;
      padding: 28px 14px 14px 32px;
      transition: opacity 200ms ease;
    }

    :host([panel-open]) {
      opacity: 0;
      pointer-events: none;
    }

    /* At rest: just a faint gear. Near: a round glass button around it. */
    .gear {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      color: rgb(255 255 255 / 0.38);
      background: rgb(255 255 255 / 0);
      border: 0;
      border-radius: 50%;
      cursor: pointer;
      transition:
        color 250ms ease,
        background-color 250ms ease;
    }

    :host(:hover) .gear,
    .gear:focus-visible {
      color: rgb(255 255 255 / 0.95);
      background: rgb(255 255 255 / 0.16);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
    }

    .gear:hover {
      background: rgb(255 255 255 / 0.22);
    }

    button:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }

    svg {
      width: 20px;
      height: 20px;
      /* Keeps the faint gear readable on light backgrounds too. */
      filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.18));
      transition: transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    :host(:hover) svg,
    button.gear:focus-visible svg {
      transform: rotate(60deg);
    }

    @media (prefers-reduced-motion: reduce) {
      :host(:hover) svg,
      button.gear:focus-visible svg {
        transform: none;
      }
    }

    /* The first-run tip: the gear wakes up and wears a soft ring. */
    :host([tip]) .gear {
      color: rgb(255 255 255 / 0.95);
      background: rgb(255 255 255 / 0.16);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
    }

    /* Centered on the gear (14px from the corner, 32px wide). */
    .ring {
      position: absolute;
      right: 10px;
      bottom: 10px;
      box-sizing: border-box;
      width: 40px;
      height: 40px;
      border: 1.5px solid rgb(255 255 255 / 0.55);
      border-radius: 50%;
      pointer-events: none;
      animation: ring 2.4s ease-out 2;
    }

    @keyframes ring {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      70% {
        transform: scale(1.35);
        opacity: 0;
      }
      71% {
        transform: scale(1);
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }

    .card {
      position: absolute;
      right: 14px;
      bottom: 58px;
      box-sizing: border-box;
      width: 300px;
      padding: 12px 12px 12px;
      ${surface}
      font-family: var(--font-sans);
      color: var(--ink);
      background: var(--surface);
      border: 1px solid var(--tile-line);
      border-radius: 20px;
      box-shadow: var(--surface-shadow);
      opacity: 0;
      transform: translateY(6px);
      transition:
        opacity 320ms ease,
        transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .card .words,
    .card .actions {
      margin-left: 6px;
      margin-right: 6px;
    }

    :host([tip='in']) .card {
      opacity: 1;
      transform: none;
    }

    :host([tip='out']) .card,
    :host([tip='out']) .ring {
      opacity: 0;
      transition-duration: ${TIP_OUT_MS}ms;
    }

    /* The picture: a crisp piece of the real Chrome UI (public/guide) on
       a calm backdrop, with the step drawn over it: Chrome's menu, a
       pointer, keys. Chrome's light or dark look, as the browser is. */
    .shot {
      --menu: light-dark(#ffffff, #2d2e31);
      --menu-ink: light-dark(#1f1f1f, #e8eaed);
      --menu-dim: light-dark(#dadce0, #4a4c50);
      --menu-hi: light-dark(#e8eaed, #3c4043);
      position: relative;
      height: 150px;
      margin: 0 0 14px;
      overflow: hidden;
      border-radius: 12px;
      background:
        radial-gradient(
          120% 90% at 20% 0%,
          light-dark(#dbe6f3, #17324d) 0%,
          transparent 60%
        ),
        linear-gradient(
          160deg,
          light-dark(#eef2f7, #0d1622),
          light-dark(#d7dfe9, #070a10)
        );
    }

    .piece {
      position: absolute;
      display: block;
      border-radius: 9px;
      box-shadow:
        0 0 0 1px rgb(0 0 0 / 0.12),
        0 14px 30px -12px rgb(0 0 0 / 0.55);
    }

    .shot[data-page='settings'] .piece {
      top: 16px;
      right: -12px;
      width: 196px;
    }

    /* Customize Chrome in the footer (1), then the panel's switch (2). */
    .shot[data-page='footer'] .piece {
      left: -28px;
      bottom: 22px;
      width: 300px;
    }

    .shot[data-page='footer'] .panel-piece {
      top: 18px;
      right: 10px;
      bottom: auto;
      left: auto;
      width: 190px;
    }

    .shot .ring {
      position: absolute;
      top: 43px;
      left: 236px;
      width: 22px;
      height: 14px;
      border: 2px solid #8ab4f8;
      border-radius: 10px;
    }

    .shot .step {
      position: absolute;
      display: grid;
      width: 18px;
      height: 18px;
      place-items: center;
      border-radius: 50%;
      color: var(--menu);
      background: var(--menu-ink);
      font:
        600 11px/1 system-ui,
        sans-serif;
    }

    .shot .step.one {
      left: 152px;
      bottom: 27px;
    }

    .shot .step.two {
      top: 30px;
      left: 50px;
    }

    .shot:not([data-page='footer']) :is(.ring, .step) {
      display: none;
    }

    .shot[data-page='pin'] .piece {
      top: 18px;
      right: -10px;
      width: 248px;
    }

    .shot[data-page='bookmarks'] .piece {
      top: 18px;
      left: 12px;
      width: 290px;
    }

    /* Chrome's right-click menu, drawn: one real item, the rest quiet. */
    .menu {
      position: absolute;
      display: grid;
      gap: 2px;
      min-width: 128px;
      padding: 5px;
      box-sizing: border-box;
      border-radius: 9px;
      background: var(--menu);
      color: var(--menu-ink);
      box-shadow:
        0 0 0 0.5px rgb(0 0 0 / 0.2),
        0 10px 28px -6px rgb(0 0 0 / 0.5);
      font:
        500 11px/1 system-ui,
        sans-serif;
    }

    .menu i {
      display: block;
      height: 5px;
      margin: 6px 8px;
      border-radius: 3px;
      background: var(--menu-dim);
    }

    .menu i.short {
      width: 55%;
    }

    .menu b {
      display: block;
      padding: 6px 8px;
      border-radius: 5px;
      background: var(--menu-hi);
      font-weight: 500;
      white-space: nowrap;
    }

    .shot[data-page='pin'] .menu {
      top: 58px;
      left: 52px;
    }

    .pointer {
      position: absolute;
      width: 13px;
      height: 18px;
      filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.45));
    }

    .pointer path {
      fill: #111;
      stroke: #fff;
      stroke-width: 1.3;
      stroke-linejoin: round;
    }

    .shot[data-page='footer'] .pointer {
      left: 226px;
      bottom: 16px;
    }

    .shot[data-page='pin'] .pointer {
      top: 92px;
      left: 104px;
    }

    .shot[data-page='settings'] .pointer {
      top: 90px;
      left: 38px;
    }

    /* Tarn's own gear, opening the panel on the right. */
    .shot .gear-copy {
      position: absolute;
      top: 64px;
      left: 22px;
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      background: rgb(255 255 255 / 0.16);
      box-shadow: 0 0 0 5px rgb(138 180 248 / 0.28);
    }

    .shot:not([data-page='settings']) .gear-copy {
      display: none;
    }

    .gear-copy svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    .shot .gear-copy {
      background: #3c4043;
    }

    /* Keys, as on a keyboard. */
    .keys {
      position: absolute;
      right: 0;
      bottom: 18px;
      left: 0;
      display: flex;
      justify-content: center;
      gap: 7px;
    }

    .keys kbd {
      display: grid;
      min-width: 34px;
      height: 34px;
      padding: 0 8px;
      box-sizing: border-box;
      place-items: center;
      border-radius: 8px;
      background: linear-gradient(#fdfdfd, #eceef1);
      box-shadow:
        0 0 0 0.5px rgb(0 0 0 / 0.25),
        0 2px 0 rgb(0 0 0 / 0.18),
        0 6px 14px -6px rgb(0 0 0 / 0.5);
      font:
        500 14px/1 system-ui,
        sans-serif;
      color: #3c4043;
    }

    .dots {
      display: flex;
      gap: 5px;
    }

    .dots i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--ink-faint);
      transition: background-color 200ms ease;
    }

    .dots i.on {
      background: var(--ink);
    }

    h2 {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
    }

    /* Every page's words sit in the same cell, the others hidden, so the
       card is as tall as its longest page in this language and Back and
       Next stay put. */
    .words {
      display: grid;
    }

    .words > div {
      grid-area: 1 / 1;
    }

    .words > div:not(.on) {
      visibility: hidden;
    }

    p {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: var(--ink-dim);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
      margin-top: 12px;
    }

    .actions button {
      height: 28px;
      padding: 0 12px;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
      transition: background-color 200ms ease;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      border-radius: 999px;
    }

    .actions button:hover {
      background: var(--chip);
    }

    .actions .later {
      margin-left: -8px;
      padding: 0 8px;
      font-weight: 500;
      color: var(--ink-dim);
    }

    .actions .open,
    .actions .open:hover {
      color: var(--surface);
      background: var(--ink);
    }

    @media (prefers-reduced-motion: reduce) {
      .ring {
        animation: none;
      }

      .card {
        transform: none;
      }
    }
  `;

  declare panelOpen: boolean;
  /** The first-run tip: absent, fading in ('in') or out ('out'). */
  declare tip: 'in' | 'out' | undefined;
  /** The guide's pages for this browser, and the one showing. */
  declare pages: GuidePage[];
  declare step: number;
  private unwatch: () => void = () => {};
  private stopWaiting: () => void = () => {};

  constructor() {
    super();
    new LocaleController(this);
    this.panelOpen = false;
    this.pages = ['settings'];
    this.step = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void prepareSidePanel();
    this.unwatch = watchSidePanel(open => {
      this.panelOpen = open;
      if (open) this.endTip();
    });
    this.waitForTip();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    this.stopWaiting();
  }

  /**
   * The tip waits for the scene to settle and for the person to move the
   * mouse or press a key, so it never competes with the arrival or with
   * the browser's own "keep this page?" bubble.
   */
  private waitForTip(): void {
    const start = performance.now();
    const wake = () => {
      this.stopWaiting();
      const left = TIP_AFTER_MS - (performance.now() - start);
      const timer = setTimeout(() => void this.showTip(), Math.max(0, left));
      this.stopWaiting = () => clearTimeout(timer);
    };
    addEventListener('pointermove', wake, {once: true, passive: true});
    addEventListener('keydown', wake, {once: true});
    this.stopWaiting = () => {
      removeEventListener('pointermove', wake);
      removeEventListener('keydown', wake);
    };
  }

  private async showTip(): Promise<void> {
    // The dev build (npm run dev) shows it on every new tab, for review.
    const show = import.meta.env.DEV || (await takeTip().catch(() => false));
    if (this.panelOpen || !show) return;
    this.pages = await guidePages();
    this.step = 0;
    this.tip = 'out';
    await this.updateComplete;
    // One frame at opacity 0 first, so the card fades in.
    requestAnimationFrame(() => {
      if (this.tip) this.tip = 'in';
    });
    addEventListener('keydown', this.onKey);
  }

  private endTip(): void {
    removeEventListener('keydown', this.onKey);
    if (!this.tip) return;
    void finishTip().catch(() => {});
    this.tip = 'out';
    setTimeout(() => (this.tip = undefined), TIP_OUT_MS);
  }

  /**
   * Arrow keys and Escape step through the guide only when they come to
   * it: from its own buttons, or with nothing focused. A key typed into
   * the search box (or any control) stays that control's.
   */
  private onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isComposing(event)) return;
    const path = event.composedPath();
    const card = this.renderRoot.querySelector('.card');
    const target = path[0];
    const toPage =
      target === document.body ||
      target === document.documentElement ||
      target === document ||
      target === window;
    if (!toPage && !(card && path.includes(card))) return;
    if (event.key === 'Escape') this.endTip();
    else if (event.key === 'ArrowRight') this.next();
    else if (event.key === 'ArrowLeft') this.back();
  };

  private next = () => {
    if (this.step < this.pages.length - 1) this.step++;
    else this.endTip();
  };

  private back = () => {
    if (this.step > 0) this.step--;
  };

  override render() {
    return html`
      ${this.tip ? this.renderTip() : nothing}
      <button
        class="gear"
        title=${t('common.settings')}
        aria-label=${t('common.openSettings')}
        ?inert=${this.panelOpen}
        @click=${this.open}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d=${MATERIAL_SETTINGS} />
        </svg>
      </button>
    `;
  }

  private renderTip() {
    const page = this.pages[this.step] ?? 'settings';
    const last = this.step === this.pages.length - 1;
    return html`
      ${page === 'settings' ? html`<span class="ring"></span>` : nothing}
      <aside
        class="card"
        data-page=${page}
        aria-labelledby="tip-title"
        aria-live="polite"
      >
        ${guideShot(page)}
        <div class="words">
          ${this.pages.map((each, i) => {
            const words = GUIDE_TEXT[each];
            return html`<div class=${i === this.step ? 'on' : ''}>
              <h2 id=${i === this.step ? 'tip-title' : nothing}>
                ${t(words.title)}
              </h2>
              <p>${t(words.body, {keys: bookmarkKeysText()})}</p>
            </div>`;
          })}
        </div>
        <div class="actions">
          ${
            this.step === 0
              ? html`<button class="later" @click=${this.endTip}>
                  ${t(this.pages.length > 1 ? 'tip.skip' : 'tip.gotIt')}
                </button>`
              : html`<button class="later" @click=${this.back}>
                  ${t('tip.back')}
                </button>`
          }
          ${
            this.pages.length > 1
              ? html`<span
                  class="dots"
                  role="img"
                  aria-label=${t('tip.step', {
                    n: this.step + 1,
                    count: this.pages.length,
                  })}
                  >${this.pages.map(
                    (_, i) =>
                      html`<i class=${i === this.step ? 'on' : ''}></i>`,
                  )}</span
                >`
              : nothing
          }
          <button class="open" @click=${this.next}>
            ${t(last ? 'tip.done' : 'tip.next')}
          </button>
        </div>
      </aside>
    `;
  }

  private open = () => {
    this.endTip();
    openSidePanel();
    // Hide right away; the panel's open event confirms it a moment later.
    if (!import.meta.env.FIREFOX) this.panelOpen = true;
  };
}

customElements.define('tarn-settings-button', TarnSettingsButton);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-settings-button': TarnSettingsButton;
  }
}
