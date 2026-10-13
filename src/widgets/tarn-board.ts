/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  css,
  html,
  nothing,
  unsafeCSS,
  type PropertyValues,
} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {MAX_COLUMNS, columnsFor} from '../layout/bands';
import type {WidgetEntry} from '../settings/schema';
import {CELL, GAP, PITCH, moveTo, nearestIndex, placeTiles} from './geometry';
import {WIDGETS, renderWidget} from './registry';

export {CELL, GAP} from './geometry';
export const RADIUS = 24;
/** Side margin the page keeps around the widgets. */
const MARGIN = 24;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const MOVE_MS = 460;
/** Tiles fade in quickly, together with the scene's first frame. */
const APPEAR_MS = 200;
/** A press becomes a drag after the pointer moves this far (CSS px). */
const DRAG_SLOP = 4;

/**
 * Where the widgets' rounded rectangles are, for the background to frost
 * behind them: x, y, width, height per tile in viewport CSS pixels.
 */
export interface TilesDetail {
  rects: number[];
  strength: number;
  radius: number;
}

/** The widgets in a new order, after the user dragged or moved one. */
export interface ReorderDetail {
  widgets: WidgetEntry[];
}

interface Drag {
  id: string;
  tile: HTMLElement;
  pointerId: number;
  /** Where the pointer grabbed the tile, from its top-left corner. */
  grabX: number;
  grabY: number;
  startX: number;
  startY: number;
  /** The tile's top-left on the board while dragged. */
  x: number;
  y: number;
  moved: boolean;
  frame: number;
}

/**
 * The widgets, laid out in bands two cells tall (layout/bands.ts) on one
 * shared column grid, centered on the page. Tiles are absolutely placed
 * with transforms, so moving or resizing one animates with transform and
 * opacity only (FLIP).
 *
 * With `editing` (the settings panel is open), widgets can be rearranged:
 * hover lifts a tile, dragging moves it while the others glide into the
 * order it would land in, and the layout rules keep every result neat.
 * Arrow keys do the same for keyboard users. Widget contents are inert
 * meanwhile, so dragging never types into a note or opens a site.
 *
 * Fires `tarn-tiles` whenever tiles move, so the backdrop can draw frosted
 * glass behind them, and `tarn-reorder` with the new order after a move.
 */
export class TarnBoard extends LitElement {
  static override properties = {
    widgets: {attribute: false},
    glass: {type: String, reflect: true},
    instant: {type: Boolean},
    editing: {type: Boolean, reflect: true},
    columns: {state: true},
    preview: {state: true},
    draggingId: {state: true},
    announcement: {state: true},
  };

  static override styles = css`
    :host {
      position: relative;
      display: block;
      --tile-line-strong: color-mix(in srgb, var(--tile-line), white 35%);
    }

    .tile {
      position: absolute;
      left: 0;
      top: 0;
      container-type: size;
      border-radius: ${RADIUS}px;
      border: 1px solid var(--tile-line);
      background: var(--tile-fill);
      box-shadow: inset 0 1px 0 var(--tile-highlight);
      overflow: hidden;
      transform-origin: 0 0;
      outline: none;
    }

    :host([glass='css']) .tile {
      background: var(--tile-fill-solid);
      backdrop-filter: blur(24px) saturate(1.3);
      -webkit-backdrop-filter: blur(24px) saturate(1.3);
    }

    .content,
    .content > * {
      width: 100%;
      height: 100%;
    }

    /* Arranging: tiles lift a little under the pointer or keyboard focus. */
    :host([editing]) .tile {
      cursor: grab;
      touch-action: none;
      user-select: none;
      transition:
        translate 200ms ${unsafeEase()},
        border-color 200ms ease,
        box-shadow 200ms ease;
    }

    :host([editing]) .tile:hover,
    :host([editing]) .tile:focus-visible {
      translate: 0 -3px;
      border-color: var(--tile-line-strong);
      box-shadow:
        inset 0 1px 0 var(--tile-highlight),
        0 10px 28px rgb(0 0 0 / 0.22);
    }

    :host([editing]) .tile:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 3px;
    }

    /* Lifted: frosted on its own (the tiles it passes over blur beneath
       it). The blur only exists while a tile is held. */
    .tile[data-dragging] {
      z-index: 2;
      cursor: grabbing;
      background: var(--tile-fill-solid);
      backdrop-filter: blur(22px) saturate(1.2);
      -webkit-backdrop-filter: blur(22px) saturate(1.2);
      scale: 1.04;
      transform-origin: 50% 50%;
      border-color: var(--tile-line-strong);
      box-shadow:
        inset 0 1px 0 var(--tile-highlight),
        0 22px 48px rgb(0 0 0 / 0.32);
      transition:
        scale 180ms ${unsafeEase()},
        box-shadow 180ms ease;
    }

    .hint {
      position: absolute;
      left: 0;
      right: 0;
      top: -34px;
      margin: 0;
      text-align: center;
      font: 500 13px var(--font-sans);
      color: var(--ink-dim);
      text-shadow: var(--ink-shadow);
      pointer-events: none;
      animation: hint-in 300ms ease-out both;
    }

    @keyframes hint-in {
      from {
        opacity: 0;
      }
    }

    .live {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    @media (prefers-reduced-motion: reduce) {
      :host([editing]) .tile,
      .tile[data-dragging] {
        transition: none;
      }
    }
  `;

