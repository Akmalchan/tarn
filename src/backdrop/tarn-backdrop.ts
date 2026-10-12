/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, unsafeCSS, type PropertyValues} from 'lit';
import {
  arrival,
  releaseGhost,
  rememberClock,
  rememberGhost,
  paintedGhostClock,
  resumeClock,
} from '../app/first-paint';
import {rememberedTiles} from '../app/tile-memory';
import {
  applyCommand,
  type GhostRequest,
  type RendererCommand,
  type WorkerEvent,
  type WorkerInit,
} from './protocol';
import type {GhostFrame, Renderer} from './renderer';
import {DEFAULT_SCENE_ID, sceneById, sceneStill} from './scenes';

/** Scene-to-scene crossfade. */
const FADE_MS = 400;
/**
 * Opening a new tab: the scene eases in from the browser's color (the clock,
 * widgets and controls fade in alongside, over the same time)...
 */
const REVEAL_MS = 450;
/** ...while settling from slightly enlarged, like a quick breath out. */
const SETTLE_MS = 650;
const SETTLE_SCALE = 1.02;
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/**
 * How often a visible tab saves its moment for the next page: the clock, and
 * a ghost frame for reloads. Faster scenes save more often so the ghost is
 * never visibly behind: interval = GHOST_MOTION / speed, clamped.
 */
const GHOST_MOTION = 180;
const SAVE_MIN_MS = 250;
const SAVE_MAX_MS = 1000;
/** How long a reload keeps its ghost underneath the live scene. */
const GHOST_RELEASE_MS = 500;
/**
 * If no live frame has arrived by then (very slow GPU, stuck worker), show
 * the scene's still gradient so the page and its controls never wait.
 */
const STILL_AFTER_MS = 2500;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * The animated page background. Owns the canvas and wires the renderer to
 * page size, tab visibility and the reduced-motion preference. Rendering
 * runs in a worker when the browser supports OffscreenCanvas.
 *
 * With `remember` (the new tab page), it continues the animation from where
 * the last page left it and arrives smoothly: easing in when a tab opens,
 * appearing exactly in place on reload. Fires `tarn-revealed` once visible.
 */
