/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {LitElement, css, html, unsafeCSS, type PropertyValues} from 'lit';
import {toBase64} from '../app/codec';
import {averageHex} from '../ui/color';
import {
  arrival,
  releaseGhost,
  rememberClock,
  rememberGhost,
  paintedGhostClock,
  resumeClock,
} from '../app/first-paint';
import {rememberedTiles} from '../app/tile-memory';
import {decidePace, nextPaceCheckMs} from './pace';
import {
  applyCommand,
  type GhostRequest,
  type RendererCommand,
  type WorkerEvent,
  type WorkerInit,
} from './protocol';
import type {GhostFrame, Pace, Renderer} from './renderer';
import {DEFAULT_SCENE_ID, sceneById, scenePicture, sceneStill} from './scenes';
import {isTooSlow, markTooSlow, tooSlowKey} from './too-slow';

/** Scene-to-scene crossfade. */
const FADE_MS = 400;
/** Longest a scene switch waits for the new scene's first frame. */
const SHOWN_TIMEOUT_MS = 2000;
/** Opening a new tab: the scene eases in from the browser's color... */
const REVEAL_MS = 700;
/** ...while settling from slightly enlarged, like a breath out. */
const SETTLE_MS = 1100;
const SETTLE_SCALE = 1.035;
/**
 * As the scene starts to appear, the color under it turns from the browser's
 * gray to the scene's own dark base this fast, so the half-faded scene is
 * never washed in gray. The scene's own fade above stays REVEAL_MS.
 */
const DARKEN_MS = 250;
/**
 * When the clock and widgets start fading in: at once, with the scene's first
 * frame. The owner wants them as soon as possible.
 */
const WIDGETS_AT_MS = 0;
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/**
 * How often a visible tab captures a ghost frame of its moment, for a
 * reload. Faster scenes capture more often so the ghost is never visibly
 * behind: interval = GHOST_MOTION / speed, clamped. The latest capture is
 * kept in memory and only stored when the page leaves or hides: storing
 * each one (256 K characters) was most of the page's idle work.
 */
const GHOST_MOTION = 180;
const SAVE_MIN_MS = 250;
const SAVE_MAX_MS = 1000;
/**
 * How often a visible tab saves its clock for other tabs, which continue
 * from it plus the time since. Each write wakes every Tarn page.
 */
const CLOCK_SAVE_MS = 3000;
/**
 * A lost GPU context usually comes back within moments; if it hasn't by
 * then, the scene's still takes over.
 */
const CONTEXT_RESTORE_MS = 2000;
/** How long a reload keeps its ghost underneath the live scene. */
const GHOST_RELEASE_MS = 500;
/**
 * If no live frame has arrived by then (very slow GPU, stuck worker), show
 * the scene's still picture so the page and its controls never wait.
 */
const STILL_AFTER_MS = 2500;
/**
 * Longest the still waits for its picture to decode; past that its
 * gradient shows, and the picture fades in over it once ready.
 */
const PICTURE_WAIT_MS = 300;
/**
 * A scene this computer can't keep up with gives way to its still picture
 * this slowly, so it reads as calm, not as a failure.
 */
