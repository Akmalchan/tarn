/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {LitElement, css, html} from 'lit';
import {openSidePanel, prepareSidePanel, watchSidePanel} from './side-panel';
import {t} from '../i18n';

/**
 * "settings" from Google's Material Icons, Apache License 2.0.
 * https://github.com/google/material-design-icons
 */
const MATERIAL_SETTINGS =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z';

/**
 * A small settings button in the bottom-right corner. Opens Tarn in the
 * browser's side panel, and steps aside while that panel is open.
 */
export class TarnSettingsButton extends LitElement {
  static override properties = {
    panelOpen: {type: Boolean, reflect: true, attribute: 'panel-open'},
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
    button {
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

    :host(:hover) button,
    button:focus-visible {
      color: rgb(255 255 255 / 0.95);
      background: rgb(255 255 255 / 0.16);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
    }

    button:hover {
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
    button:focus-visible svg {
      transform: rotate(60deg);
    }

    @media (prefers-reduced-motion: reduce) {
      :host(:hover) svg,
      button:focus-visible svg {
        transform: none;
      }
    }
  `;

  declare panelOpen: boolean;
  private unwatch: () => void = () => {};

  constructor() {
    super();
    this.panelOpen = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void prepareSidePanel();
    this.unwatch = watchSidePanel(open => (this.panelOpen = open));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
  }

  override render() {
    return html`
      <button
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

  private open = () => {
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
