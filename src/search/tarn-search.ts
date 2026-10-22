/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, nothing, svg, type PropertyValues} from 'lit';
import {browser} from 'wxt/browser';
import {LocaleController, locale, t} from '../i18n';
import {aiModeOn, type SearchSettings} from '../settings/schema';
import {isComposing} from '../app/shortcuts';
import {addressUrl} from './address';

// The search box under the clock, shaped and behaving like the browser's
// own new-tab search box (a pill with a soft shadow, gray icons, a
// dropdown that joins onto it). Written for Tarn; nothing is copied.
//
// - Enter searches with the browser's default engine (the `search`
//   permission: chrome.search / browser.search), or opens a typed address
//   (./address.ts). Tarn never picks or changes the engine. A bookmark
//   opens only when picked with the arrow keys or the pointer.
// - While typing: a typed address to open, the search itself, matching
//   bookmarks (offline), and AI Mode when that's on.
// - The buttons do something only when pressed. The mic listens right in
//   the box (it turns red, a voice line follows the level, the words
//   appear) and turns speech into text with the browser's recognition
//   (Chrome sends the audio to Google for that, the same as Google's own
//   voice search). The camera opens a Google Lens box on the page; an
//   image goes to Google Lens only when the user drops, picks or pastes
//   one. AI Mode opens Google's AI Mode with the question.
//
// Looks: 'auto' follows the computer's light or dark mode like the
// browser's box; 'light' and 'dark' fix one; 'glass' is frosted like the
// widgets (drawn by the scene when there are widgets: tarn-app adds the
// box to the frosted shapes; otherwise CSS blur).

interface Suggestion {
  readonly kind: 'site' | 'bookmark' | 'search' | 'ai';
  readonly label: string;
  readonly detail: string;
  readonly url?: string;
}

const AI_MODE = {
  home: 'https://www.google.com/search?udm=50',
  ask: (q: string) =>
    `https://www.google.com/search?udm=50&q=${encodeURIComponent(q)}`,
};

/** Google Lens: an uploaded image, or an image's address. */
const LENS_UPLOAD = () =>
  `https://lens.google.com/v3/upload?ep=ccm&re=df&s=4&st=${Date.now()}&hl=${encodeURIComponent(locale())}`;
const LENS_BY_URL = (url: string) =>
  `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}&hl=${encodeURIComponent(locale())}`;

const MAX_BOOKMARKS = 6;

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((event: {
        results: ArrayLike<
          ArrayLike<{transcript: string}> & {isFinal: boolean}
        >;
      }) => void)
    | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null;
};

const SpeechRecognitionCtor =
  (
    globalThis as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    }
  ).SpeechRecognition ??
  (globalThis as unknown as {webkitSpeechRecognition?: new () => Recognition})
    .webkitSpeechRecognition;

const ICON = {
  search: svg`<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>`,
  mic: svg`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>`,
  lens: svg`<path d="M4 8.5V7a3 3 0 0 1 3-3h1.5M15.5 4H17a3 3 0 0 1 3 3v1.5M20 15.5V17a3 3 0 0 1-3 3h-1.5M8.5 20H7a3 3 0 0 1-3-3v-1.5"/><circle cx="12" cy="12" r="3.2"/>`,
  spark: svg`<path d="M12 3.5l1.8 4.9 4.9 1.8-4.9 1.8L12 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z"/><path d="M18.3 15.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>`,
  arrow: svg`<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/>`,
  star: svg`<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>`,
  close: svg`<path d="M6 6l12 12M18 6L6 18"/>`,
  image: svg`<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 2.5-2.5L20 18"/>`,
};