const GIVE_WAY_MS = 1500;
/** Longer side of a ghost made from the still picture (as the renderer's). */
const PICTURE_GHOST_SIDE = 320;
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
    awake: {type: Boolean},
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
    :host([ready]),
    :host([based]) {
      background-color: var(--backdrop-base);
    }
    /* The scene as a still, under the canvas, when the live scene can't run
       here: its picture (a real frame, public/stills/), or its gradient
       while the picture loads or if it's missing. */
    :host::before,
    .picture {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0;
      transition: opacity ${FADE_MS}ms ease;
    }
    :host::before {
      background: var(--backdrop-still);
    }
    .picture {
      background: var(--backdrop-picture, none) center / cover no-repeat;
    }
    :host([still][gradient])::before,
    :host([still][pictured]) .picture {
      opacity: 1;
      transition: opacity ${REVEAL_MS}ms ${unsafeCSS(EASE_OUT)};
    }
    /* A reload shows the still in place, over its ghost. */
    :host([instant])::before,
    :host([instant]) .picture {
      transition: none;
    }
    canvas {
      /* Above the still, also once it no longer settles (no transform). */
      position: relative;
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
  /** Keep the scene fully lively regardless of input (settings are open). */
  declare awake: boolean;

  private worker: Worker | null = null;
  private local: Renderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private motionQuery = matchMedia(REDUCED_MOTION);
  private shownScene: string | null = null;
  private saveTimer = 0;
  private clockSavedAt = -Infinity;
  /** The latest ghost frame, not stored yet (see GHOST_MOTION). */
  private unsavedGhost: {scene: string; ghost: GhostFrame} | null = null;
  /**
   * `live` once the live scene is revealed; `still` when its still shows
   * instead (no WebGL2, a shader failed, the GPU context lost, or this
   * computer can't keep up with the scene).
   */
  private state: 'pending' | 'live' | 'still' = 'pending';
  /**
   * The still shows because this computer can't keep up with the scene
   * (too-slow.ts); picking it again in settings retries it live.
   */
  private resting = false;
  /** The renderer was started (not for a scene that starts resting). */
  private started = false;
  /** The still shows because the GPU context was lost and didn't return. */
  private lost = false;
  /** The current still picture, decoding or decoded. */
  private picture: {
    url: string;
    image: HTMLImageElement;
    ready: Promise<boolean>;
  } | null = null;
  private lostTimer = 0;
  /** Latest clock report from the renderer, to save the moment on demand. */
  private clockState: {
    clock: number;
    at: number;
    running: boolean;
    quality: number;
    rate: number;
  } | null = null;
  private pace: Pace = 'active';
  private lastActivity = performance.now();
  private pointerX = NaN;
  private pointerY = NaN;
  private paceTimer = 0;
  /** The scene and moment of the last saved ghost, to skip identical ones. */
  private lastGhost: {scene: string; clock: number} | null = null;
  private ghostRequests = new Map<number, (ghost: GhostFrame | null) => void>();
  /** Waiting for a scene's first frame (a photo decodes first). */
  private shownWaiters = new Map<string, () => void>();
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
    this.awake = false;
  }

  override render() {
    return html`<div class="picture" aria-hidden="true"></div>
      <canvas aria-hidden="true"></canvas>`;
  }

  override async firstUpdated(): Promise<void> {
    const canvas = this.renderRoot.querySelector('canvas')!;
    this.shownScene = this.scene;
    this.applyBase(this.scene);
    // A scene this computer couldn't keep up with lately starts as its
    // still picture, without the renderer, instead of stuttering first.
    this.resting = startsStill(this.scene);
    if (this.resting) {
      const picture = scenePicture(sceneById(this.scene));
      if (picture) void this.loadPicture(picture);
    } else {
      await this.startRenderer(canvas, this.scene, true);
    }

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
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) {
      window.addEventListener(type, this.onActivity, {passive: true});
    }
    this.updatePace();
    window.addEventListener('storage', this.onStorage);

    if (this.remember) {
      window.addEventListener('pagehide', this.saveMoment);
      // Reload starts here: the new page reads the moment moments later.
      // (Too late to capture a fresh ghost: the old page is gone ~3 ms after
      // this, and a capture takes 13-20 ms.)
      window.addEventListener('beforeunload', this.saveMoment);
      if (document.visibilityState === 'visible') this.scheduleSaves();
    }

    if (this.resting) {
      this.state = 'still';
      await this.revealStill();
      return;
    }
    // Still waiting just before the timer: decode the picture already, so
    // it's ready when needed. (Not on every page: decoding costs ~0.1 s of
    // CPU and ~10 MB of memory, for a picture rarely needed.)
    const preload = window.setTimeout(() => {
      const url = scenePicture(sceneById(this.shownScene ?? this.scene));
      if (url) void this.loadPicture(url);
    }, STILL_AFTER_MS - PICTURE_WAIT_MS);
    const outcome = await Promise.race([
      this.firstFrameDrawn.then(() => 'live' as const),
      this.unavailable.then(() => 'unavailable' as const),
      wait(STILL_AFTER_MS).then(() => 'slow' as const),
    ]);
    clearTimeout(preload);
    if (outcome === 'live') {
      await this.reveal(canvas);
      return;
    }
    // No live scene (yet): show its still so the page never waits.
    await this.revealStill();
    // Another scene may still draw (this one's shader failed).
    if (outcome === 'unavailable') this.state = 'still';
    if (outcome === 'slow') {
      await this.firstFrameDrawn;
      await this.reveal(canvas);
    }
  }

  /**
   * Shows the scene's still in place of the live scene as the page
   * arrives: easing in and settling like the live scene, or, on a reload
   * over a ghost, in place.
   */
  private async revealStill(): Promise<void> {
    const pictured = await this.prepareStill(this.shownScene ?? this.scene);
    const resume = this.remember && arrival() === 'resume';
    const inPlace = resume && pictured && paintedGhostClock() !== undefined;
    const picture = this.renderRoot.querySelector<HTMLElement>('.picture')!;
    if (inPlace) {
      this.setAttribute('instant', '');
    } else {
      // Out of the browser's gray quickly, as for the live scene.
      this.style.transition = `background-color ${DARKEN_MS}ms ease-out`;
      this.setAttribute('based', '');
      if (pictured && !this.motionQuery.matches) {
        picture.style.transform = `scale(${SETTLE_SCALE})`;
        picture.getBoundingClientRect();
        picture.style.transition = `opacity ${REVEAL_MS}ms ${EASE_OUT}, transform ${SETTLE_MS}ms ${EASE_OUT}`;
        picture.style.transform = 'none';
      }
    }
    this.setAttribute('still', '');
    if (inPlace) {
      // Kept a moment, like the live scene's hand-over.
      window.setTimeout(releaseGhost, GHOST_RELEASE_MS);
    } else if (resume) {
      releaseGhost();
    }
    this.dispatchEvent(
      new CustomEvent('tarn-revealed', {
        bubbles: true,
        composed: true,
        detail: {inPlace, live: false},
      }),
    );
    if (!inPlace) await wait(REVEAL_MS);
    this.settled(false);
    if (inPlace) {
      await nextFrame();
      this.removeAttribute('instant');
    } else {
      await wait(SETTLE_MS - REVEAL_MS);
      picture.style.transition = '';
      if (this.state !== 'live') this.style.transition = '';
    }
  }

  /**
   * Readies the still of a scene: its picture once decoded (waiting at most
   * PICTURE_WAIT_MS), otherwise its gradient, with the picture fading in
   * over it when it arrives. True if the picture is ready.
   */
  private async prepareStill(sceneId: string): Promise<boolean> {
    this.removeAttribute('pictured');
    this.removeAttribute('gradient');
    const url = scenePicture(sceneById(sceneId));
    const ready = url ? this.loadPicture(url) : Promise.resolve(false);
    const pictured = await Promise.race([
      ready,
      wait(PICTURE_WAIT_MS).then(() => false),
    ]);
    if (this.shownScene !== sceneId) return false;
    if (pictured) {
      this.showPicture(url!);
      return true;
    }
    this.setAttribute('gradient', '');
    void ready.then(late => {
      if (late && this.shownScene === sceneId && this.state !== 'live') {
        this.showPicture(url!);
      }
    });
    return false;
  }

  /** Starts decoding a still picture (once); resolves true when decoded. */
  private loadPicture(url: string): Promise<boolean> {
    if (this.picture?.url !== url) {
      const image = new Image();
      image.src = url;
      const ready = image.decode().then(
        () => true,
        () => false,
      );
      this.picture = {url, image, ready};
    }
    return this.picture.ready;
  }

  private showPicture(url: string): void {
    this.style.setProperty('--backdrop-picture', `url('${url}')`);
    this.setAttribute('pictured', '');
    // A reload shows it from its first frame. Not after a lost GPU context:
    // the GPU is probably back by then, and the last live ghost continues.
    const scene = this.shownScene;
    if (!this.remember || this.lost || !scene) return;
    void this.pictureGhost().then(ghost => {
      if (ghost && this.shownScene === scene && this.state !== 'live') {
        this.unsavedGhost = {scene, ghost};
      }
    });
  }

  /**
   * A ghost frame made from the decoded still picture. Shrunk off the main
   * thread: drawing the full picture into a small canvas took ~0.1 s.
   */
  private async pictureGhost(): Promise<GhostFrame | null> {
    const image = this.picture?.image;
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const scale =
      PICTURE_GHOST_SIDE / Math.max(image.naturalWidth, image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const bitmap = await createImageBitmap(image, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'medium',
    }).catch(() => null);
    if (!bitmap) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context?.drawImage(bitmap, 0, 0);
    bitmap.close();
    if (!context) return null;
    const rgba = context.getImageData(0, 0, width, height).data;
    const pixels = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      for (let c = 0; c < 3; c++) pixels[j + c] = rgba[i + c]!;
    }
    return {
      width,
      height,
      data: toBase64(pixels),
      clock: this.currentClock() ?? resumeClock() ?? 0,
      color: averageHex(rgba),
    };
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

  /**
   * The scene is fully faded in: widgets and their frost appear now. `live`
   * is false when only the still gradient shows.
   */
  private settled(live: boolean): void {
    this.dispatchEvent(
      new CustomEvent('tarn-settled', {
        bubbles: true,
        composed: true,
        detail: {live},
      }),
    );
  }

  override updated(changed: PropertyValues<this>): void {
    if (changed.has('awake') && this.isConnected) this.updatePace();
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
    window.removeEventListener('pagehide', this.saveMoment);
    window.removeEventListener('beforeunload', this.saveMoment);
    window.removeEventListener('storage', this.onStorage);
    clearTimeout(this.saveTimer);
    clearTimeout(this.lostTimer);
    clearTimeout(this.paceTimer);
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) {
      window.removeEventListener(type, this.onActivity);
    }
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
    this.state = 'live';
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
    if (!inPlace) {
      // Out of the browser's gray quickly; the scene still fades in gently.
      this.style.transition = `background-color ${DARKEN_MS}ms ease-out`;
      this.setAttribute('based', '');
    }
    canvas.style.opacity = '1';
    canvas.style.transform = 'none';
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
    // Widgets come in right away; while the scene settles, the frost follows
    // its scale every frame (followSettle).
    const shown = Math.min(duration, WIDGETS_AT_MS);
    if (shown) await wait(shown);
    if (duration > shown) this.followSettle(duration - shown);
    this.settled(true);
    await wait(duration - shown);
    await nextFrame();
    canvas.style.transition = '';
    this.style.transition = '';
    this.setAttribute('ready', '');
    // A still shown while the scene was slow to start goes, now covered.
    if (this.state === 'live') this.removeAttribute('still');
    // On a slow or busy machine the settle runs behind the clock, and
    // clearing the transition above snaps the scene to its final size after
    // the frost was last sent at an in-between scale: the frost then stayed
    // shrunk toward the center, offset from the tiles (seen on Windows).
    // Send it once more at the final scale.
    this.sendTiles();
  }

  /** Keeps the frost exactly behind the widgets while the scene settles. */
  private followSettle(duration: number): void {
    // Also when the settle actually ends, however late that is (opacity
    // ends earlier and is ignored).
    const canvas = this.renderRoot.querySelector('canvas');
    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName !== 'transform') return;
      canvas?.removeEventListener('transitionend', onEnd);
      this.sendTiles();
    };
    canvas?.addEventListener('transitionend', onEnd);
    const end = performance.now() + duration + 50;
    const step = () => {
      this.sendTiles();
      if (performance.now() < end) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /**
   * Starts the renderer: as the page arrives, or later (`atArrival` false)
   * when a scene that started as its still picture is to run live.
   */
  private async startRenderer(
    canvas: HTMLCanvasElement,
    sceneId: string,
    atArrival: boolean,
  ): Promise<void> {
    this.started = true;
    // A reload starts exactly at the painted ghost's moment, so the ghost
    // frame and the first live frame are the same picture.
    const ghostClock =
      atArrival && this.remember && arrival() === 'resume'
        ? paintedGhostClock()
        : undefined;
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
      this.worker.onmessage = (event: MessageEvent<WorkerEvent>) =>
        this.onRendererEvent(event.data);
      const init: WorkerInit = {
        type: 'init',
        canvas: offscreen,
        scene: sceneById(sceneId),
        clock: startClock,
      };
      this.worker.postMessage(init, [offscreen]);
    } else {
      const {Renderer} = await import('./renderer');
      const on = (event: WorkerEvent) => this.onRendererEvent(event);
      this.local = new Renderer(canvas, sceneById(sceneId), startClock, {
        onFirstFrame: () => on({type: 'firstFrame'}),
        onSceneShown: id => on({type: 'sceneShown', id}),
        onUnavailable: () => on({type: 'unavailable'}),
        onCantKeepUp: id => on({type: 'cantKeepUp', id}),
        onContextLost: () => on({type: 'contextLost'}),
        onContextRestored: () => on({type: 'contextRestored'}),
        onClock: (clock, at, running, quality, rate) =>
          on({type: 'clock', clock, at, running, quality, rate}),
      });
    }
    if (!atArrival) {
      // Everything the page told nobody while no renderer ran.
      const {width, height} = this.getBoundingClientRect();
      this.send({type: 'resize', width, height});
      this.send({type: 'reducedMotion', reduced: this.motionQuery.matches});
      this.send({
        type: 'visible',
        visible: document.visibilityState === 'visible',
      });
      this.send({type: 'pace', pace: this.pace});
      this.sendTiles();
      return;
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

  private onRendererEvent(message: WorkerEvent): void {
    if (message.type === 'firstFrame') {
      this.firstFrame();
    } else if (message.type === 'unavailable') {
      this.markUnavailable();
      void this.showStill();
    } else if (message.type === 'cantKeepUp') {
      // Remembered, so the next new tab starts with the picture at once.
      markTooSlow(message.id);
      if (message.id === sceneById(this.shownScene ?? this.scene).id) {
        this.resting = true;
        void this.showStill(true);
      }
    } else if (message.type === 'contextLost') {
      clearTimeout(this.lostTimer);
      this.lostTimer = window.setTimeout(() => {
        this.lost = true;
        void this.showStill();
      }, CONTEXT_RESTORE_MS);
    } else if (message.type === 'contextRestored') {
      clearTimeout(this.lostTimer);
    } else if (message.type === 'ghost') {
      this.ghostRequests.get(message.id)?.(message.ghost);
      this.ghostRequests.delete(message.id);
    } else if (message.type === 'sceneShown') {
      this.sceneShown(message.id);
    } else {
      this.clockState = message;
    }
  }

  /**
   * The live scene stopped drawing after it was revealed (a shader failed,
   * the GPU context is gone, the computer can't keep up): its still takes
   * over, and widgets switch to CSS glass (`tarn-settled` with `live:
   * false`). `calm`: the picture comes in under the last live frame first,
   * which then gives way slowly.
   */
  private async showStill(calm = false): Promise<void> {
    if (this.state !== 'live') return;
    this.state = 'still';
    const sceneId = this.shownScene ?? this.scene;
    await this.prepareStill(sceneId);
    if (this.state !== 'still' || this.shownScene !== sceneId) return;
    this.setAttribute('still', '');
    const canvas = this.renderRoot.querySelector('canvas')!;
    if (calm) {
      await wait(REVEAL_MS);
      if (this.state !== 'still' || this.shownScene !== sceneId) return;
      canvas.style.transition = `opacity ${GIVE_WAY_MS}ms ease`;
    }
    canvas.style.opacity = '0';
    this.settled(false);
  }

  /**
   * The scene shown as resting was picked again in settings, which forgets
   * its mark (too-slow.ts): try it live now.
   */
  private onStorage = (event: StorageEvent) => {
    const key = tooSlowKey(sceneById(this.shownScene ?? this.scene).id);
    if (!this.resting || (event.key !== null && event.key !== key)) return;
    if (event.key === key && event.newValue !== null) return;
    this.resting = false;
    const sceneId = this.shownScene ?? this.scene;
    if (this.started) {
      this.send({type: 'scene', scene: sceneById(sceneId)});
    } else {
      void this.startRenderer(
        this.renderRoot.querySelector('canvas')!,
        sceneId,
        false,
      );
    }
  };

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

  /**
   * Saves the moment for the next page: the clock, and the latest ghost
   * frame if it isn't stored yet. Synchronous, so it works as the page goes.
   */
  private saveMoment = () => {
    this.saveClock();
    const unsaved = this.unsavedGhost;
    this.unsavedGhost = null;
    if (unsaved && unsaved.scene === this.shownScene) {
      rememberGhost(unsaved.scene, unsaved.ghost);
    }
  };

  /** Captures a ghost frame of the moment on screen, kept in memory. */
  private captureGhost(): void {
    if (
      document.visibilityState !== 'visible' ||
      this.state !== 'live' ||
      !this.hasAttribute('ready')
    ) {
      return;
    }
    const scene = this.shownScene;
    // Stopped (still pace): the saved ghost already shows this exact moment.
    const clock = this.currentClock();
    if (
      scene &&
      clock !== null &&
      this.lastGhost?.scene === scene &&
      Math.abs(this.lastGhost.clock - clock) < 1e-3
    ) {
      return;
    }
    void this.requestGhost().then(ghost => {
      if (ghost && scene && scene === this.shownScene) {
        this.unsavedGhost = {scene, ghost};
        this.lastGhost = {scene, clock: ghost.clock};
      }
    });
  }

  private scheduleSaves(): void {
    clearTimeout(this.saveTimer);
    const speed = sceneById(this.shownScene ?? this.scene).speed;
    // A device the quality governor has stepped down saves less often.
    const slowdown = 1 + (this.clockState?.quality ?? 0);
    // A calmer pace moves less, so it needs fewer saves to stay current.
    const rate = Math.max(this.clockState?.rate ?? 1, 0.01);
    const every =
      Math.min(
        SAVE_MAX_MS,
        Math.max(SAVE_MIN_MS, GHOST_MOTION / (speed * rate)),
      ) * slowdown;
    this.saveTimer = window.setTimeout(() => {
      this.captureGhost();
      if (performance.now() - this.clockSavedAt >= CLOCK_SAVE_MS) {
        this.saveClock();
      }
      this.scheduleSaves();
    }, every);
  }

  /** Saves the moment on screen right now, for the next page to continue. */
  private saveClock(): void {
    const clock = this.currentClock();
    if (clock === null) return;
    rememberClock(clock);
    this.clockSavedAt = performance.now();
  }

  /** The animation moment on screen now, from the renderer's last report. */
  private currentClock(): number | null {
    const state = this.clockState;
    if (!state) return null;
    const now = performance.timeOrigin + performance.now();
    return state.running
      ? state.clock + (Math.max(0, now - state.at) / 1000) * state.rate
      : state.clock;
  }

  // ---- Pace: calmer when nobody is around ------------------------------

  private onActivity = (event?: Event) => {
    // Chrome sends synthetic pointermoves under a cursor that hasn't moved
    // (when the page changes beneath it, e.g. the clock ticking over). Only
    // a real change of position counts as someone being there.
    if (event?.type === 'pointermove') {
      const {screenX, screenY} = event as PointerEvent;
      if (screenX === this.pointerX && screenY === this.pointerY) return;
      this.pointerX = screenX;
      this.pointerY = screenY;
    }
    const now = performance.now();
    const wasQuiet = now - this.lastActivity > 1000;
    this.lastActivity = now;
    // Cheap on every event; the pace is only re-evaluated after a pause.
    if (wasQuiet || this.pace !== 'active') this.updatePace();
  };

  /** Works out the pace now and wakes again at the next threshold. */
  private updatePace = () => {
    clearTimeout(this.paceTimer);
    const input = {
      awake: this.awake,
      quietMs: performance.now() - this.lastActivity,
    };
    const pace = decidePace(input);
    if (pace !== this.pace) {
      this.pace = pace;
      this.send({type: 'pace', pace});
    }
    const next = nextPaceCheckMs(input);
    if (next !== null) {
      this.paceTimer = window.setTimeout(this.updatePace, next + 50);
    }
  };

  private async crossfadeTo(sceneId: string): Promise<void> {
    const canvas = this.renderRoot.querySelector('canvas')!;
    this.shownScene = sceneId;
    canvas.style.transition = '';
    canvas.style.opacity = '0';
    // A still picture goes with the old scene.
    this.removeAttribute('pictured');
    this.removeAttribute('gradient');
    this.applyBase(sceneId);
    await wait(FADE_MS);
    if (this.shownScene !== sceneId) return;
    // Waits under the id the scene resolves to: a photo missing on this
    // computer is drawn, and reported, as Tarn.
    const scene = sceneById(sceneId);
    this.resting = startsStill(sceneId);
    if (this.resting) {
      // This computer couldn't keep up with it lately: its picture, at once.
      this.send({type: 'hold'});
      const wasLive = this.state === 'live';
      this.state = 'still';
      await this.prepareStill(sceneId);
      if (this.shownScene !== sceneId || !this.resting) return;
      this.setAttribute('still', '');
      if (wasLive) this.settled(false);
      return;
    }
    const shown = new Promise<void>(resolve =>
      this.shownWaiters.set(scene.id, resolve),
    );
    if (this.started) this.send({type: 'scene', scene});
    else await this.startRenderer(canvas, sceneId, false);
    // A photo takes a moment to decode: fade in once it's drawn, not
    // before (the canvas would show the old scene). A cap, in case.
    await Promise.race([shown, wait(SHOWN_TIMEOUT_MS)]);
    this.shownWaiters.delete(scene.id);
    await nextFrame();
    await nextFrame();
    // Not if the new scene can't draw: the still stays (showStill).
    if (this.shownScene === sceneId && this.state !== 'still') {
      canvas.style.opacity = '1';
    }
  }

  private sceneShown(id: string): void {
    clearTimeout(this.lostTimer);
    this.shownWaiters.get(id)?.();
    if (this.state !== 'still') return;
    // Drawing again after the still took over: another scene was picked,
    // the GPU came back, or a resting scene was picked again.
    this.state = 'live';
    this.lost = false;
    const canvas = this.renderRoot.querySelector('canvas')!;
    canvas.style.transition = '';
    canvas.style.transform = 'none';
    canvas.style.opacity = '1';
    this.setAttribute('ready', '');
    this.settled(true);
    // The still goes once the scene covers it.
    window.setTimeout(() => {
      if (this.state === 'live') this.removeAttribute('still');
    }, FADE_MS);
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
    if (visible) this.onActivity();
    if (this.remember && visible) {
      this.scheduleSaves();
    } else if (this.remember) {
      // Save once, then nothing until visible again: a hidden tab's moment
      // doesn't move, and its saves would only stamp a frozen moment as new.
      this.saveMoment();
      clearTimeout(this.saveTimer);
    }
    this.send({type: 'visible', visible});
  };
}

/**
 * Whether a scene starts as its still picture on this computer, which
 * couldn't keep up with it lately (too-slow.ts).
 */
export function startsStill(sceneId: string): boolean {
  return isTooSlow(sceneById(sceneId).id);
}

customElements.define('tarn-backdrop', TarnBackdrop);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-backdrop': TarnBackdrop;
  }
}
