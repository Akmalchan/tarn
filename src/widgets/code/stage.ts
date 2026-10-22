/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {decidePace, nextPaceCheckMs} from '../../backdrop/pace';
import type {Scene} from '../../backdrop/scenes/types';
import {hexToRgb} from '../../ui/color';
import type {
  CodeRenderer,
  StageCommand,
  StageEvent,
  StagePace,
  TileState,
} from './renderer';

/**
 * The page's side of custom widgets: one renderer for every tile (a worker
 * in production), fed the page's state: visibility, reduced motion, the
 * pace (calm after a minute without input, like the scene) and the
 * current wallpaper's colors. Nothing exists until the first custom tile,
 * and it all goes again shortly after the last one.
 */

export interface TileListener {
  onState(state: TileState): void;
  onDrawn(): void;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** With no custom tile left this long, the stage and its worker go. */
const END_MS = 2000;

/** The wallpaper's look, kept even before any tile exists. */
let look: StageCommand = {
  type: 'look',
  colors: Array(12).fill(0.6),
  ink: [0.96, 0.97, 0.98],
};
let stage: Stage | null = null;

/** The wallpaper changed: custom widgets take its colors and ink. */
export function setCodeScene(scene: Scene, tone: 'light' | 'dark'): void {
  look = {
    type: 'look',
    colors: scene.colors.flatMap(hex => standOut(hexToRgb(hex), tone)),
    ink: tone === 'light' ? [0.086, 0.1, 0.15] : [0.96, 0.97, 0.98],
  };
  stage?.send(look);
}

export function codeStage(): Stage {
  stage ??= new Stage();
  return stage;
}

let nextId = 0;
const INPUTS = ['pointermove', 'pointerdown', 'keydown', 'wheel'];

class Stage {
  private worker: Worker | null = null;
  private local: Promise<CodeRenderer> | null = null;
  private readonly listeners = new Map<string, TileListener>();
  private pace: StagePace = 'active';
  private lastInput = performance.now();
  private paceTimer = 0;
  private endTimer = 0;
  private readonly motion = matchMedia(REDUCED_MOTION);

  constructor() {
    // In dev, modules come from the WXT dev server, and Chrome kills an
    // extension page that starts a worker from there (see tarn-backdrop):
    // dev draws on the main thread, production in a worker.
    if (
      !import.meta.env.DEV &&
      'transferControlToOffscreen' in HTMLCanvasElement.prototype
    ) {
      this.worker = new Worker(new URL('./code.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<StageEvent>) =>
        this.receive(event.data);
    } else {
      this.local = import('./renderer').then(
        ({CodeRenderer}) => new CodeRenderer(event => this.receive(event)),
      );
    }
    this.send({type: 'reduced', reduced: this.motion.matches});
    this.motion.addEventListener('change', this.onMotion);
    this.send({type: 'visible', visible: !document.hidden});
    document.addEventListener('visibilitychange', this.onVisibility);
    for (const type of INPUTS) {
      addEventListener(type, this.onInput, {passive: true, capture: true});
    }
    this.send(look);
    this.onInput();
  }

  /** No custom tile left: the worker, its context and the listeners go. */
  private end = () => {
    if (this.listeners.size) return;
    this.worker?.terminate();
    this.worker = null;
    this.local = null;
    this.motion.removeEventListener('change', this.onMotion);
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const type of INPUTS) {
      removeEventListener(type, this.onInput, {capture: true});
    }
    clearTimeout(this.paceTimer);
    if (stage === this) stage = null;
  };

  private onMotion = (event: MediaQueryListEvent) =>
    this.send({type: 'reduced', reduced: event.matches});

  private onVisibility = () => {
    this.send({type: 'visible', visible: !document.hidden});
    if (!document.hidden) this.onInput();
  };

  /** A tile's canvas; it is the renderer's from now on. */
  add(canvas: HTMLCanvasElement, listener: TileListener): string {
    const id = `tile-${nextId++}`;
    clearTimeout(this.endTimer);
    this.listeners.set(id, listener);
    if (this.worker) {
      const offscreen = canvas.transferControlToOffscreen();
      this.worker.postMessage({type: 'add', id, canvas: offscreen}, [
        offscreen,
      ]);
    } else {
      this.send({type: 'add', id, canvas});
    }
    return id;
  }

  remove(id: string): void {
    this.listeners.delete(id);
    this.send({type: 'remove', id});
    if (!this.listeners.size) {
      clearTimeout(this.endTimer);
      this.endTimer = window.setTimeout(this.end, END_MS);
    }
  }

  send(command: StageCommand): void {
    if (this.worker) this.worker.postMessage(command);
    else void this.local?.then(renderer => renderer.apply(command));
  }

  private receive(event: StageEvent): void {
    const listener = this.listeners.get(event.id);
    if (!listener) return;
    if (event.type === 'drawn') listener.onDrawn();
    else listener.onState(event.state);
  }

  private onInput = () => {
    this.lastInput = performance.now();
    if (this.pace !== 'active') this.updatePace();
    else if (!this.paceTimer) this.updatePace();
  };

  private updatePace = () => {
    clearTimeout(this.paceTimer);
    this.paceTimer = 0;
    const input = {awake: false, quietMs: performance.now() - this.lastInput};
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
}

/**
 * A wallpaper color made to show on its tile: a scene's palette starts
 * with its darkest base, which would vanish on a dark scene's frost, and
 * a light scene's pastels turn gray when simply darkened. Keeps the hue;
 * brightens on dark wallpapers, deepens and saturates on light ones.
 */
export function standOut(rgb: number[], tone: 'light' | 'dark'): number[] {
  const value = Math.max(...rgb);
  const low = Math.min(...rgb);
  const saturation = value > 0 ? (value - low) / value : 0;
  const [toValue, toSaturation] =
    tone === 'dark'
      ? [Math.max(value, 0.8), saturation]
      : [
          Math.min(value, 0.55),
          saturation > 0.05 ? Math.max(saturation, 0.6) : 0,
        ];
  if (value - low <= 0) return rgb.map(() => toValue);
  return rgb.map(
    channel =>
      toValue * (1 - (toSaturation * (value - channel)) / (value - low)),
  );
}
