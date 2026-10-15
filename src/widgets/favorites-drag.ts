/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Arranging sites by hand, like icons on a phone. The held site follows the
// pointer; resting over a slot moves it there (the others make room), and
// resting over another site's icon drops it in: a new folder, or into that
// folder. Inside an open folder, letting go outside it takes the site out.
// Pure pointer math: the widget renders the order this reports.

export interface DragState {
  /** The items' indices in the order they are shown. */
  readonly order: readonly number[];
  /** The item the held site would drop into, if any. */
  readonly into: number | null;
  /** Outside the open folder: letting go takes the site out. */
  readonly out: boolean;
}

export type DragResult =
  | {readonly kind: 'move'; readonly from: number; readonly to: number}
  | {readonly kind: 'into'; readonly from: number; readonly target: number}
  | {readonly kind: 'out'; readonly from: number};

export interface DragOptions {
  /** The grid; its `[data-index]` children are the items, in order. */
  readonly grid: HTMLElement;
  readonly from: number;
  readonly event: PointerEvent;
  /** Whether the held item may drop into the item at `target`. */
  readonly canDropInto: (target: number) => boolean;
  /** The open folder's box: letting go outside it takes the site out. */
  readonly container?: HTMLElement;
  readonly onChange: (state: DragState) => void;
  readonly onEnd: (result: DragResult | null) => void;
}