export class TarnBackdrop extends LitElement {
  static override properties = {
    scene: {type: String},
    remember: {type: Boolean},
  };

  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: block;
      transition: background-color ${FADE_MS}ms ease;
      contain: strict;
    }
    /* Transparent until revealed: the page's first-frame color shows. */
    :host([ready]) {
      background-color: var(--backdrop-base);
    }
    /* The scene as a still gradient, under the canvas: shown when WebGL is
       unavailable or slow to start. */
    :host::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--backdrop-still);
      opacity: 0;
      transition: opacity ${REVEAL_MS}ms ${unsafeCSS(EASE_OUT)};
    }
    :host([still])::before {
      opacity: 1;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      opacity: 0;
      transform: scale(${SETTLE_SCALE});
      transition: opacity ${FADE_MS}ms ease;
    }
  `;

  declare scene: string;
  declare remember: boolean;

  private worker: Worker | null = null;
  private local: Renderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private motionQuery = matchMedia(REDUCED_MOTION);
  private shownScene: string | null = null;
  private clockTimer = 0;
  /** Latest clock report from the renderer, to save the moment on demand. */
  private clockState: {
    clock: number;
    at: number;
    running: boolean;
    quality: number;
  } | null = null;
  private ghostRequests = new Map<number, (ghost: GhostFrame | null) => void>();
  private nextGhostId = 0;
  private firstFrame: () => void = () => {};
  private firstFrameDrawn = new Promise<void>(
    resolve => (this.firstFrame = resolve),
  );
  private markUnavailable: () => void = () => {};
  private unavailable = new Promise<void>(
    resolve => (this.markUnavailable = resolve),
  );

  constructor() {
    super();
    this.scene = DEFAULT_SCENE_ID;
    this.remember = false;
  }

  override render() {
    return html`<canvas aria-hidden="true"></canvas>`;
  }

  override async firstUpdated(): Promise<void> {
    const canvas = this.renderRoot.querySelector('canvas')!;
    this.shownScene = this.scene;
    this.applyBase(this.scene);
    await this.startRenderer(canvas, this.scene);

    this.send({type: 'reducedMotion', reduced: this.motionQuery.matches});
    this.send({
      type: 'visible',
      visible: document.visibilityState === 'visible',
    });
    this.motionQuery.addEventListener('change', this.onMotionChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const {width, height} = entry.contentRect;
      this.send({type: 'resize', width, height});
    });
    this.resizeObserver.observe(this);

    if (this.remember) {
      window.addEventListener('pagehide', this.saveClock);
      // Reload starts here: capture the freshest ghost while the old page
      // is still alive; the new page reads it moments later.
      window.addEventListener('beforeunload', this.saveMoment);
      this.scheduleSaves();
    }

    const outcome = await Promise.race([
      this.firstFrameDrawn.then(() => 'live' as const),
      this.unavailable.then(() => 'unavailable' as const),
      wait(STILL_AFTER_MS).then(() => 'slow' as const),
    ]);
    if (outcome === 'live') {
      await this.reveal(canvas);
      return;
    }
    // No live scene (yet): show its still so the page never waits.
    await this.revealStill();
    if (outcome === 'slow') {
      await this.firstFrameDrawn;
      await this.reveal(canvas);
    }
  }

  /** Shows the scene's still gradient in place of the live scene. */
  private async revealStill(): Promise<void> {
    this.setAttribute('still', '');
    if (this.remember && arrival() === 'resume') releaseGhost();
    this.dispatchEvent(
      new CustomEvent('tarn-revealed', {
        bubbles: true,
        composed: true,
        detail: {inPlace: false, live: false},
      }),
    );
    await wait(REVEAL_MS);
  }

  /**
   * Frosts the scene behind widgets (see glass.ts): `rects` holds x, y,
   * width and height per widget, in viewport CSS pixels.
   */
  setTiles(rects: number[], strength: number, radius: number): void {
    this.tiles = {rects, strength, radius};
    this.sendTiles();
  }

  private tiles: {rects: number[]; strength: number; radius: number} | null =
    null;

  /**
   * Sends the tiles to the renderer. While the scene settles from slightly
   * enlarged, the canvas is scaled around the center, so the frost is drawn
   * at the inverse scale to land exactly behind the widgets.
   */
  private sendTiles(): void {
    if (!this.tiles) return;
    const {rects, strength, radius} = this.tiles;
    const canvas = this.renderRoot.querySelector('canvas');
    const transform = canvas ? getComputedStyle(canvas).transform : 'none';
    const scale = transform.startsWith('matrix(')
      ? Number.parseFloat(transform.slice(7))
      : 1;
    if (!(scale > 0) || Math.abs(scale - 1) < 1e-4) {
      this.send({type: 'tiles', rects, strength, radius});
      return;
    }
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const scaled = rects.map((value, i) => {
      if (i % 4 === 0) return cx + (value - cx) / scale;
      if (i % 4 === 1) return cy + (value - cy) / scale;
      return value / scale;
    });
    this.send({type: 'tiles', rects: scaled, strength, radius: radius / scale});
  }

  /** Keeps the frost aligned every frame until the settle has finished. */
  private followSettle(duration: number): void {
    const end = performance.now() + duration + 50;
    const step = () => {
      this.sendTiles();
      if (performance.now() < end) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  override updated(changed: PropertyValues<this>): void {
    if (
      changed.has('scene') &&
      this.shownScene !== null &&
      this.scene !== this.shownScene
    ) {
      void this.crossfadeTo(this.scene);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.motionQuery.removeEventListener('change', this.onMotionChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.saveClock);
    window.removeEventListener('beforeunload', this.saveMoment);
    clearTimeout(this.clockTimer);
    this.resizeObserver?.disconnect();
    this.worker?.terminate();
    this.local?.dispose();
    this.worker = null;
    this.local = null;
  }

  /**
   * Shows the first live frame. A reload continues exactly where the old
   * page was, so it appears in place; a new tab eases in and settles.
   */
  private async reveal(canvas: HTMLCanvasElement): Promise<void> {
    const reduced = this.motionQuery.matches;
    const inPlace = this.remember && arrival() === 'resume';
    let duration = 0;
    if (inPlace) {
      canvas.style.transition = 'none';
    } else if (reduced) {
      duration = FADE_MS;
      canvas.style.transition = `opacity ${FADE_MS}ms ease`;
    } else {
      duration = SETTLE_MS;
      canvas.style.transition = `opacity ${REVEAL_MS}ms ${EASE_OUT}, transform ${SETTLE_MS}ms ${EASE_OUT}`;
    }
    canvas.style.opacity = '1';
    canvas.style.transform = 'none';
    if (duration) this.followSettle(duration);
    if (inPlace) {
      // The worker's frame can reach the screen a frame or two after it
      // reports being drawn, so the ghost stays underneath a while longer;
      // it is fully covered by the opaque live scene meanwhile.
      window.setTimeout(releaseGhost, GHOST_RELEASE_MS);
    }
    this.dispatchEvent(
      new CustomEvent('tarn-revealed', {
        bubbles: true,
        composed: true,
        detail: {inPlace, live: true},
      }),
    );
    await wait(duration);
    await nextFrame();
    canvas.style.transition = '';
    this.setAttribute('ready', '');
  }

  private async startRenderer(
    canvas: HTMLCanvasElement,
    sceneId: string,
  ): Promise<void> {
    // A reload starts exactly at the painted ghost's moment, so the ghost
    // frame and the first live frame are the same picture.
    const ghostClock =
      this.remember && arrival() === 'resume' ? paintedGhostClock() : undefined;
    const startClock = this.remember
      ? (ghostClock ?? resumeClock())
      : undefined;
    // In dev, modules are served from the WXT dev server (http://localhost),
    // and Chrome kills an extension new tab that starts a worker from that
    // origin. Dev renders on the main thread; production builds use the worker.
    if (!import.meta.env.DEV && 'transferControlToOffscreen' in canvas) {
      const offscreen = canvas.transferControlToOffscreen();
      this.worker = new Worker(new URL('./render.worker.ts', import.meta.url), {
        type: 'module',
      });
      // A worker that fails to start would otherwise leave the page waiting.
      this.worker.onerror = () => this.markUnavailable();
      this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
        const message = event.data;
        if (message.type === 'firstFrame') {
          this.firstFrame();
        } else if (message.type === 'unavailable') {
          this.markUnavailable();
        } else if (message.type === 'ghost') {
          this.ghostRequests.get(message.id)?.(message.ghost);
          this.ghostRequests.delete(message.id);
        } else {
          this.clockState = message;
        }
      };
      const init: WorkerInit = {
        type: 'init',
        canvas: offscreen,
        scene: sceneId,
        clock: startClock,
      };
      this.worker.postMessage(init, [offscreen]);
    } else {
      const {Renderer} = await import('./renderer');
      this.local = new Renderer(canvas, sceneById(sceneId), startClock, {
        onFirstFrame: () => this.firstFrame(),
        onUnavailable: () => this.markUnavailable(),
        onClock: (clock, at, running, quality) =>
          (this.clockState = {clock, at, running, quality}),
      });
    }
    // A reload frosts the widgets' places from the first live frame, as the
    // ghost frame did, so they never blink (app/tile-memory.ts).
    const tiles = ghostClock !== undefined ? rememberedTiles() : null;
    if (tiles?.rects.length) {
      this.send({
        type: 'tiles',
        rects: tiles.rects,
        strength: 1,
        radius: tiles.radius,
      });
    }
  }

  private requestGhost(): Promise<GhostFrame | null> {
    if (this.local) return this.local.ghost().catch(() => null);
    if (!this.worker) return Promise.resolve(null);
    const id = this.nextGhostId++;
    const request: GhostRequest = {type: 'ghost', id};
    return new Promise(resolve => {
      this.ghostRequests.set(id, resolve);
      this.worker!.postMessage(request);
    });
  }

  /** Saves the clock now and, while visible, a fresh ghost frame. */
  private saveMoment = () => {
    this.saveClock();
    if (document.visibilityState !== 'visible' || !this.hasAttribute('ready')) {
      return;
    }
    const scene = this.shownScene;
    void this.requestGhost().then(ghost => {
      if (ghost && scene && scene === this.shownScene) {
        rememberGhost(scene, ghost);
      }
    });
  };

  private scheduleSaves(): void {
    const speed = sceneById(this.shownScene ?? this.scene).speed;
    // A device the quality governor has stepped down saves less often.
    const slowdown = 1 + (this.clockState?.quality ?? 0);
    const every =
      Math.min(SAVE_MAX_MS, Math.max(SAVE_MIN_MS, GHOST_MOTION / speed)) *
      slowdown;
    this.clockTimer = window.setTimeout(() => {
      this.saveMoment();
      this.scheduleSaves();
    }, every);
  }

  /** Saves the moment on screen right now, for the next page to continue. */
  private saveClock = () => {
    const state = this.clockState;
    if (!state) return;
    const now = performance.timeOrigin + performance.now();
    const clock = state.running
      ? state.clock + Math.max(0, now - state.at) / 1000
      : state.clock;
    rememberClock(clock);
  };

  private async crossfadeTo(sceneId: string): Promise<void> {
    const canvas = this.renderRoot.querySelector('canvas')!;
    this.shownScene = sceneId;
    canvas.style.opacity = '0';
    this.applyBase(sceneId);
    await wait(FADE_MS);
    if (this.shownScene !== sceneId) return;
    this.send({type: 'scene', id: sceneId});
    await nextFrame();
    await nextFrame();
    if (this.shownScene === sceneId) canvas.style.opacity = '1';
  }

  private applyBase(sceneId: string): void {
    const scene = sceneById(sceneId);
    this.style.setProperty('--backdrop-base', scene.base);
    this.style.setProperty('--backdrop-still', sceneStill(scene));
  }

  private send(command: RendererCommand): void {
    if (this.worker) this.worker.postMessage(command);
    else if (this.local) applyCommand(this.local, command);
  }

  private onMotionChange = (event: MediaQueryListEvent) => {
    this.send({type: 'reducedMotion', reduced: event.matches});
  };

  private onVisibilityChange = () => {
    const visible = document.visibilityState === 'visible';
    if (!visible && this.remember) this.saveClock();
    this.send({type: 'visible', visible});
  };
}

customElements.define('tarn-backdrop', TarnBackdrop);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-backdrop': TarnBackdrop;
  }
}