  declare widgets: readonly WidgetEntry[];
  declare glass: 'shader' | 'css';
  /** Appear at once, no fade: a reload continues the page exactly. */
  declare instant: boolean;
  /** The settings panel is open: tiles can be dragged into a new order. */
  declare editing: boolean;
  declare columns: number;
  /** The order shown while a drag is under way (or until saved). */
  declare preview: WidgetEntry[] | null;
  declare draggingId: string | null;
  declare announcement: string;

  private queries: MediaQueryList[] = [];
  private lastBoxes = new Map<string, DOMRect>();
  private appearedAt = 0;
  private reporting = 0;
  private drag: Drag | null = null;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    super();
    this.widgets = [];
    this.glass = 'shader';
    this.instant = false;
    this.editing = false;
    this.columns = this.fittingColumns();
    this.preview = null;
    this.draggingId = null;
    this.announcement = '';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The column count only changes at a few window widths: listen to those
    // instead of every resize.
    for (let n = 3; n <= MAX_COLUMNS; n++) {
      const query = matchMedia(
        `(min-width: ${n * PITCH - GAP + 2 * MARGIN}px)`,
      );
      query.addEventListener('change', this.onColumnsChange);
      this.queries.push(query);
    }
    window.addEventListener('resize', this.report);
    this.appearedAt = performance.now();
    this.animateIn();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const query of this.queries) {
      query.removeEventListener('change', this.onColumnsChange);
    }
    this.queries = [];
    window.removeEventListener('resize', this.report);
    cancelAnimationFrame(this.reporting);
    this.reporting = 0;
    this.endDrag(false);
    this.dispatchTiles([], 0);
  }

  /** Reports where the tiles are now, e.g. after the page scrolls. */
  report = () => {
    const tiles = [...this.renderRoot.querySelectorAll<HTMLElement>('.tile')];
    const rects: number[] = [];
    for (const tile of tiles) {
      const box = tile.getBoundingClientRect();
      rects.push(box.x, box.y, box.width, box.height);
    }
    const elapsed = performance.now() - this.appearedAt;
    const strength =
      this.instant || this.reduceMotion.matches
        ? 1
        : easeOut(Math.min(1, elapsed / APPEAR_MS));
    this.dispatchTiles(rects, strength);
  };

  override willUpdate(changed: PropertyValues<this>): void {
    // A saved order arrived: the preview has done its job.
    if (changed.has('widgets')) this.preview = null;
    if (changed.has('editing') && !this.editing) this.endDrag(false);
    // FLIP, first: where each tile is before the change.
    if (
      changed.has('widgets') ||
      changed.has('columns') ||
      changed.has('preview') ||
      changed.has('draggingId')
    ) {
      this.lastBoxes.clear();
      for (const tile of this.renderRoot.querySelectorAll<HTMLElement>(
        '.tile',
      )) {
        this.lastBoxes.set(tile.dataset.id!, tile.getBoundingClientRect());
      }
    }
  }

  override render() {
    const list = this.preview ?? this.widgets;
    const {tiles, width, height} = placeTiles(list, this.columns);
    this.style.width = `${width}px`;
    this.style.height = `${height}px`;
    const byId = new Map(list.map(w => [w.id, w]));
    const count = tiles.length;
    return html`
      ${
        this.editing && count > 1
          ? html`<p class="hint">Drag to rearrange</p>`
          : nothing
      }
      ${repeat(
        tiles,
        tile => tile.id,
        (tile, index) => {
          const widget = byId.get(tile.id)!;
          const dragged = this.drag?.moved && this.drag.id === tile.id;
          const x = dragged ? this.drag!.x : tile.x;
          const y = dragged ? this.drag!.y : tile.y;
          const name = WIDGETS[widget.kind]?.name ?? widget.kind;
          return html`
            <div
              class="tile"
              data-id=${tile.id}
              ?data-dragging=${dragged}
              tabindex=${this.editing ? '0' : '-1'}
              role=${this.editing ? 'button' : 'group'}
              aria-roledescription=${this.editing ? 'movable widget' : nothing}
              aria-label=${
                this.editing
                  ? `${name}, ${index + 1} of ${count}. Drag, or use the arrow keys, to move it.`
                  : name
              }
              style="width:${tile.width}px;height:${tile.height}px;transform:translate(${x}px, ${y}px)"
              @pointerdown=${this.onPointerDown}
              @keydown=${this.onTileKey}
            >
              <div class="content" ?inert=${this.editing}>
                ${renderWidget(widget.kind, widget.id)}
              </div>
            </div>
          `;
        },
      )}
      <div class="live" aria-live="polite">${this.announcement}</div>
    `;
  }

  override updated(): void {
    if (this.lastBoxes.size && !this.reduceMotion.matches) this.flip();
    this.lastBoxes.clear();
    this.followTiles();
  }

  /** FLIP, invert and play: each tile glides from its old box to its new one. */
  private flip(): void {
    for (const tile of this.renderRoot.querySelectorAll<HTMLElement>('.tile')) {
      // The dragged tile follows the pointer, not an animation.
      if (tile.hasAttribute('data-dragging')) continue;
      const from = this.lastBoxes.get(tile.dataset.id!);
      const to = tile.getBoundingClientRect();
      const end = tile.style.transform;
      if (!from) {
        tile.animate(
          [
            {opacity: 0, transform: `${end} scale(0.96)`},
            {opacity: 1, transform: end},
          ],
          {duration: MOVE_MS, easing: EASE},
        );
        continue;
      }
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      if (
        Math.abs(dx) < 0.5 &&
        Math.abs(dy) < 0.5 &&
        Math.abs(sx - 1) < 0.01 &&
        Math.abs(sy - 1) < 0.01
      ) {
        continue;
      }
      tile.animate(
        [
          {transform: `translate(${dx}px, ${dy}px) ${end} scale(${sx}, ${sy})`},
          {transform: end},
        ],
        {duration: MOVE_MS, easing: EASE},
      );
    }
  }

  /** Tiles fade in one by one (never the container: see Glass in the doc). */
  private animateIn(): void {
    if (this.instant || this.reduceMotion.matches) return;
    void this.updateComplete.then(() => {
      for (const tile of this.renderRoot.querySelectorAll<HTMLElement>(
        '.tile',
      )) {
        tile.animate([{opacity: 0}, {opacity: 1}], {
          duration: APPEAR_MS,
          easing: 'ease-out',
        });
      }
    });
  }

  /** Reports tile boxes every frame while anything moves, then once more. */
  private followTiles(): void {
    if (this.reporting) return;
    const step = () => {
      this.report();
      const moving =
        this.drag !== null ||
        performance.now() - this.appearedAt < APPEAR_MS ||
        [...this.renderRoot.querySelectorAll('.tile')].some(
          tile => tile.getAnimations().length > 0,
        );
      this.reporting = moving ? requestAnimationFrame(step) : 0;
      if (!moving) this.report();
    };
    this.reporting = requestAnimationFrame(step);
  }

  // ---- Arranging --------------------------------------------------------

  private onPointerDown = (event: PointerEvent) => {
    if (!this.editing || event.button !== 0 || this.drag) return;
    const tile = event.currentTarget as HTMLElement;
    const box = tile.getBoundingClientRect();
    const board = this.getBoundingClientRect();
    this.drag = {
      id: tile.dataset.id!,
      tile,
      pointerId: event.pointerId,
      grabX: event.clientX - box.left,
      grabY: event.clientY - box.top,
      startX: event.clientX,
      startY: event.clientY,
      x: box.left - board.left,
      y: box.top - board.top,
      moved: false,
      frame: 0,
    };
    tile.setPointerCapture(event.pointerId);
    tile.addEventListener('pointermove', this.onPointerMove);
    tile.addEventListener('pointerup', this.onPointerUp);
    tile.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('keydown', this.onDragKey);
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
        DRAG_SLOP
    ) {
      return;
    }
    const board = this.getBoundingClientRect();
    drag.x = event.clientX - board.left - drag.grabX;
    drag.y = event.clientY - board.top - drag.grabY;
    if (!drag.moved) {
      drag.moved = true;
      this.preview = [...(this.preview ?? this.widgets)];
      this.draggingId = drag.id;
    }
    // Follow the pointer directly, without a render per move.
    drag.tile.style.transform = `translate(${drag.x}px, ${drag.y}px)`;
    // Where it would land: worked out at most once a frame.
    if (!drag.frame) {
      drag.frame = requestAnimationFrame(() => {
        drag.frame = 0;
        this.retarget();
      });
    }
  };

  /** Moves the dragged widget, in the preview, to the slot it hovers over. */
  private retarget(): void {
    const drag = this.drag;
    const list = this.preview;
    if (!drag?.moved || !list) return;
    const centerX = drag.x + drag.tile.offsetWidth / 2;
    const centerY = drag.y + drag.tile.offsetHeight / 2;
    const index = nearestIndex(list, drag.id, this.columns, centerX, centerY);
    if (index !== list.findIndex(w => w.id === drag.id)) {
      this.preview = moveTo(list, drag.id, index);
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.endDrag(this.drag.moved);
  };

  private onPointerCancel = () => this.endDrag(false);

  private onDragKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.endDrag(false);
  };

  /** Drops the dragged tile into its slot (or back where it was). */
  private endDrag(commit: boolean): void {
    const drag = this.drag;
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    // Settle the slot from where the pointer let go, not the last frame.
    if (commit && drag.moved) this.retarget();
    drag.tile.removeEventListener('pointermove', this.onPointerMove);
    drag.tile.removeEventListener('pointerup', this.onPointerUp);
    drag.tile.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('keydown', this.onDragKey);
    if (drag.tile.hasPointerCapture(drag.pointerId)) {
      drag.tile.releasePointerCapture(drag.pointerId);
    }
    this.drag = null;
    this.draggingId = null;
    if (!commit || !drag.moved) {
      this.preview = null;
      return;
    }
    this.commit(this.preview!, drag.id);
  }

  private onTileKey = (event: KeyboardEvent) => {
    if (!this.editing || this.drag) return;
    const id = (event.currentTarget as HTMLElement).dataset.id!;
    const list = this.preview ?? [...this.widgets];
    const index = list.findIndex(w => w.id === id);
    const target =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? index - 1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? index + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? list.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    if (target < 0 || target >= list.length || target === index) return;
    const next = moveTo(list, id, target);
    this.preview = next;
    this.commit(next, id);
  };

  private commit(order: WidgetEntry[], movedId: string): void {
    const moved = order.find(w => w.id === movedId);
    const position = order.indexOf(moved!) + 1;
    const name = moved ? (WIDGETS[moved.kind]?.name ?? moved.kind) : '';
    this.announcement = `${name} moved to ${position} of ${order.length}.`;
    const changed = order.some((w, i) => w.id !== this.widgets[i]?.id);
    if (!changed) {
      this.preview = null;
      return;
    }
    this.dispatchEvent(
      new CustomEvent<ReorderDetail>('tarn-reorder', {
        bubbles: true,
        composed: true,
        detail: {widgets: order},
      }),
    );
  }

  private dispatchTiles(rects: number[], strength: number): void {
    this.dispatchEvent(
      new CustomEvent<TilesDetail>('tarn-tiles', {
        bubbles: true,
        composed: true,
        detail: {rects, strength, radius: RADIUS},
      }),
    );
  }

  private fittingColumns(): number {
    return columnsFor(window.innerWidth - 2 * MARGIN, CELL, GAP);
  }

  private onColumnsChange = () => {
    const columns = this.fittingColumns();
    if (columns !== this.columns) this.columns = columns;
  };
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function unsafeEase() {
  return unsafeCSS(EASE);
}

customElements.define('tarn-board', TarnBoard);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-board': TarnBoard;
  }
}