/** How far the pointer moves before a press becomes a drag. */
const SLOP = 5;
/** Resting this long over a slot moves the site there. */
const MOVE_DELAY = 110;
/** Resting this long over an icon drops the site into it. */
const INTO_DELAY = 380;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class SiteDrag {
  private readonly options: DragOptions;
  private readonly element: HTMLElement;
  private readonly startX: number;
  private readonly startY: number;
  private pointerX: number;
  private pointerY: number;
  private moved = false;
  private slots: Box[] = [];
  /** The icon's box inside a slot. */
  private chip: Box = {x: 0, y: 0, w: 0, h: 0};
  private grabX = 0;
  private grabY = 0;
  private state: DragState;
  /** What the pointer rests over, and the timer that acts on it. */
  private pending: {key: string; timer: number; act: () => void} | null = null;
  /** A pending look at what the pointer is over (at most every 16ms). */
  private timer = 0;
  private done = false;

  constructor(options: DragOptions) {
    this.options = options;
    const items = this.items();
    this.element = items[options.from]!;
    this.startX = this.pointerX = options.event.clientX;
    this.startY = this.pointerY = options.event.clientY;
    this.state = {order: items.map((_, i) => i), into: null, out: false};
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('keydown', this.onKey, true);
  }

  /** The held item, while it is being dragged. */
  get held(): HTMLElement | null {
    return this.moved ? this.element : null;
  }

  /** Puts the held item under the pointer again (after a re-render). */
  follow(): void {
    if (!this.moved) return;
    const slot = this.slots[this.state.order.indexOf(this.options.from)];
    if (!slot) return;
    const {x, y} = this.local();
    this.element.style.transform = `translate(${x - this.grabX - slot.x}px, ${
      y - this.grabY - slot.y
    }px)`;
  }

  cancel(): void {
    this.finish(null);
  }

  private items(): HTMLElement[] {
    return [
      ...this.options.grid.querySelectorAll<HTMLElement>(
        ':scope > [data-index]',
      ),
    ];
  }

  /** The pointer in the grid's own coordinates (as offsetLeft/Top are). */
  private local(): {x: number; y: number} {
    const {grid} = this.options;
    const box = grid.getBoundingClientRect();
    return {
      x: this.pointerX - box.left - grid.clientLeft + grid.scrollLeft,
      y: this.pointerY - box.top - grid.clientTop + grid.scrollTop,
    };
  }

  private begin(): void {
    this.moved = true;
    this.slots = this.items().map(item => ({
      x: item.offsetLeft,
      y: item.offsetTop,
      w: item.offsetWidth,
      h: item.offsetHeight,
    }));
    const icon = this.element.querySelector<HTMLElement>('.chip');
    const slot = this.slots[this.options.from]!;
    if (icon) {
      const a = icon.getBoundingClientRect();
      const b = this.element.getBoundingClientRect();
      this.chip = {
        x: a.left - b.left,
        y: a.top - b.top,
        w: a.width,
        h: a.height,
      };
    } else {
      this.chip = {x: 0, y: 0, w: slot.w, h: slot.w};
    }
    const {x, y} = this.local();
    this.grabX = x - slot.x;
    this.grabY = y - slot.y;
    try {
      // Keeps the moves coming when the pointer leaves the window.
      this.element.setPointerCapture(this.options.event.pointerId);
    } catch {
      // Not a live pointer (synthetic): window events still arrive.
    }
    this.options.onChange(this.state);
  }

  private onMove = (event: PointerEvent) => {
    if (event.pointerId !== this.options.event.pointerId) return;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    if (!this.moved) {
      if (
        Math.hypot(this.pointerX - this.startX, this.pointerY - this.startY) <
        SLOP
      ) {
        return;
      }
      this.begin();
    }
    this.follow();
    if (!this.timer) {
      this.timer = window.setTimeout(() => {
        this.timer = 0;
        this.retarget();
      }, 16);
    }
  };

  /** Works out what the pointer rests over. */
  private retarget(): void {
    if (this.done) return;
    const {container} = this.options;
    if (container) {
      const box = container.getBoundingClientRect();
      const out =
        this.pointerX < box.left ||
        this.pointerX > box.right ||
        this.pointerY < box.top ||
        this.pointerY > box.bottom;
      if (out !== this.state.out) this.update({...this.state, out, into: null});
      if (out) {
        this.wait(null);
        return;
      }
    }
    const {x, y} = this.local();
    const here = this.state.order.indexOf(this.options.from);
    const slot = this.slotAt(x, y);
    if (slot === null || slot === here) {
      this.wait(null);
      if (this.state.into !== null) this.update({...this.state, into: null});
      return;
    }
    const target = this.state.order[slot]!;
    const box = this.slots[slot]!;
    const centerX = box.x + this.chip.x + this.chip.w / 2;
    const centerY = box.y + this.chip.y + this.chip.h / 2;
    const overIcon =
      Math.abs(x - centerX) < this.chip.w * 0.32 &&
      Math.abs(y - centerY) < this.chip.h * 0.32;
    if (overIcon && this.options.canDropInto(target)) {
      if (this.state.into === target) return;
      this.wait(`into:${target}`, INTO_DELAY, () =>
        this.update({...this.state, into: target}),
      );
      return;
    }
    if (this.state.into !== null) this.update({...this.state, into: null});
    this.wait(`move:${slot}`, MOVE_DELAY, () => {
      const order = [...this.state.order];
      order.splice(here, 1);
      order.splice(slot, 0, this.options.from);
      this.update({...this.state, order, into: null});
    });
  }

  /** The slot under a point, or the nearest one when between slots. */
  private slotAt(x: number, y: number): number | null {
    let best: number | null = null;
    let bestDistance = Infinity;
    this.slots.forEach((slot, i) => {
      const dx = Math.max(slot.x - x, 0, x - (slot.x + slot.w));
      const dy = Math.max(slot.y - y, 0, y - (slot.y + slot.h));
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    // Far from every slot (outside the grid): stay put.
    return bestDistance < 24 ? best : null;
  }

  /** Acts on what the pointer rests over once it has rested long enough. */
  private wait(key: string | null, delay = 0, act?: () => void): void {
    if (this.pending?.key === key) return;
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
    if (key === null || !act) return;
    this.pending = {
      key,
      act,
      timer: window.setTimeout(() => {
        this.pending = null;
        act();
        // The page shifted under a still pointer: look again.
        setTimeout(() => this.retarget(), 32);
      }, delay),
    };
  }

  private update(state: DragState): void {
    this.state = state;
    this.options.onChange(state);
  }

  private onUp = (event: PointerEvent) => {
    if (event.pointerId !== this.options.event.pointerId) return;
    if (!this.moved) {
      this.finish(null);
      return;
    }
    // Let go over a new slot before it took effect: it goes there anyway.
    clearTimeout(this.timer);
    this.timer = 0;
    this.retarget();
    const pending = this.pending;
    if (pending?.key.startsWith('move:')) {
      clearTimeout(pending.timer);
      this.pending = null;
      pending.act();
    }
    const {from} = this.options;
    const {order, into, out} = this.state;
    let result: DragResult | null = null;
    if (out) result = {kind: 'out', from};
    else if (into !== null) result = {kind: 'into', from, target: into};
    else if (order.indexOf(from) !== from) {
      result = {kind: 'move', from, to: order.indexOf(from)};
    }
    this.swallowClick();
    this.finish(result, true);
  };

  private onCancel = () => this.finish(null);

  private onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.moved) return;
    event.preventDefault();
    event.stopPropagation();
    this.finish(null);
  };

  /** The click that ends a drag must not also open the site's editor. */
  private swallowClick(): void {
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    window.addEventListener('click', swallow, {capture: true, once: true});
    setTimeout(() => window.removeEventListener('click', swallow, true), 0);
  }

  private finish(result: DragResult | null, dropped = false): void {
    if (this.done) return;
    this.done = true;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('keydown', this.onKey, true);
    clearTimeout(this.timer);
    this.wait(null);
    const {pointerId} = this.options.event;
    if (this.element.hasPointerCapture?.(pointerId)) {
      this.element.releasePointerCapture(pointerId);
    }
    if (this.moved && !dropped) this.swallowClick();
    this.options.onEnd(result);
  }
}
