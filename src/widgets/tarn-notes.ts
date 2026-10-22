/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html} from 'lit';
import {
  debounce,
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {mergeText, shiftCaret} from './merge';
import {widgetStyles} from './styles';
import {LocaleController, t} from '../i18n';

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
  /** The text as last loaded or saved here: what typing started from. */
  private base = '';
  private unwatch: () => void = () => {};
  private save = debounce((text: string) => {
    this.base = text;
    void saveWidgetData(this.widgetId, text);
  }, 400);

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgetId = '';
    this.heading = t('widget.notes');
    this.text = '';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.text = this.base = peekWidgetData(this.widgetId, normalize);
    void loadWidgetData(this.widgetId, normalize).then(text =>
      this.adopt(text),
    );
    this.unwatch = watchWidgetData(this.widgetId, normalize, text =>
      this.adopt(text),
    );
    window.addEventListener('pagehide', this.save.flush);
  }

  /**
   * Another tab's text (or what's stored). With nothing typed here since
   * the last save, it simply shows, even with the cursor in the note (it
   * stays there after switching tabs); typing not yet saved is merged
   * with it, never dropped. The caret keeps its place in the text.
   */
  private async adopt(stored: string): Promise<void> {
    const before = this.text;
    const next = mergeText(this.base, before, stored);
    this.base = stored;
    if (next !== stored) this.save(next);
    if (next === before) return;
    const field = this.renderRoot.querySelector('textarea');
    const focused = field !== null && this.shadowRoot?.activeElement === field;
    const [start, end] = focused
      ? [field.selectionStart, field.selectionEnd]
      : [0, 0];
    this.text = next;
    if (!focused) return;
    await this.updateComplete;
    field.setSelectionRange(
      shiftCaret(before, next, start),
      shiftCaret(before, next, end),
    );
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
        placeholder=${t('notes.placeholder')}
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
