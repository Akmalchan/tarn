/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {
  LitElement,
  css,
  html,
  nothing,
  unsafeCSS,
  type PropertyValues,
} from 'lit';
import {keyed} from 'lit/directives/keyed.js';
import {live} from 'lit/directives/live.js';
import {repeat} from 'lit/directives/repeat.js';
import {MAX_COLUMNS, SPAN, columnsFor, type WidgetSize} from '../layout/bands';
import {
  DEFAULT_WIDGET_SIZE,
  WIDGET_SIZE_OPTIONS,
  fitWidgetSize,
  newWidgetId,
  type WidgetEntry,
  type WidgetKind,
} from '../settings/schema';
import {CELL, GAP, PITCH, moveTo, nearestOrder, placeTiles} from './geometry';
import {WIDGETS, renderWidget} from './registry';
import {LocaleController, t} from '../i18n';

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
 * A held tile only changes slot when the new slot is clearly closer (CSS
 * px), so the layout never flips back and forth between two slots.
 */
const STICKINESS = PITCH * 0.3;
/** A widget dragged in from the settings panel, before it exists. */
const INCOMING = 'incoming';

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
  /** The tile keeps the size it had when picked up, wherever it may land. */
  width: number;
  height: number;
  moved: boolean;
  frame: number;
  /** Where the held tile's center was at the last slot search. */
  searchedX: number;
  searchedY: number;
}

/** A tile being resized from its corner grip. */
interface Resize {
  id: string;
  tile: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  /** The size when the grip was picked up, and the one it would snap to. */
  from: WidgetSize;
  size: WidgetSize;
  /** The tile's top-left on the board; it stays put while the corner moves. */
  x: number;
  y: number;
  /** Its box when picked up, and now (following the pointer), in px. */
  startWidth: number;
  startHeight: number;
  width: number;
  height: number;
  /** The smallest and largest box its sizes allow. */
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
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
    confirming: {state: true},
    resizing: {state: true},
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

    /* The tile clips its content, not itself, so the holder can sit on its
       top edge. */
    .content {
      overflow: hidden;
      border-radius: inherit;
    }

    /* Arranging: a holder on each tile's top edge with its name (click to
       rename) and a button that removes it. Pressing the holder drags. */
    .holder {
      position: absolute;
      top: 0;
      left: 50%;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 2px;
      max-width: calc(100% - 20px);
      height: 26px;
      padding: 0 3px 0 6px;
      translate: -50% -50%;
      font: 500 12px var(--font-sans);
      color: var(--ink);
      background: var(--tile-held, rgb(20 25 34 / 0.86));
      border: 1px solid var(--tile-line-strong);
      border-radius: 999px;
      box-shadow: 0 4px 14px rgb(0 0 0 / 0.22);
      animation: holder-in 200ms ease-out both;
    }

    .holder input {
      min-width: 3ch;
      max-width: 100%;
      padding: 2px 5px;
      font: inherit;
      color: inherit;
      text-overflow: ellipsis;
      background: transparent;
      border: 0;
      border-radius: 6px;
      outline: none;
      cursor: text;
      field-sizing: content;
    }

    .holder input:hover,
    .holder input:focus {
      background: var(--chip);
    }

