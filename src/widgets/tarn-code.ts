/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {keyed} from 'lit/directives/keyed.js';
import {loadWidgetData, peekWidgetData, watchWidgetData} from './data';
import {widgetStyles} from './styles';
import {DEFAULT_CODE} from './code/examples';
import type {TileState} from './code/renderer';
import {normalizeCode, type CodeContent} from './code/source';
import {codeStage} from './code/stage';
import {LocaleController, t} from '../i18n';

const normalize = (raw: unknown) => normalizeCode(raw, DEFAULT_CODE);

/**
 * A custom widget: the user's own shader, drawn edge to edge in its tile
 * (docs/widgets.md, "Custom"). The code is edited in the settings panel;
 * every open tab follows. Set `code` to show code that isn't stored (the
 * panel's examples and editor preview).
 */
export class TarnCode extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    heading: {attribute: false},
    code: {attribute: false},
    content: {state: true},
    tileState: {state: true},
    drawn: {state: true},
    canvasKey: {state: true},
  };

  static override styles = [
    widgetStyles,
    css`
      :host {
        position: relative;
        padding: 0;
      }

      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity 200ms ease-out;
      }

      canvas.drawn {
        opacity: 1;
      }

      .say {
        position: absolute;
        inset: auto 12px 12px;
        display: grid;
        justify-items: start;
        gap: 6px;
        font-size: 12px;
        line-height: 1.35;
        color: var(--ink-dim);
      }

      .error {
        max-height: calc(100% - 24px);
        overflow: hidden;
        padding: 7px 9px;
        font:
          11px/1.35 ui-monospace,
          'SF Mono',
          Menlo,
          monospace;
        color: var(--ink);
        text-shadow: none;
        background: rgb(200 40 40 / 0.28);
        border-radius: 10px;
      }

      .say button {
        padding: 4px 10px;
        font-size: 12px;
        background: var(--chip);
        border: 0;
        border-radius: 999px;
        cursor: pointer;
      }

      .say button:hover {
        background: var(--chip-hover);
      }
    `,
  ];

  declare widgetId: string;
  /** Its name: the label for its picture. Custom widgets draw no title. */
  declare heading: string;
  /** Code to show instead of the stored code. */
  declare code: string | undefined;
  declare content: CodeContent;
  declare tileState: TileState;
  declare drawn: boolean;
  /** A canvas is the renderer's once given; a moved element needs a new one. */
  declare canvasKey: number;
  private tileId: string | null = null;
  private attached: HTMLCanvasElement | null = null;
  private sentCode: string | null = null;
  private unwatch: () => void = () => {};
  private resize = new ResizeObserver(() => this.sendSize());
  private mouse: StageMouse | null = null;
  private mouseFrame = 0;

  constructor() {
    super();
    new LocaleController(this);
    this.widgetId = '';
    this.heading = t('widget.code');
    this.code = undefined;
    this.content = normalize(undefined);
    this.tileState = {state: 'ok'};
    this.drawn = false;
    this.canvasKey = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.attached) this.canvasKey++;
    if (this.code === undefined && this.widgetId) {
      this.content = peekWidgetData(this.widgetId, normalize);
      void loadWidgetData(this.widgetId, normalize).then(
        content => (this.content = content),
      );
      this.unwatch = watchWidgetData(
        this.widgetId,
        normalize,
        content => (this.content = content),
      );
    }
    this.addEventListener('pointermove', this.onPointer);
    this.addEventListener('pointerdown', this.onPointer);
    this.addEventListener('pointerup', this.onPointer);
    this.addEventListener('pointerleave', this.onLeave);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    this.resize.disconnect();
    cancelAnimationFrame(this.mouseFrame);
    if (this.tileId) codeStage().remove(this.tileId);
    this.tileId = null;
    this.sentCode = null;
    this.drawn = false;
  }

  override render() {
    const lang = this.code === undefined ? this.content.lang : 'glsl';
    if (lang !== 'glsl') {
      return html`<div class="say">${t('code.newer')}</div>`;
    }
    return html`
      ${keyed(
        this.canvasKey,
        html`<canvas
          class=${this.drawn ? 'drawn' : ''}
          role="img"
          aria-label=${this.heading}
        ></canvas>`,
      )}
      ${this.renderState()}
    `;
  }

  private renderState() {
    const state = this.tileState;
    switch (state.state) {
      case 'error': {
        // A broken edit while the last version still draws: the panel
        // shows the error; the tab keeps the picture.
        if (state.running) return nothing;
        const first = state.errors[0];
        return html`<div class="say">
          <div class="error">
            ${
              first?.line
                ? t('code.errorLine', {
                    line: first.line,
                    message: first.message,
                  })
                : first?.message
            }
          </div>
        </div>`;
      }
      case 'missing':
        return html`<div class="say">${t('code.missing')}</div>`;
      case 'heavy':
        return html`<div class="say">
          ${t('code.heavy')}
          <button @click=${this.runAnyway}>${t('code.run')}</button>
        </div>`;
      case 'unavailable':
        return html`<div class="say">${t('code.unavailable')}</div>`;
      default:
        return nothing;
    }
  }

  override updated(): void {
    const canvas = this.renderRoot.querySelector('canvas');
    if (canvas && canvas !== this.attached && this.isConnected) {
      if (this.tileId) codeStage().remove(this.tileId);
      this.attached = canvas;
      this.sentCode = null;
      this.tileId = codeStage().add(canvas, {
        onState: state => {
          this.tileState = state;
          // The panel's editor shows what's wrong under the code.
          this.dispatchEvent(new CustomEvent('code-state', {detail: state}));
        },
        onDrawn: () => (this.drawn = true),
      });
      this.resize.disconnect();
      this.resize.observe(canvas);
      this.sendSize();
    }
    const code = this.code ?? this.content.code;
    if (this.tileId && code !== this.sentCode) {
      this.sentCode = code;
      codeStage().send({type: 'code', id: this.tileId, code});
    }
  }

  private sendSize(): void {
    const canvas = this.attached;
    if (!this.tileId || !canvas) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    codeStage().send({
      type: 'size',
      id: this.tileId,
      width: Math.round(canvas.clientWidth * ratio),
      height: Math.round(canvas.clientHeight * ratio),
    });
  }

  /** The mouse over the tile, sent at most once a frame. */
  private onPointer = (event: PointerEvent) => {
    const rect = this.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    // The board may scale tiles while they settle; count in the tile's own pixels.
    const scale = rect.width ? this.clientWidth / rect.width : 1;
    this.mouse = {
      x: (event.clientX - rect.left) * scale * ratio,
      y: (event.clientY - rect.top) * scale * ratio,
      inside: 1,
      down: event.buttons & 1 ? 1 : 0,
    };
    this.queueMouse();
  };

  private onLeave = () => {
    this.mouse = {x: -1, y: -1, inside: 0, down: 0};
    this.queueMouse();
  };

  private queueMouse(): void {
    if (this.mouseFrame) return;
    this.mouseFrame = requestAnimationFrame(() => {
      this.mouseFrame = 0;
      if (this.tileId && this.mouse) {
        codeStage().send({type: 'mouse', id: this.tileId, ...this.mouse});
      }
    });
  }

  private runAnyway = () => {
    if (this.tileId) codeStage().send({type: 'run', id: this.tileId});
  };
}

interface StageMouse {
  x: number;
  y: number;
  inside: number;
  down: number;
}

customElements.define('tarn-code', TarnCode);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-code': TarnCode;
  }
}
