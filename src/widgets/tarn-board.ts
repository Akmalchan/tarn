/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing, type PropertyValues} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {MAX_COLUMNS, columnsFor, layoutBands} from '../layout/bands';
import type {WidgetEntry} from '../settings/schema';
import './tarn-favorites';
import './tarn-focus';
import './tarn-notes';

/** Tile and gap sizes, the same on every screen (docs/design/widget-layout.md). */
export const CELL = 136;
export const GAP = 24;
export const RADIUS = 24;
/** Side margin the page keeps around the widgets. */
const MARGIN = 24;
const PITCH = CELL + GAP;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const MOVE_MS = 460;
const APPEAR_MS = 500;

/**
 * Where the widgets' rounded rectangles are, for the background to frost
 * behind them: x, y, width, height per tile in viewport CSS pixels.
 */
export interface TilesDetail {
  rects: number[];
  strength: number;
  radius: number;
}

interface Tile {
  widget: WidgetEntry;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The widgets, laid out in bands two cells tall (layout/bands.ts) on one
 * shared column grid, centered on the page. Tiles are absolutely placed with transforms, so moving or
 * resizing one animates with transform and opacity only (FLIP).
 *
 * Fires `tarn-tiles` whenever tiles move, so the backdrop can draw frosted
 * glass behind them. With `glass="css"` (no live background) the tiles blur
 * the still background themselves instead.
 */
export class TarnBoard extends LitElement {
  static override properties = {
    widgets: {attribute: false},
    glass: {type: String, reflect: true},
    instant: {type: Boolean},
    columns: {state: true},
  };

  static override styles = css`
    :host {
      position: relative;
      display: block;
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
    }

    :host([glass='css']) .tile {
      background: var(--tile-fill-solid);
      backdrop-filter: blur(24px) saturate(1.3);
      -webkit-backdrop-filter: blur(24px) saturate(1.3);
    }

    .tile > * {
      width: 100%;
      height: 100%;
    }
  `;

  declare widgets: readonly WidgetEntry[];
  declare glass: 'shader' | 'css';
  /** Appear at once, no fade: a reload continues the page exactly. */
  declare instant: boolean;
  declare columns: number;

  private queries: MediaQueryList[] = [];
  private lastBoxes = new Map<string, DOMRect>();
  private appearedAt = 0;
  private reporting = 0;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    super();
    this.widgets = [];
    this.glass = 'shader';
    this.instant = false;
    this.columns = this.fittingColumns();
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
    // FLIP, first: where each tile is before the change.
    if (changed.has('widgets') || changed.has('columns')) {
      this.lastBoxes.clear();
      for (const tile of this.renderRoot.querySelectorAll<HTMLElement>(
        '.tile',
      )) {
        this.lastBoxes.set(tile.dataset.id!, tile.getBoundingClientRect());
      }
    }
  }

  override render() {
    const {tiles, width, height} = this.layout();
    this.style.width = `${width}px`;
    this.style.height = `${height}px`;
    return repeat(
      tiles,
      tile => tile.widget.id,
      tile => html`
        <div
          class="tile"
          data-id=${tile.widget.id}
          style="width:${tile.width}px;height:${tile.height}px;transform:translate(${tile.x}px, ${tile.y}px)"
        >
          ${this.widget(tile.widget)}
        </div>
      `,
    );
  }

  override updated(): void {
    if (this.lastBoxes.size && !this.reduceMotion.matches) this.flip();
    this.lastBoxes.clear();
    this.followTiles();
  }

  private widget(widget: WidgetEntry) {
    switch (widget.kind) {
      case 'favorites':
        return html`<tarn-favorites .widgetId=${widget.id}></tarn-favorites>`;
      case 'notes':
        return html`<tarn-notes .widgetId=${widget.id}></tarn-notes>`;
      case 'focus':
        return html`<tarn-focus .widgetId=${widget.id}></tarn-focus>`;
      default:
        return nothing;
    }
  }

  private layout(): {tiles: Tile[]; width: number; height: number} {
    const {placements, bands, heights} = layoutBands(
      this.widgets,
      this.columns,
    );
    // Each band starts below the ones before it (2 cells tall, or 1).
    const top: number[] = [];
    let y = 0;
    for (const h of heights) {
      top.push(y);
      y += h * PITCH;
    }
    const widest = Math.max(0, ...bands);
    const width = Math.max(0, widest * PITCH - GAP);
    const byId = new Map(this.widgets.map(w => [w.id, w]));
    const tiles = placements.map(p => {
      // Every band shares one column grid and starts at its left edge, so
      // tiles line up from band to band; the grid itself is centered.
      return {
        widget: byId.get(p.id)!,
        x: p.col * PITCH,
        y: top[p.band]! + p.row * PITCH,
        width: p.w * PITCH - GAP,
        height: p.h * PITCH - GAP,
      };
    });
    // Keep the user's order in the DOM: it is the reading and tab order.
    const order = new Map(this.widgets.map((w, i) => [w.id, i]));
    tiles.sort((a, b) => order.get(a.widget.id)! - order.get(b.widget.id)!);
    const height = bands.length ? y - GAP : 0;
    return {tiles, width, height};
  }

  /** FLIP, invert and play: each tile glides from its old box to its new one. */
  private flip(): void {
    for (const tile of this.renderRoot.querySelectorAll<HTMLElement>('.tile')) {
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
        performance.now() - this.appearedAt < APPEAR_MS ||
        [...this.renderRoot.querySelectorAll('.tile')].some(
          tile => tile.getAnimations().length > 0,
        );
      this.reporting = moving ? requestAnimationFrame(step) : 0;
      if (!moving) this.report();
    };
    this.reporting = requestAnimationFrame(step);
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

customElements.define('tarn-board', TarnBoard);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-board': TarnBoard;
  }
}