    .holder button {
      display: grid;
      flex: none;
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

    /* Second press removes. */
    .holder button.confirm {
      padding: 0 9px;
      font-size: 12px;
      color: #fff;
      background: rgb(214 64 69 / 0.92);
    }

    /* Arranging: a grip just outside the tile's corner resizes it,
       following its rounded edge, so it never covers the content. */
    .grip {
      position: absolute;
      right: -10px;
      bottom: -10px;
      z-index: 1;
      display: block;
      width: 34px;
      height: 34px;
      color: var(--ink);
      opacity: 0.5;
      cursor: nwse-resize;
      touch-action: none;
      transition: opacity 150ms ease;
    }

    .grip svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      fill: none;
      stroke: currentColor;
      stroke-width: 3;
      stroke-linecap: round;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.35));
    }

    .tile:hover .grip,
    .tile:focus-visible .grip,
    :host([resizing]) .grip {
      opacity: 0.9;
    }

    :host([resizing]),
    :host([resizing]) .tile {
      cursor: nwse-resize;
    }

    /* Being resized: lifted like a held tile, in front of the rest. */
    .tile[data-resizing] {
      z-index: 2;
      background: var(--tile-held, rgb(20 25 34 / 0.86));
      border-color: var(--tile-line-strong);
      box-shadow:
        inset 0 1px 0 var(--tile-highlight),
        0 22px 48px rgb(0 0 0 / 0.32);
      translate: 0 0;
    }

    /* The size it will snap to, pulsing once each time that changes. */
    .slot {
      position: absolute;
      left: 0;
      top: 0;
      z-index: 1;
      border-radius: ${RADIUS}px;
      border: 1.5px solid var(--tile-line-strong);
      background: rgb(255 255 255 / 0.05);
      pointer-events: none;
      animation: slot-in 220ms ${unsafeEase()} both;
    }

    /* A widget on its way in from the settings panel: an empty tile with
       its name, where it will land. */
    .tile.incoming {
      display: grid;
      place-items: center;
      border: 1.5px solid var(--tile-line-strong);
      background: rgb(255 255 255 / 0.05);
      pointer-events: none;
    }

    .incoming span {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-dim);
    }

    @keyframes slot-in {
      from {
        opacity: 0.4;
        scale: 0.97;
      }
    }

    @keyframes holder-in {
      from {
        opacity: 0;
        translate: -50% -30%;
      }
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

    /* Lifted: a nearly solid card, so tiles it passes over don't show
       through. No backdrop blur: preparing one when a tile is picked up
       froze the page for 160-190 ms (measured). */
    .tile[data-dragging] {
      z-index: 2;
      cursor: grabbing;
      background: var(--tile-held, rgb(20 25 34 / 0.86));
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

    /* Under the widgets, in open space: above them it was squeezed
       between the search box and the tiles' name holders. */
    .hint {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 28px);
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
      .holder {
        animation: none;
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
  /** The widget whose remove button was pressed once (asks again). */
  declare confirming: string | null;
  private confirmTimer = 0;

  private queries: MediaQueryList[] = [];
  private lastBoxes = new Map<string, DOMRect>();
  private appearedAt = 0;
  private reporting = 0;
  private drag: Drag | null = null;
  /** The tile being resized from its corner, if any. */
  declare resizing: Resize | null;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgets = [];
    this.glass = 'shader';
    this.instant = false;
    this.editing = false;
    this.columns = this.fittingColumns();
    this.preview = null;
    this.draggingId = null;
    this.announcement = '';
    this.confirming = null;
    this.resizing = null;
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
    this.endResize(false);
    this.dispatchTiles([], 0);
  }

  /** Reports where the tiles are now, e.g. after the page scrolls. */
  report = () => {
    const tiles = [...this.renderRoot.querySelectorAll<HTMLElement>('.tile')];
    const rects: number[] = [];
    for (const tile of tiles) {
      // The held tile is a nearly solid card: no frost to keep up with.
      if (
        tile.hasAttribute('data-dragging') ||
        tile.hasAttribute('data-resizing')
      ) {
        continue;
      }
      const box = tile.getBoundingClientRect();
      rects.push(box.x, box.y, box.width, box.height);
    }
    const elapsed = performance.now() - this.appearedAt;
    const strength =
      this.instant || this.reduceMotion.matches
        ? 1
        : easeOut(Math.min(1, elapsed / APPEAR_MS));
    // Nothing moved: no message, so the background doesn't redraw for it.
    const key = rects.map(n => Math.round(n * 2)).join() + '|' + strength;
    if (key === this.lastReport) return;
    this.lastReport = key;
    this.dispatchTiles(rects, strength);
  };

  private lastReport = '';

  /** Reports again even if no tile moved (something else frosted changed). */
  refresh = () => {
    this.lastReport = '';
    this.report();
  };

  override willUpdate(changed: PropertyValues<this>): void {
    // A saved order arrived: the preview has done its job.
    if (changed.has('widgets')) this.preview = null;
    if (changed.has('editing') && !this.editing) {
      this.endDrag(false);
      this.endResize(false);
    }
    // FLIP, first: where each tile is before the change.
    if (
      changed.has('widgets') ||
      changed.has('columns') ||
      changed.has('preview') ||
      changed.has('draggingId') ||
      changed.has('resizing')
    ) {
      this.lastBoxes.clear();
      for (const tile of this.renderRoot.querySelectorAll<HTMLElement>(
        '.tile',
      )) {
        this.lastBoxes.set(tile.dataset.id!, tile.getBoundingClientRect());
      }
    }
  }

  /** The first widget of a kind on the board, by its element name. */
  widget<K extends keyof HTMLElementTagNameMap>(
    tag: K,
  ): HTMLElementTagNameMap[K] | null {
    return this.renderRoot.querySelector(tag);
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
          ? html`<p class="hint">${t('board.hint')}</p>`
          : nothing
      }
      ${this.renderSlot(tiles)}
      ${repeat(
        tiles,
        tile => tile.id,
        (tile, index) => {
          const widget = byId.get(tile.id)!;
          if (tile.id === INCOMING) {
            return html`<div
              class="tile incoming"
              data-id=${INCOMING}
              aria-hidden="true"
              style="width:${tile.width}px;height:${tile.height}px;transform:translate(${tile.x}px, ${tile.y}px)"
            >
              <span>${defaultName(widget)}</span>
            </div>`;
          }
          const held = this.drag?.moved && this.drag.id === tile.id;
          const dragged = held ? this.drag! : null;
          const x = dragged ? dragged.x : tile.x;
          const y = dragged ? dragged.y : tile.y;
          const w = dragged ? dragged.width : tile.width;
          const h = dragged ? dragged.height : tile.height;
          const resized = this.resizing?.id === tile.id ? this.resizing : null;
          const name = widgetName(widget);
          return html`
            <div
              class="tile"
              data-id=${tile.id}
              ?data-dragging=${held}
              ?data-resizing=${resized !== null}
              tabindex=${this.editing ? '0' : '-1'}
              role=${this.editing ? 'button' : 'group'}
              aria-roledescription=${this.editing ? t('board.movable') : nothing}
              aria-label=${
                this.editing
                  ? t('board.position', {name, index: index + 1, count})
                  : name
              }
              style=${
                resized
                  ? `width:${resized.width}px;height:${resized.height}px;transform:translate(${resized.x}px, ${resized.y}px)`
                  : `width:${w}px;height:${h}px;transform:translate(${x}px, ${y}px)`
              }
              @pointerdown=${this.onPointerDown}
              @keydown=${this.onTileKey}
            >
              ${this.editing ? this.holder(widget, name) : nothing}
              ${
                this.editing
                  ? html`<span class="grip" data-resize aria-hidden="true"
                      ><svg viewBox="0 0 34 34">
                        <path d="M28.3 9.5a29 29 0 0 1-18.8 18.8" /></svg
                    ></span>`
                  : nothing
              }
              <div
                class="content"
                ?inert=${this.editing && !WIDGETS[widget.kind]?.editable}
              >
                ${renderWidget(widget.kind, widget.id, this.editing, widget.name)}
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
      // A dragged or resized tile follows the pointer, not an animation.
      if (
        tile.hasAttribute('data-dragging') ||
        tile.hasAttribute('data-resizing')
      ) {
        continue;
      }
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
        this.resizing !== null ||
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
    if (!this.editing || event.button !== 0 || this.drag || this.resizing) {
      return;
    }
    if (fromEditControl(event)) return;
    if (fromGrip(event)) {
      this.startResize(event);
      return;
    }
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
      width: tile.offsetWidth,
      height: tile.offsetHeight,
      moved: false,
      frame: 0,
      searchedX: Infinity,
      searchedY: Infinity,
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
    const centerX = drag.x + drag.width / 2;
    const centerY = drag.y + drag.height / 2;
    // Barely moved since the last search: the answer can't have changed.
    if (Math.hypot(centerX - drag.searchedX, centerY - drag.searchedY) < 6) {
      return;
    }
    drag.searchedX = centerX;
    drag.searchedY = centerY;
    const next = nearestOrder(
      list,
      drag.id,
      this.columns,
      centerX,
      centerY,
      STICKINESS,
    );
    if (next.some((w, k) => w.id !== list[k]!.id)) this.preview = next;
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
    if (!this.editing || this.drag || fromEditControl(event)) return;
    const id = (event.currentTarget as HTMLElement).dataset.id!;
    const step =
      event.key === '+' || event.key === '='
        ? 1
        : event.key === '-' || event.key === '_'
          ? -1
          : 0;
    if (step) {
      event.preventDefault();
      this.stepSize(id, step);
      return;
    }
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

  // ---- Adding from the settings panel --------------------------------------
  // A widget dragged from the panel's "Add" list shows as an empty tile
  // where it would land, and the others make room, as in a move.

  private incomingAt = {x: Infinity, y: Infinity};

  /** A new widget of `kind` hovers at the pointer (viewport px). */
  hoverNew(
    kind: WidgetKind,
    clientX: number,
    clientY: number,
    size: WidgetSize = DEFAULT_WIDGET_SIZE[kind],
  ): void {
    if (this.drag || this.resizing) return;
    const current = this.preview?.some(w => w.id === INCOMING)
      ? this.preview
      : null;
    // Barely moved since the last search: the answer can't have changed.
    if (
      current &&
      Math.hypot(clientX - this.incomingAt.x, clientY - this.incomingAt.y) < 6
    ) {
      return;
    }
    this.incomingAt = {x: clientX, y: clientY};
    const list = current ?? [
      ...this.widgets,
      {id: INCOMING, kind, size: fitWidgetSize(kind, size)},
    ];
    const board = this.getBoundingClientRect();
    const next = nearestOrder(
      list,
      INCOMING,
      this.columns,
      clientX - board.left,
      clientY - board.top,
      STICKINESS,
    );
    if (!current || next.some((w, k) => w.id !== current[k]!.id)) {
      this.preview = next;
    }
  }

  /** The drag left the page or was cancelled: everything moves back. */
  leaveNew(): void {
    if (this.preview?.some(w => w.id === INCOMING)) this.preview = null;
    this.incomingAt = {x: Infinity, y: Infinity};
  }

  /**
   * Dropped: the empty tile becomes a real widget, saved in its place.
   * `name` names it; `prepare` runs with its id before the save (a custom
   * widget's code is stored first, so it never shows other code).
   */
  dropNew(name?: string, prepare?: (id: string) => void): void {
    const list = this.preview;
    const incoming = list?.find(w => w.id === INCOMING);
    this.incomingAt = {x: Infinity, y: Infinity};
    if (!list || !incoming) return;
    const id = newWidgetId(incoming.kind);
    const added: WidgetEntry = name
      ? {...incoming, id, name}
      : {...incoming, id};
    prepare?.(id);
    const next = list.map(w => (w.id === INCOMING ? added : w));
    this.preview = next;
    this.announcement = t('board.moved', {
      name: widgetName(added),
      position: next.indexOf(added) + 1,
      count: next.length,
    });
    this.save(next);
  }

  // ---- Resizing -----------------------------------------------------------
  // Sizes are whole cells (1x1, 2x1, 2x2, 4x2) and each widget offers a few,
  // so the corner snaps from one to the next as the pointer travels; the
  // layout reflows (and animates) only when the size actually changes.

  /** Where a tile being resized will snap: a soft outline, there and then. */
  private renderSlot(
    tiles: readonly {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  ) {
    const resize = this.resizing;
    const slot = resize && tiles.find(tile => tile.id === resize.id);
    if (!resize || !slot) return nothing;
    return keyed(
      resize.size,
      html`<div
        class="slot"
        style="width:${slot.width}px;height:${slot.height}px;transform:translate(${slot.x}px, ${slot.y}px)"
      ></div>`,
    );
  }

  private startResize(event: PointerEvent): void {
    const tile = event.currentTarget as HTMLElement;
    const widget = this.widgets.find(w => w.id === tile.dataset.id);
    if (!widget) return;
    const box = tile.getBoundingClientRect();
    const board = this.getBoundingClientRect();
    const spans = WIDGET_SIZE_OPTIONS[widget.kind].map(size => SPAN[size]);
    const px = (cells: number) => cells * PITCH - GAP;
    this.resizing = {
      id: widget.id,
      tile,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: widget.size,
      size: widget.size,
      x: box.left - board.left,
      y: box.top - board.top,
      startWidth: tile.offsetWidth,
      startHeight: tile.offsetHeight,
      width: tile.offsetWidth,
      height: tile.offsetHeight,
      minWidth: px(Math.min(...spans.map(([w]) => w))),
      maxWidth: px(Math.max(...spans.map(([w]) => w))),
      minHeight: px(Math.min(...spans.map(([, h]) => h))),
      maxHeight: px(Math.max(...spans.map(([, h]) => h))),
    };
    tile.setPointerCapture(event.pointerId);
    tile.addEventListener('pointermove', this.onResizeMove);
    tile.addEventListener('pointerup', this.onResizeUp);
    tile.addEventListener('pointercancel', this.onResizeCancel);
    window.addEventListener('keydown', this.onResizeKey);
    this.toggleAttribute('resizing', true);
    event.preventDefault();
  }

  private onResizeMove = (event: PointerEvent) => {
    const resize = this.resizing;
    if (!resize || event.pointerId !== resize.pointerId) return;
    const widget = this.widgets.find(w => w.id === resize.id);
    if (!widget) return;
    // The frame follows the pointer, held at the widget's smallest and
    // largest sizes with a little give, so it feels like stretching it.
    resize.width = rubberBand(
      resize.startWidth + event.clientX - resize.startX,
      resize.minWidth,
      resize.maxWidth,
    );
    resize.height = rubberBand(
      resize.startHeight + event.clientY - resize.startY,
      resize.minHeight,
      resize.maxHeight,
    );
    resize.tile.style.width = `${resize.width}px`;
    resize.tile.style.height = `${resize.height}px`;
    const size = nearestSize(
      widget,
      (resize.width + GAP) / PITCH,
      (resize.height + GAP) / PITCH,
    );
    if (size === resize.size) return;
    // A new size to snap to: the others make room for it.
    resize.size = size;
    this.preview = this.widgets.map(w =>
      w.id === resize.id ? {...w, size} : w,
    );
  };

  private onResizeUp = (event: PointerEvent) => {
    if (this.resizing?.pointerId === event.pointerId) this.endResize(true);
  };

  private onResizeCancel = () => this.endResize(false);

  private onResizeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.endResize(false);
  };

  private endResize(commit: boolean): void {
    const resize = this.resizing;
    if (!resize) return;
    const {tile, pointerId} = resize;
    tile.removeEventListener('pointermove', this.onResizeMove);
    tile.removeEventListener('pointerup', this.onResizeUp);
    tile.removeEventListener('pointercancel', this.onResizeCancel);
    window.removeEventListener('keydown', this.onResizeKey);
    if (tile.hasPointerCapture(pointerId))
      tile.releasePointerCapture(pointerId);
    // Back into the layout: the tile glides from where the pointer left it
    // into its slot (FLIP, from the box captured before this update).
    this.resizing = null;
    this.toggleAttribute('resizing', false);
    if (!commit || resize.size === resize.from) {
      this.preview = null;
      return;
    }
    this.commitSize(resize.id, resize.size);
  }

  /** + and - on a focused tile: the next size up or down it offers. */
  private stepSize(id: string, step: number): void {
    const widget = this.widgets.find(w => w.id === id);
    if (!widget) return;
    const options = WIDGET_SIZE_OPTIONS[widget.kind];
    const next = options[options.indexOf(widget.size) + step];
    if (next) this.commitSize(id, next);
  }

  private commitSize(id: string, size: WidgetSize): void {
    const list = this.widgets.map(w => (w.id === id ? {...w, size} : w));
    this.preview = list;
    const widget = list.find(w => w.id === id)!;
    this.announcement = t('board.resized', {
      name: widgetName(widget),
      size: t(`panel.size.${size}`),
    });
    this.save(list);
  }

  private holder(widget: WidgetEntry, name: string) {
    const confirming = this.confirming === widget.id;
    return html`
      <div class="holder">
        <input
          data-edit
          aria-label=${t('board.name')}
          title=${t('board.rename')}
          maxlength="40"
          spellcheck="false"
          autocomplete="off"
          size=${Math.max(3, name.length)}
          .value=${live(name)}
          @keydown=${this.onNameKey}
          @change=${(event: Event) => this.rename(widget.id, event)}
        />
        <button
          data-edit
          class=${confirming ? 'confirm' : ''}
          aria-label=${
            confirming
              ? t('board.confirmRemove', {name})
              : t('board.removeWidget', {name})
          }
          title=${t('common.remove')}
          @click=${() => this.askRemove(widget.id)}
        >
          ${confirming ? t('common.remove') : '×'}
        </button>
      </div>
    `;
  }

  private onNameKey = (event: KeyboardEvent) => {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') input.blur();
    if (event.key === 'Escape') {
      input.value = input.defaultValue;
      input.blur();
    }
  };

  /** Saves a widget's new name; an empty one goes back to the default. */
  private rename(id: string, event: Event): void {
    const text = (event.target as HTMLInputElement).value.trim().slice(0, 40);
    const list = this.widgets.map(w => {
      if (w.id !== id) return w;
      const rest: WidgetEntry = {id: w.id, kind: w.kind, size: w.size};
      const custom = text && text !== defaultName(w);
      return custom ? {...rest, name: text} : rest;
    });
    this.save(list);
  }

  /** First press asks; a second press within a few seconds removes. */
  private askRemove(id: string): void {
    clearTimeout(this.confirmTimer);
    if (this.confirming !== id) {
      this.confirming = id;
      this.confirmTimer = window.setTimeout(
        () => (this.confirming = null),
        3000,
      );
      return;
    }
    this.confirming = null;
    const removed = this.widgets.find(w => w.id === id);
    this.announcement = removed
      ? t('board.removed', {name: widgetName(removed)})
      : '';
    this.save(this.widgets.filter(w => w.id !== id));
  }

  /** Hands a changed list (renamed, removed) to the app, which saves it. */
  private save(list: WidgetEntry[]): void {
    this.dispatchEvent(
      new CustomEvent<ReorderDetail>('tarn-reorder', {
        bubbles: true,
        composed: true,
        detail: {widgets: list},
      }),
    );
  }

  private commit(order: WidgetEntry[], movedId: string): void {
    const moved = order.find(w => w.id === movedId);
    const position = order.indexOf(moved!) + 1;
    const name = moved ? widgetName(moved) : '';
    this.announcement = t('board.moved', {
      name,
      position,
      count: order.length,
    });
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

/** The user's name for a widget, or its kind's. */
function widgetName(widget: WidgetEntry): string {
  return widget.name ?? defaultName(widget);
}

/** A widget kind's own name, in the current language. */
function defaultName(widget: WidgetEntry): string {
  const definition = WIDGETS[widget.kind];
  return definition ? t(definition.nameKey) : widget.kind;
}

/**
 * The size a widget offers closest to a span of `columns` x `rows` cells
 * (fractional while the pointer is between cells).
 */
function nearestSize(
  widget: WidgetEntry,
  columns: number,
  rows: number,
): WidgetSize {
  let best = widget.size;
  let bestDistance = Infinity;
  for (const size of WIDGET_SIZE_OPTIONS[widget.kind]) {
    const [w, h] = SPAN[size];
    const distance = (w - columns) ** 2 + (h - rows) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = size;
    }
  }
  return best;
}

/**
 * `value` held between `min` and `max`, giving a little past them (a
 * quarter of the overshoot, at most 24px), like stretching something
 * that won't go further.
 */
function rubberBand(value: number, min: number, max: number): number {
  if (value < min) return min - Math.min((min - value) / 4, 24);
  if (value > max) return max + Math.min((value - max) / 4, 24);
  return value;
}

/** Whether an event started on a tile's corner grip. */
function fromGrip(event: Event): boolean {
  return event
    .composedPath()
    .some(node => node instanceof HTMLElement && 'resize' in node.dataset);
}

/** Whether an event started on a widget's own control (`data-edit`). */
function fromEditControl(event: Event): boolean {
  return event
    .composedPath()
    .some(node => node instanceof HTMLElement && 'edit' in node.dataset);
}

customElements.define('tarn-board', TarnBoard);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-board': TarnBoard;
  }
}