const icon = (name: keyof typeof ICON) =>
  html`<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

/** What the voice screen says. */
type Voice = 'off' | 'listening' | 'heard' | 'noSpeech' | 'denied' | 'failed';

export class TarnSearch extends LitElement {
  static override properties = {
    settings: {attribute: false},
    glass: {reflect: true},
    query: {state: true},
    suggestions: {state: true},
    selected: {state: true},
    open: {state: true},
    voice: {state: true},
    heard: {state: true},
    lens: {state: true},
    lensError: {state: true},
    dropping: {state: true},
    levels: {state: true},
    editing: {type: Boolean, reflect: true},
    confirming: {state: true},
  };

  static override styles = css`
    /* Light, as the browser's own box. */
    :host,
    :host([look='light']) {
      --box: #ffffff;
      --box-ink: #202124;
      --box-dim: #5f6368;
      --box-hover: #f1f3f4;
      --box-line: #e8eaed;
      --box-edge: transparent;
      --box-shadow: 0 1px 6px rgb(32 33 36 / 0.28);
      --box-shadow-hover: 0 1px 6px rgb(32 33 36 / 0.36);
      --box-shadow-open: 0 4px 6px rgb(32 33 36 / 0.28);
      --box-blur: none;
      --open-bg: var(--box);
      --accent: #1a73e8;
      --listening: #ea4335;
    }

    /* Dark, as the browser's own box in dark mode. */
    :host([look='dark']) {
      --box: #303134;
      --box-ink: #e8eaed;
      --box-dim: #9aa0a6;
      --box-hover: #3c4043;
      --box-line: #5f6368;
      --box-shadow: 0 1px 6px rgb(0 0 0 / 0.4);
      --box-shadow-hover: 0 1px 6px rgb(0 0 0 / 0.5);
      --box-shadow-open: 0 4px 6px rgb(0 0 0 / 0.4);
      --accent: #8ab4f8;
      --listening: #f28b82;
    }

    /* Auto: the browser's box in Tarn's appearance (light-dark pairs). */
    :host([look='auto']) {
      --box: light-dark(#ffffff, #303134);
      --box-ink: light-dark(#202124, #e8eaed);
      --box-dim: light-dark(#5f6368, #9aa0a6);
      --box-hover: light-dark(#f1f3f4, #3c4043);
      --box-line: light-dark(#e8eaed, #5f6368);
      --box-shadow: 0 1px 6px light-dark(rgb(32 33 36 / 0.28), rgb(0 0 0 / 0.4));
      --box-shadow-hover: 0 1px 6px
        light-dark(rgb(32 33 36 / 0.36), rgb(0 0 0 / 0.5));
      --box-shadow-open: 0 4px 6px
        light-dark(rgb(32 33 36 / 0.28), rgb(0 0 0 / 0.4));
      --accent: light-dark(#1a73e8, #8ab4f8);
      --listening: light-dark(#ea4335, #f28b82);
    }

    /* Frosted, like the widgets. The scene draws the frost (glass="shader")
       or CSS blurs it (glass="css"); open, it turns solid to read. */
    :host([look='glass']) {
      --box: var(--tile-fill, rgb(255 255 255 / 0.06));
      --box-ink: var(--ink, #f4f7fb);
      --box-dim: var(--ink-dim, rgb(244 247 251 / 0.66));
      --box-hover: var(--chip, rgb(255 255 255 / 0.14));
      --box-line: var(--tile-line, rgb(255 255 255 / 0.14));
      --box-edge: var(--tile-line, rgb(255 255 255 / 0.14));
      --box-shadow: inset 0 1px 0 var(--tile-highlight, rgb(255 255 255 / 0.08));
      --box-shadow-hover: var(--box-shadow);
      --box-shadow-open: 0 18px 40px rgb(0 0 0 / 0.3);
      --open-bg: var(--tile-held, rgb(20 25 34 / 0.92));
      --accent: var(--ink, #f4f7fb);
      --listening: #ff8a80;
    }

    :host([look='glass'][glass='css']) {
      --box: var(--tile-fill-solid, rgb(255 255 255 / 0.1));
      --box-blur: blur(18px) saturate(1.2);
    }

    :host {
      position: relative;
      z-index: 5;
      display: block;
      /* As wide as four widget columns (4 x 136 + 3 x 24), so its edges
         line up with the tiles below; on a 6-column page it spans the
         middle four. Narrower windows have 3 or 2 columns, and so does it
         (the widths match columnsFor in layout/bands.ts); a window
         narrower than two columns gets a box that fits it. With 3
         columns the widgets may still use 2, and it follows them. */
      width: 616px;
      font-family: var(--font-sans);
      text-shadow: none;
    }

    @media (max-width: 663.98px) {
      :host {
        width: clamp(296px, var(--tarn-grid-width, 456px), 456px);
      }
    }

    @media (max-width: 503.98px) {
      :host {
        width: min(296px, 100vw - 32px);
      }
    }

    svg {
      flex: none;
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .field {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      height: 46px;
      padding: 0 6px 0 16px;
      color: var(--box-ink);
      background: var(--box);
      border: 1px solid var(--box-edge);
      border-radius: 23px;
      box-shadow: var(--box-shadow);
      backdrop-filter: var(--box-blur);
      cursor: text;
    }

    .field:hover {
      box-shadow: var(--box-shadow-hover);
    }

    :host([open]) .field {
      background: var(--open-bg);
      border-radius: 23px 23px 0 0;
      box-shadow: var(--box-shadow-open);
    }

    .field > svg {
      color: var(--box-dim);
    }

    input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      font: inherit;
      font-size: 16px;
      color: var(--box-ink);
      background: transparent;
      border: 0;
      outline: none;
    }

    input::placeholder {
      color: var(--box-dim);
    }

    input::-webkit-search-cancel-button {
      display: none;
    }

    .tools {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .tool {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      color: var(--box-dim);
      background: transparent;
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .tool:hover {
      background: var(--box-hover);
    }

    .ai {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      margin-left: 4px;
      padding: 0 12px;
      font: inherit;
      font-size: 13.5px;
      font-weight: 500;
      color: var(--box-ink);
      background: var(--box-hover);
      border: 0;
      border-radius: 16px;
      cursor: pointer;
    }

    .ai svg {
      width: 16px;
      height: 16px;
    }

    button:focus-visible,
    .drop:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }

    .list {
      position: absolute;
      top: 46px;
      right: 0;
      left: 0;
      margin: 0;
      padding: 0 0 12px;
      overflow: hidden;
      color: var(--box-ink);
      list-style: none;
      background: var(--open-bg);
      border: 1px solid var(--box-edge);
      border-top: 0;
      border-radius: 0 0 23px 23px;
      box-shadow: var(--box-shadow-open);
      backdrop-filter: var(--box-blur);
    }

    :host([look='glass']) .list,
    :host([look='glass'][open]) .field {
      backdrop-filter: blur(28px) saturate(1.2);
    }

    /* The line that joins the dropdown to the box. */
    .list::before {
      content: '';
      display: block;
      height: 1px;
      margin: 0 18px 6px;
      background: var(--box-line);
    }

    /* Slim rows like Google's, icons and text lined up with the box's. */
    li {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 34px;
      padding: 0 16px;
      font-size: 15px;
      cursor: pointer;
    }

    li:hover,
    li[aria-selected='true'] {
      background: var(--box-hover);
    }

    li > svg,
    li > img {
      color: var(--box-dim);
    }

    li > img {
      flex: none;
      width: 18px;
      height: 18px;
      margin: 1px;
    }

    .text {
      display: flex;
      flex: 1;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }

    .label {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .detail {
      flex: 0 10 auto;
      min-width: 0;
      overflow: hidden;
      font-size: 13px;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--box-dim);
    }

    /* ---- Google Lens, on the page: over the box, like Google's own ---- */

    .lens {
      position: absolute;
      top: -10px;
      right: -10px;
      left: -10px;
      z-index: 2;
      display: grid;
      gap: 14px;
      padding: 14px 20px 20px;
      color: var(--box-ink);
      background: var(--open-bg);
      border: 1px solid var(--box-edge);
      border-radius: 24px;
      box-shadow: 0 8px 28px rgb(0 0 0 / 0.28);
      backdrop-filter: var(--box-blur);
      animation: rise 160ms ease-out both;
    }

    :host([look='glass']) .lens {
      backdrop-filter: blur(28px) saturate(1.2);
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(4px) scale(0.99);
      }
    }

    .lens-head {
      display: grid;
      grid-template-columns: 40px 1fr 40px;
      align-items: center;
    }

    .lens-head h2 {
      grid-column: 2;
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      text-align: center;
    }

    .lens-head .tool {
      grid-column: 3;
    }

    .drop {
      display: grid;
      place-items: center;
      gap: 10px;
      min-height: 150px;
      padding: 16px;
      text-align: center;
      background: var(--box-hover);
      border: 1px dashed var(--box-line);
      border-radius: 12px;
      cursor: pointer;
    }

    .drop.over {
      border-color: var(--accent);
      border-style: solid;
    }

    .drop svg {
      width: 40px;
      height: 40px;
      color: var(--box-dim);
      stroke-width: 1.4;
    }

    .drop .link {
      color: var(--accent);
      font-weight: 500;
    }

    .or {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--box-dim);
    }

    .or::before,
    .or::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--box-line);
    }

    .by-url {
      display: flex;
      gap: 8px;
    }

    .by-url input {
      height: 40px;
      padding: 0 16px;
      font-size: 14px;
      background: var(--box-hover);
      border: 1px solid var(--box-line);
      border-radius: 20px;
    }

    .by-url input:focus {
      border-color: var(--accent);
    }

    .by-url button {
      flex: none;
      height: 40px;
      padding: 0 18px;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      color: var(--accent);
      background: transparent;
      border: 1px solid var(--box-line);
      border-radius: 20px;
      cursor: pointer;
    }

    .lens-error {
      margin: -4px 0 0;
      font-size: 13px;
      color: var(--listening);
      text-align: center;
    }

    /* ---- Voice: in the box. The mic turns red and a voice line moves
       where the search icon was, following the voice's level. ---- */

    .tool.listening,
    .tool.listening:hover {
      color: #fff;
      background: var(--listening);
      animation: breathe 1.6s ease-in-out infinite;
    }

    @keyframes breathe {
      50% {
        box-shadow: 0 0 0 6px
          color-mix(in srgb, var(--listening) 22%, transparent);
      }
    }

    .wave {
      display: flex;
      flex: none;
      align-items: center;
      gap: 2px;
      width: 20px;
      height: 20px;
    }

    .wave i {
      flex: 1;
      height: 100%;
      border-radius: 2px;
      background: var(--listening);
      transform: scaleY(var(--level, 0.2));
      transition: transform 90ms linear;
    }

    /* No level to follow (no microphone stream): a gentle made-up one. */
    .wave.idle i {
      animation: bars 1s ease-in-out infinite;
    }

    .wave.idle i:nth-child(2) {
      animation-delay: 0.15s;
    }

    .wave.idle i:nth-child(3) {
      animation-delay: 0.3s;
    }

    .wave.idle i:nth-child(4) {
      animation-delay: 0.45s;
    }

    @keyframes bars {
      0%,
      100% {
        transform: scaleY(0.25);
      }
      50% {
        transform: scaleY(0.9);
      }
    }

    :host([listening]) input::placeholder {
      color: var(--box-ink);
    }

    /* Read out, not shown: the box shows it as its placeholder. */
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /* Edit mode (settings open): a holder on the box's top edge with
       Remove, like each widget's, so the box goes the way they do. */
    .holder {
      position: absolute;
      top: 0;
      left: 50%;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 2px;
      height: 26px;
      padding: 0 3px 0 11px;
      translate: -50% -50%;
      font: 500 12px var(--font-sans);
      color: var(--ink);
      white-space: nowrap;
      background: var(--tile-held, rgb(20 25 34 / 0.86));
      border: 1px solid
        color-mix(in srgb, var(--tile-line, rgb(255 255 255 / 0.14)), white 35%);
      border-radius: 999px;
      box-shadow: 0 4px 14px rgb(0 0 0 / 0.22);
      animation: holder-in 200ms ease-out both;
    }

    .holder span {
      padding-right: 3px;
    }

    .holder button {
      display: grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      font: inherit;
      font-size: 14px;
      line-height: 1;
      color: var(--ink-dim);
      background: transparent;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }

    .holder button:hover {
      color: var(--ink);
      background: var(--chip-hover);
    }

    .holder button:focus-visible {
      outline: 2px solid var(--focus-ring, #8ab4f8);
      outline-offset: 1px;
    }

    /* Second press removes. */
    .holder button.confirm {
      padding: 0 9px;
      font-size: 12px;
      color: #fff;
      background: rgb(214 64 69 / 0.92);
    }

    @keyframes holder-in {
      from {
        opacity: 0;
        translate: -50% -30%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tool.listening,
      .wave.idle i,
      .lens,
      .holder {
        animation: none;
      }
    }
  `;

  declare settings: SearchSettings;
  /** Where the frost comes from in the glass look: the scene, or CSS. */
  declare glass: 'shader' | 'css';
  declare query: string;
  declare suggestions: Suggestion[];
  declare selected: number;
  declare open: boolean;
  declare voice: Voice;
  /** What the voice screen has heard so far. */
  declare heard: string;
  /** The Google Lens box is open. */
  declare lens: boolean;
  declare lensError: string;
  /** An image is being dragged over the Lens box. */
  declare dropping: boolean;
  /** The microphone stream the voice line follows, while listening. */
  declare levels: {stream: MediaStream; audio: AudioContext} | null;
  /** The settings panel is open: the box shows Remove, like the widgets. */
  declare editing: boolean;
  /** Remove was pressed once; a second press within 3 s removes. */
  declare confirming: boolean;
  private confirmTimer = 0;

  private lookup = 0;
  /** The text the dropdown's rows were made for. */
  private suggestedFor = '';
  private recognition: Recognition | null = null;
  private levelFrame = 0;
  private messageTimer = 0;

  constructor() {
    super();
    new LocaleController(this);
    this.settings = {
      show: true,
      style: 'auto',
      voice: true,
      lens: true,
      ai: 'off',
    };
    this.glass = 'shader';
    this.editing = false;
    this.confirming = false;
    this.query = '';
    this.suggestions = [];
    this.selected = 0;
    this.open = false;
    this.voice = 'off';
    this.heard = '';
    this.lens = false;
    this.lensError = '';
    this.dropping = false;
    this.levels = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.onDocumentKey);
    document.addEventListener('paste', this.onPaste);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.onDocumentKey);
    document.removeEventListener('paste', this.onPaste);
    this.stopVoice();
    clearTimeout(this.confirmTimer);
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open')) this.toggleAttribute('open', this.open);
    if (changed.has('voice')) {
      this.toggleAttribute(
        'listening',
        this.voice === 'listening' || this.voice === 'heard',
      );
    }
    if (changed.has('settings')) this.setAttribute('look', this.settings.style);
  }

  /** The edit-mode holder: the box's name and Remove (press twice). */
  private holder() {
    const name = t('panel.page.search');
    return html`<div class="holder">
      <span>${name}</span>
      <button
        class=${this.confirming ? 'confirm' : ''}
        aria-label=${
          this.confirming
            ? t('board.confirmRemove', {name})
            : t('board.removeWidget', {name})
        }
        title=${t('common.remove')}
        @click=${this.askRemove}
      >
        ${this.confirming ? t('common.remove') : '×'}
      </button>
    </div>`;
  }

  /**
   * First press asks; a second press within 3 s hides the box (the app
   * saves `search.show`; Settings > Search brings it back).
   */
  private askRemove = (event: Event) => {
    event.stopPropagation();
    clearTimeout(this.confirmTimer);
    if (!this.confirming) {
      this.confirming = true;
      this.confirmTimer = window.setTimeout(
        () => (this.confirming = false),
        3000,
      );
      return;
    }
    this.confirming = false;
    this.dispatchEvent(
      new CustomEvent('tarn-remove-search', {bubbles: true, composed: true}),
    );
  };

  override render() {
    const {voice, lens} = this.settings;
    const listening = this.voice === 'listening' || this.voice === 'heard';
    const message = this.voiceMessage();
    const active = this.open && this.suggestions[this.selected];
    return html`
      ${this.editing ? this.holder() : nothing}
      <div class="field" @click=${this.focusInput}>
        ${
          listening
            ? html`<span
                class="wave ${this.levels ? '' : 'idle'}"
                aria-hidden="true"
                ><i></i><i></i><i></i><i></i
              ></span>`
            : icon('search')
        }
        <input
          type="search"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="search"
          role="combobox"
          aria-expanded=${this.open}
          aria-controls="list"
          aria-autocomplete="list"
          aria-activedescendant=${active ? `opt-${this.selected}` : nothing}
          aria-label=${t('search.placeholder')}
          placeholder=${this.placeholder()}
          ?readonly=${listening || message}
          .value=${listening ? this.heard : message ? '' : this.query}
          @input=${this.onInput}
          @keydown=${this.onKey}
          @focus=${this.onFocus}
          @blur=${() => (this.open = false)}
        />
        <div class="tools">
          ${
            voice && SpeechRecognitionCtor
              ? html`<button
                  class=${listening ? 'tool listening' : 'tool'}
                  title=${
                    this.voice === 'denied'
                      ? t('search.micDeniedHint')
                      : listening
                        ? t('search.stopListening')
                        : t('search.voice')
                  }
                  aria-label=${listening ? t('search.stopListening') : t('search.voice')}
                  aria-pressed=${listening}
                  @click=${listening ? this.finishVoice : this.startVoice}
                >
                  ${icon('mic')}
                </button>`
              : nothing
          }
          ${
            lens
              ? html`<button
                  class="tool lens-button"
                  title=${t('search.lens')}
                  aria-label=${t('search.lens')}
                  aria-haspopup="dialog"
                  @click=${this.openLens}
                >
                  ${icon('lens')}
                </button>`
              : nothing
          }
          ${
            aiModeOn(this.settings)
              ? html`<button
                  class="ai"
                  title=${t('search.aiMode')}
                  @click=${() => this.ask(this.query.trim())}
                >
                  ${icon('spark')}${t('search.aiMode')}
                </button>`
              : nothing
          }
        </div>
      </div>
      ${
        this.open
          ? html`<ul class="list" id="list" role="listbox">
              ${this.suggestions.map((s, i) => this.row(s, i))}
            </ul>`
          : nothing
      }
      <span class="sr" role="status">${message}</span>
      ${this.lens ? this.renderLens() : nothing}
    `;
  }

  private row(s: Suggestion, index: number) {
    const lead =
      s.kind === 'bookmark' && s.url && !import.meta.env.FIREFOX
        ? html`<img
            alt=""
            src=${`/_favicon/?pageUrl=${encodeURIComponent(s.url)}&size=32`}
          />`
        : icon(
            s.kind === 'site'
              ? 'arrow'
              : s.kind === 'ai'
                ? 'spark'
                : s.kind === 'bookmark'
                  ? 'star'
                  : 'search',
          );
    return html`<li
      id="opt-${index}"
      role="option"
      aria-selected=${index === this.selected}
      @pointerdown=${(event: PointerEvent) => {
        event.preventDefault();
        this.choose(index);
      }}
    >
      ${lead}
      <span class="text">
        <span class="label">${s.label}</span>
        <span class="detail">${s.detail}</span>
      </span>
    </li>`;
  }

  private focusInput = (event: Event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    this.renderRoot.querySelector<HTMLInputElement>('.field input')?.focus();
  };

  private onFocus = () => {
    // Back in the box: a voice message gives way to the text typed before.
    if (this.voiceMessage()) this.voice = 'off';
    this.open = this.suggestions.length > 0;
  };

  private onInput = (event: Event) => {
    this.query = (event.target as HTMLInputElement).value;
    void this.suggest();
  };

  /** What the dropdown offers for the text typed so far. */
  private async suggest(): Promise<void> {
    const text = this.query.trim();
    const id = ++this.lookup;
    if (!text) {
      this.suggestions = [];
      this.suggestedFor = '';
      this.open = false;
      return;
    }
    // Row 0 is what Enter does: open the typed address, or search.
    const rows: Suggestion[] = [];
    const site = addressUrl(text);
    if (site) {
      rows.push({
        kind: 'site',
        label: text.replace(/^https?:\/\//, ''),
        detail: t('search.openSite'),
        url: site,
      });
    }
    rows.push({kind: 'search', label: text, detail: t('search.searchWeb')});
    for (const mark of await findBookmarks(text)) {
      rows.push({
        kind: 'bookmark',
        label: mark.title,
        detail: host(mark.url),
        url: mark.url,
      });
    }
    if (aiModeOn(this.settings)) {
      rows.push({kind: 'ai', label: text, detail: t('search.aiMode')});
    }
    if (id !== this.lookup) return;
    this.suggestions = rows;
    this.suggestedFor = text;
    this.selected = 0;
    const input = this.renderRoot.querySelector('.field input');
    this.open =
      rows.length > 0 &&
      (this.renderRoot as ShadowRoot).activeElement === input;
  }

  private onKey = (event: KeyboardEvent) => {
    if (isComposing(event)) return;
    if (this.voiceMessage()) this.voice = 'off';
    const last = this.suggestions.length - 1;
    if (event.key === 'ArrowDown' && this.open) {
      event.preventDefault();
      this.selected = this.selected >= last ? 0 : this.selected + 1;
    } else if (event.key === 'ArrowUp' && this.open) {
      event.preventDefault();
      this.selected = this.selected <= 0 ? last : this.selected - 1;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const text = this.query.trim();
      // Rows still made for earlier text (bookmarks are async) don't count.
      if (
        this.open &&
        this.suggestedFor === text &&
        this.suggestions[this.selected]
      ) {
        this.choose(this.selected);
      } else if (text) {
        const site = addressUrl(text);
        if (site) this.navigate(site);
        else void this.search(text);
      }
    } else if (event.key === 'Escape') {
      if (this.open) this.open = false;
      else this.query = '';
    }
  };

  /** Puts the cursor in the box (Cmd/Ctrl+K or /). */
  focusBox(): void {
    this.renderRoot.querySelector<HTMLInputElement>('.field input')?.focus();
  }

  private choose(index: number): void {
    const s = this.suggestions[index];
    if (!s) return;
    if (s.kind === 'search') void this.search(s.label);
    else if (s.kind === 'ai') this.ask(s.label);
    else if (s.url) this.navigate(s.url);
  }

  /** The browser's own search, with its default engine. */
  private async search(text: string): Promise<void> {
    const api = typeof browser !== 'undefined' ? browser?.search : undefined;
    try {
      if (import.meta.env.FIREFOX) {
        await (
          api as unknown as {
            search(options: {
              query: string;
              disposition?: string;
            }): Promise<void>;
          }
        ).search({query: text, disposition: 'CURRENT_TAB'});
      } else {
        await (
          api as unknown as {
            query(options: {text: string; disposition?: string}): Promise<void>;
          }
        ).query({text, disposition: 'CURRENT_TAB'});
      }
    } catch (error) {
      console.warn('[tarn] search failed:', error);
    }
  }

  private ask(text: string): void {
    this.navigate(text ? AI_MODE.ask(text) : AI_MODE.home);
  }

  private navigate(url: string): void {
    location.href = url;
  }

  /** Escape closes whichever box is open over the page. */
  private onDocumentKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (this.voice !== 'off') this.stopVoice();
    else if (this.lens) this.closeLens();
  };

  // ---- Google Lens ----------------------------------------------------------

  private renderLens() {
    return html`<div
      class="lens"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lens-title"
      @keydown=${this.onLensKey}
      @dragover=${(event: DragEvent) => {
        event.preventDefault();
        this.dropping = true;
      }}
      @dragleave=${() => (this.dropping = false)}
      @drop=${this.onDrop}
    >
      <div class="lens-head">
        <h2 id="lens-title">${t('search.lensTitle')}</h2>
        <button
          class="tool"
          title=${t('search.close')}
          aria-label=${t('search.close')}
          @click=${this.closeLens}
        >
          ${icon('close')}
        </button>
      </div>
      <div
        class="drop ${this.dropping ? 'over' : ''}"
        role="button"
        tabindex="0"
        @click=${this.pickImage}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.pickImage();
          }
        }}
      >
        ${icon('image')}
        <span
          >${t('search.lensDrop')}
          <span class="link">${t('search.lensUpload')}</span></span
        >
      </div>
      <div class="or">${t('search.lensOr')}</div>
      <form class="by-url" @submit=${this.onImageLink}>
        <input
          name="url"
          type="url"
          autocomplete="off"
          spellcheck="false"
          placeholder=${t('search.lensLink')}
          aria-label=${t('search.lensLink')}
        />
        <button>${t('search.lensSearch')}</button>
      </form>
      ${this.lensError ? html`<p class="lens-error">${this.lensError}</p>` : nothing}
      <input
        class="file"
        type="file"
        accept="image/*"
        hidden
        @change=${this.onImageFile}
      />
    </div>`;
  }

  /** Opens the Lens box and moves focus into it, onto the drop zone. */
  private openLens = async () => {
    this.open = false;
    this.lensError = '';
    this.lens = true;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>('.lens .drop')?.focus();
  };

  /** Closes the Lens box; focus goes back to the Lens button. */
  private closeLens = () => {
    const inside = this.renderRoot
      .querySelector('.lens')
      ?.matches(':focus-within');
    this.lens = false;
    if (inside) {
      this.renderRoot.querySelector<HTMLElement>('.lens-button')?.focus();
    }
  };

  /** Tab stays inside the Lens box while it is open, like a modal. */
  private onLensKey = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const box = event.currentTarget as HTMLElement;
    const stops = [
      ...box.querySelectorAll<HTMLElement>(
        'button, input:not([hidden]), [tabindex="0"]',
      ),
    ];
    const first = stops[0];
    const last = stops[stops.length - 1];
    const here = (this.renderRoot as ShadowRoot).activeElement;
    if (event.shiftKey && here === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && here === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  private pickImage = () => {
    this.renderRoot.querySelector<HTMLInputElement>('.lens .file')?.click();
  };

  private onImageFile = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.sendToLens(file);
  };

  private onDrop = (event: DragEvent) => {
    event.preventDefault();
    this.dropping = false;
    const file = [...(event.dataTransfer?.files ?? [])].find(f =>
      f.type.startsWith('image/'),
    );
    if (file) {
      this.sendToLens(file);
      return;
    }
    // An image dragged from another page arrives as its address.
    const url = event.dataTransfer?.getData('text/uri-list').split('\n')[0];
    if (url && /^https?:/i.test(url)) this.navigate(LENS_BY_URL(url.trim()));
  };

  /** A pasted image goes to Lens while its box is open. */
  private onPaste = (event: ClipboardEvent) => {
    if (!this.lens) return;
    const file = [...(event.clipboardData?.files ?? [])].find(f =>
      f.type.startsWith('image/'),
    );
    if (file) {
      event.preventDefault();
      this.sendToLens(file);
    }
  };

  private onImageLink = (event: SubmitEvent) => {
    event.preventDefault();
    const value = new FormData(event.target as HTMLFormElement).get('url');
    const url = typeof value === 'string' ? value.trim() : '';
    if (!/^https?:\/\/\S+$/i.test(url)) {
      this.lensError = t('search.lensBadLink');
      return;
    }
    this.navigate(LENS_BY_URL(url));
  };

  /**
   * Sends the image to Google Lens the way its own page does: a form post
   * that opens the results in this tab.
   */
  private sendToLens(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.lensError = t('search.lensNotImage');
      return;
    }
    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = LENS_UPLOAD();
    form.hidden = true;
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'encoded_image';
    const files = new DataTransfer();
    files.items.add(file);
    input.files = files.files;
    form.append(input);
    document.body.append(form);
    form.submit();
  }

  // ---- Voice ------------------------------------------------------------------

  /** What went wrong with voice, while that message shows; else ''. */
  private voiceMessage(): string {
    return this.voice === 'noSpeech' ||
      this.voice === 'denied' ||
      this.voice === 'failed'
      ? this.placeholder()
      : '';
  }

  /** What the box says: the usual hint, "Speak now", or what went wrong. */
  private placeholder(): string {
    switch (this.voice) {
      case 'listening':
      case 'heard':
        return t('search.speakNow');
      case 'noSpeech':
        return t('search.noSpeech');
      case 'denied':
        return t('search.micDenied');
      case 'failed':
        return t('search.voiceFailed');
      default:
        return t('search.placeholder');
    }
  }

  /**
   * Listens in the box: the mic turns red, a voice line follows the level,
   * and the words appear as they're heard; then it searches like Enter.
   * The text comes from the browser's speech recognition.
   */
  private startVoice = () => {
    if (!SpeechRecognitionCtor) return;
    this.recognition?.abort();
    this.open = false;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = locale();
    recognition.interimResults = true;
    recognition.continuous = false;
    let final = '';
    recognition.onresult = event => {
      const results = Array.from(event.results);
      this.heard = results.map(result => result[0]?.transcript ?? '').join('');
      this.voice = 'heard';
      if (results.every(result => result.isFinal)) final = this.heard.trim();
    };
    recognition.onerror = event => {
      this.voice =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'denied'
          : event.error === 'no-speech'
            ? 'noSpeech'
            : event.error === 'aborted'
              ? this.voice
              : 'failed';
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      this.recognition = null;
      this.stopLevel();
      if (final) {
        this.voice = 'off';
        this.query = final;
        void this.search(final);
      } else if (this.voice === 'listening' || this.voice === 'heard') {
        this.voice = 'noSpeech';
      }
      // A message stays a few seconds, then the box is itself again.
      if (this.voice !== 'off') {
        clearTimeout(this.messageTimer);
        this.messageTimer = window.setTimeout(() => {
          if (!this.recognition) this.voice = 'off';
        }, 4000);
      }
    };
    this.recognition = recognition;
    this.heard = '';
    this.voice = 'listening';
    try {
      recognition.start();
      void this.followLevel();
    } catch {
      this.voice = 'failed';
    }
  };

  /**
   * The voice line: the microphone's level, read with Web Audio while
   * listening (the browser already has the microphone for recognition).
   * Without it, the line moves on its own.
   */
  private async followLevel(): Promise<void> {
    this.stopLevel();
    // The listening this microphone is for: a stop, or a new start while
    // the browser was still asking, makes it stale.
    const mine = this.recognition;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (!mine || this.recognition !== mine) {
        stopTracks(stream);
        return;
      }
      this.stopLevel();
      const audio = new AudioContext();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 64;
      audio.createMediaStreamSource(stream).connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const step = () => {
        analyser.getByteFrequencyData(bins);
        const bars = this.renderRoot.querySelectorAll<HTMLElement>('.wave i');
        bars.forEach((bar, i) => {
          // Speech lives in the low bins; spread four bars across them.
          const value = (bins[2 + i * 3] ?? 0) / 255;
          bar.style.setProperty('--level', String(0.2 + 0.8 * value));
        });
        this.levelFrame = requestAnimationFrame(step);
      };
      this.levels = {stream, audio};
      this.levelFrame = requestAnimationFrame(step);
    } catch {
      if (stream && this.levels?.stream !== stream) stopTracks(stream);
    }
  }

  private stopLevel(): void {
    cancelAnimationFrame(this.levelFrame);
    if (this.levels) {
      stopTracks(this.levels.stream);
      void this.levels.audio.close();
    }
    this.levels = null;
  }

  /** The mic again: stop listening and use what was heard. */
  private finishVoice = () => {
    this.recognition?.stop();
  };

  private stopVoice = () => {
    const recognition = this.recognition;
    this.recognition = null;
    recognition?.abort();
    this.stopLevel();
    this.voice = 'off';
  };
}

/** Lets the microphone go: the browser's recording dot turns off. */
function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Bookmarks whose title or address matches, from the browser's own. */
async function findBookmarks(
  text: string,
): Promise<{title: string; url: string}[]> {
  const api = typeof browser !== 'undefined' ? browser?.bookmarks : undefined;
  if (!api?.search) return [];
  try {
    const found = await api.search(text);
    const seen = new Set<string>();
    const marks: {title: string; url: string}[] = [];
    for (const node of found) {
      if (!node.url || !/^https?:/i.test(node.url) || seen.has(node.url)) {
        continue;
      }
      seen.add(node.url);
      marks.push({title: node.title || host(node.url), url: node.url});
      if (marks.length === MAX_BOOKMARKS) break;
    }
    return marks;
  } catch {
    return [];
  }
}

customElements.define('tarn-search', TarnSearch);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-search': TarnSearch;
  }
}
