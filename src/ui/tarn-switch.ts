/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html} from 'lit';

/**
 * An iOS-style on/off switch. Fires `change` with the new `checked` value
 * in `event.detail`.
 */
export class TarnSwitch extends LitElement {
  static override properties = {
    checked: {type: Boolean, reflect: true},
    disabled: {type: Boolean, reflect: true},
    label: {type: String},
  };

  static override styles = css`
    :host {
      display: inline-block;
      flex: none;
    }

    button {
      position: relative;
      display: block;
      width: 44px;
      height: 26px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: var(--switch-off, rgb(255 255 255 / 0.18));
      cursor: pointer;
      transition: background-color 200ms ease;
    }

    button::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
      transition: transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1);
    }

    button[aria-checked='true'] {
      background: var(--switch-on, #3a9bc1);
    }

    button[aria-checked='true']::after {
      transform: translateX(18px);
    }

    button:focus-visible {
      outline: 2px solid var(--switch-focus, rgb(255 255 255 / 0.7));
      outline-offset: 2px;
    }

    button:disabled {
      cursor: default;
      opacity: 0.5;
    }
  `;

  declare checked: boolean;
  declare disabled: boolean;
  declare label: string;

  constructor() {
    super();
    this.checked = false;
    this.disabled = false;
    this.label = '';
  }

  override render() {
    return html`<button
      role="switch"
      aria-label=${this.label}
      aria-checked=${this.checked}
      ?disabled=${this.disabled}
      @click=${this.toggle}
    ></button>`;
  }

  private toggle = () => {
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('change', {detail: this.checked}));
  };
}

customElements.define('tarn-switch', TarnSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-switch': TarnSwitch;
  }
}
