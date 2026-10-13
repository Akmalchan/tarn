/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {
  debounce,
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {widgetStyles} from './styles';

const MAX_LENGTH = 20_000;

const normalize = (raw: unknown): string =>
  typeof raw === 'string' ? raw.slice(0, MAX_LENGTH) : '';

/** A plain note. Saved as you type, kept in sync across open tabs. */
export class TarnNotes extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    heading: {attribute: false},
    text: {state: true},
  };

  static override styles = [
    widgetStyles,
    css`
      textarea {
        flex: 1;
        width: 100%;
        min-height: 0;
        padding: 0;
        margin: 0;
        font: inherit;
        font-size: 15px;
        line-height: 1.45;
        color: var(--ink);
        background: transparent;
        border: 0;
        outline: none;
        resize: none;
        scrollbar-width: none;
        /* Text that runs past the tile fades out instead of being cut. */
        mask-image: linear-gradient(
          to bottom,
          #000 calc(100% - 18px),
          transparent
        );
      }

      textarea::placeholder {
        color: var(--ink-faint);
      }
    `,
  ];

  declare widgetId: string;
  /** The widget's name: the user's, or the default. */
  declare heading: string;
  declare text: string;
  private unwatch: () => void = () => {};
  private save = debounce((text: string) => {
    void saveWidgetData(this.widgetId, text);
  }, 400);

  constructor() {
    super();
    this.widgetId = '';
    this.heading = 'Notes';
    this.text = '';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.text = peekWidgetData(this.widgetId, normalize);
    void loadWidgetData(this.widgetId, normalize).then(t => (this.text = t));
    this.unwatch = watchWidgetData(this.widgetId, normalize, text => {
      // Another tab edited it; don't fight the user typing here.
      if (this.shadowRoot?.activeElement?.tagName !== 'TEXTAREA') {
        this.text = text;
      }
    });
    window.addEventListener('pagehide', this.save.flush);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.save.flush();
    this.unwatch();
    window.removeEventListener('pagehide', this.save.flush);
  }

  override render() {
    return html`
      <h3 id="title">${this.heading}</h3>
      <textarea
        aria-labelledby="title"
        placeholder="Write something…"
        maxlength=${MAX_LENGTH}
        spellcheck="false"
        .value=${this.text}
        @input=${this.onInput}
        @blur=${this.save.flush}
      ></textarea>
    `;
  }

  private onInput = (event: Event) => {
    this.text = (event.target as HTMLTextAreaElement).value;
    this.save(this.text);
  };
}

customElements.define('tarn-notes', TarnNotes);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-notes': TarnNotes;
  }
}
