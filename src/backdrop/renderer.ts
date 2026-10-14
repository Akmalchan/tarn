/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {toBase64} from '../app/codec';
import {GLASS_FRAGMENT, GLASS_VERTEX, MAX_TILES} from './glass';
import {createNoiseTexture} from './noise-texture';
import {QualityGovernor, initialQualityLevel} from './quality';
import {VERTEX_SHADER, fragmentSource} from './scenes/glsl';
import {getWallpaperImage} from '../wallpapers/store';
import {DEFAULT_SCENE_ID, sceneById, sceneTone} from './scenes';
import type {Hex, Scene} from './scenes/types';

export type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * A small still of a frame, ready to store: raw RGB pixels as base64 (encoded
 * here, off the main thread), its moment and mean color.
 */
export interface GhostFrame {
  readonly width: number;
  readonly height: number;
  readonly data: string;
  readonly clock: number;
  readonly color: string;
}

/** One step of the GPU shrink for ghost frames. */
interface ShrinkStep {
  readonly width: number;
  readonly height: number;
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
}

/** Lets the page follow the renderer without polling it. */
export interface RendererEvents {
  /** The first frame at the real size has been drawn. */
  onFirstFrame?: () => void;
  /** A frame of this scene is on screen (a photo may take a moment). */
  onSceneShown?: (id: string) => void;
  /** WebGL2 is unavailable (disabled or blocked GPU); nothing will draw. */
  onUnavailable?: () => void;
  /**
   * The animation clock: sent when it starts or stops, and every second
   * while running. `at` is the wall time (ms) the clock value was read;
   * `quality` is the governor's level (0 = full quality).
   */
  onClock?: (
    clock: number,
    at: number,
    running: boolean,
    quality: number,
    rate: number,
  ) => void;
}

/** Fallback pacing where requestAnimationFrame is unavailable. */
const FALLBACK_INTERVAL_MS = 1000 / 30;

/**
 * A new tab starts its clock from the wall clock (wrapped to this period),
 * so opening tabs continues the motion instead of restarting it.
 */
const TIME_PERIOD_S = 7200;

/**
 * Width of the ghost frame: a small still that covers the single frame
 * between a reload's old and new page. Wide enough to keep fine detail
 * (Wave's light lines); stored raw (~190 KB) in per-tab sessionStorage.
 */
const GHOST_WIDTH = 320;

/**
 * Animation time beyond which a hidden tab quietly wraps its clock: float32
 * shader time loses precision as it grows, and nobody sees a hidden tab.
 */
const CLOCK_WRAP_AFTER_S = TIME_PERIOD_S * 12;

/** Longest step the clock may take between frames, so stalls never jump. */
const MAX_STEP_MS = 100;
/** Between frames, wake this long before the next is due (timer slack). */
const WAKE_EARLY_MS = 12;

/**
 * How lively the scene is: `active` while someone is using the page, `calm`
 * when nobody has for a while (1 min). It never stops.
 */
export type Pace = 'active' | 'calm';
export const PACES: readonly Pace[] = ['active', 'calm'];

/** Animation speed at each pace, relative to the scene's own speed. */
const PACE_RATE: Readonly<Record<Pace, number>> = {active: 1, calm: 0.4};
/**
 * How quickly the speed eases toward a new pace (time constants, s):
 * settling down is slow (about 10 s from active to calm, nothing you can
 * catch happening); waking up is quick.
 */
const EASE_DOWN_S = 3;
const EASE_UP_S = 0.5;

interface CompiledScene {
  program: WebGLProgram;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uColors: WebGLUniformLocation | null;
  uPhotoSize: WebGLUniformLocation | null;
  colors: Float32Array;
}

/** A photo scene's image, uploaded once at the size the screen needs. */
interface PhotoTexture {
  id: string;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface GlassProgram {
  program: WebGLProgram;
  uFrame: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uScale: WebGLUniformLocation | null;
  uTiles: WebGLUniformLocation | null;
  uTileCount: WebGLUniformLocation | null;
  uRadius: WebGLUniformLocation | null;
  uStrength: WebGLUniformLocation | null;
  uFrost: WebGLUniformLocation | null;
}

/** The offscreen frame the glass pass reads, with its mipmaps. */
interface FrameTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

/** Texture unit for the glass pass; unit 0 holds the noise texture. */
const FRAME_UNIT = 1;
/** Texture unit for a photo scene's image. */
const PHOTO_UNIT = 2;

const requestFrame: (cb: FrameRequestCallback) => number =
  typeof requestAnimationFrame === 'function'
    ? cb => requestAnimationFrame(cb)
    : cb => setTimeout(() => cb(performance.now()), FALLBACK_INTERVAL_MS);

const cancelFrame: (id: number) => void =
  typeof cancelAnimationFrame === 'function'
    ? id => cancelAnimationFrame(id)
    : id => clearTimeout(id);

/**
 * Draws a {@link Scene} full-screen with WebGL2. Works on a regular canvas
 * or an OffscreenCanvas inside a worker; the caller decides which.
 */
export class Renderer {
  private gl: WebGL2RenderingContext | null = null;
  private compiled = new Map<string, CompiledScene>();
  private scene: Scene;
  private cssWidth = 1;
  private cssHeight = 1;
  private visible = true;
  private reducedMotion = false;
  private frameId = 0;
  /** The loop is running (waiting for a frame callback or on its timer). */
  private looping = false;
  private waitTimer: ReturnType<typeof setTimeout> | 0 = 0;
  private lastFrameAt = 0;
  /** Trades resolution and frame rate for smoothness on weak devices. */
  private governor = new QualityGovernor(
    initialQualityLevel({
      cores: navigator.hardwareConcurrency,
      memoryGb: (navigator as {deviceMemory?: number}).deviceMemory,
    }),
  );
  /**
   * Animation time in seconds. It only advances while frames are drawn, so
   * returning to a hidden tab resumes exactly where it stopped.
   */
  private clock: number;
  private clockAt = 0;
  private clockReportedAt = 0;
  /** No drawing until the real size is known: never show a 300x150 frame. */
  private sized = false;
  private firstFrameDrawn = false;
  /** Widget rectangles to frost, in CSS pixels: x, y, width, height. */
  private tiles = new Float32Array(MAX_TILES * 4);
  private tileCount = 0;
  private glassStrength = 0;
  private glassRadius = 24;
  private glass: GlassProgram | null = null;
  private pace: Pace = 'active';
  /** Current speed multiplier, easing toward the pace's rate. */
  private rate = 1;
  /** Tiles moved since the last frame: draw the next one without waiting. */
  private tilesMoved = false;
  private frame: FrameTarget | null = null;
  private photo: PhotoTexture | null = null;
  /** The photo being decoded, if any. */
  private photoLoading: string | null = null;
  /** The scene whose frame is on screen, for `onSceneShown`. */
  private shownSceneId: string | null = null;

  /**
   * @param startClock Animation time to start from, e.g. where the previous
   *     page left off, so a reload continues the motion seamlessly.
   */
  constructor(
    private readonly canvas: RenderCanvas,
    scene: Scene,
    startClock?: number,
    private readonly events: RendererEvents = {},
  ) {
    this.scene = scene;
    this.clock =
      startClock ??
      ((performance.timeOrigin + performance.now()) / 1000) % TIME_PERIOD_S;
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.stopLoop();
      this.gl = null;
      this.compiled.clear();
      this.glass = null;
      this.shrink = null;
      this.frame = null;
      this.photo = null;
      this.photoLoading = null;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.initContext();
      this.refresh();
    });
    this.initContext();
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    if (!scene.photo) this.freePhoto();
    this.applySize();
    this.refresh();
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.sized = true;
    this.applySize();
    // A window grown past what the photo was decoded for: decode it again.
    if (
      this.scene.photo &&
      this.photo &&
      this.photo.width < this.photoWidth() * 0.9
    ) {
      this.loadPhoto(this.scene.id);
    }
    this.refresh();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible && this.clock > CLOCK_WRAP_AFTER_S) {
      this.clock %= TIME_PERIOD_S;
    }
    this.refresh();
  }

  /**
   * Frosts the scene behind widgets. `rects` holds x, y, width, height per
   * widget in CSS pixels; `strength` (0..1) follows the widgets' fade.
   * Redraws at once, so the frost moves with widgets as they animate.
   */
  setTiles(rects: readonly number[], strength: number, radius: number): void {
    this.tileCount = Math.min(MAX_TILES, Math.floor(rects.length / 4));
    this.tiles.fill(0);
    this.tiles.set(rects.slice(0, this.tileCount * 4));
    this.glassStrength = Math.min(1, Math.max(0, strength));
    this.glassRadius = radius;
    if (!this.visible || !this.sized) return;
    // While the scene animates, the next frame picks the tiles up (at most
    // one draw per display frame, however many updates arrive). Otherwise
    // nothing else would draw, so draw now.
    if (this.looping) {
      this.tilesMoved = true;
      // Asleep between frames: wake now so the frost keeps up.
      if (this.waitTimer) {
        clearTimeout(this.waitTimer);
        this.waitTimer = 0;
        this.frameId = requestFrame(this.tick);
      }
    } else {
      this.draw();
    }
  }

  /** Eases the animation toward a new pace; see {@link Pace}. */
  setPace(pace: Pace): void {
    if (pace === this.pace || !PACES.includes(pace)) return;
    this.pace = pace;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.refresh();
  }

  /**
   * Draws the current moment and returns it as raw RGB pixels at GHOST_WIDTH.
   * Raw, so the next page can paint it synchronously with no image decode.
   */
  async ghost(): Promise<GhostFrame | null> {
    if (!this.gl || !this.sized || !this.ready()) return null;
    // Capture in the same task as the draw, before the buffer is presented.
    this.draw();
    const clock = this.clock;
    const width = GHOST_WIDTH;
    const height = Math.max(
      1,
      Math.round((GHOST_WIDTH * this.canvas.height) / this.canvas.width),
    );
    // Shrink on the GPU (halving blits, so each step averages 2x2 pixels)
    // and read back only the small result: reading the full frame back
    // and scaling it on the CPU was most of the worker's time.
    const rgba = await this.readSmall(width, height);
    if (!rgba) return null;
    const pixels = new Uint8Array(width * height * 3);
    // readPixels starts at the bottom row; the ghost is stored top down.
    for (let y = 0, j = 0; y < height; y++) {
      const row = (height - 1 - y) * width * 4;
      for (let x = 0; x < width; x++, j += 3) {
        const i = row + x * 4;
        pixels[j] = rgba[i]!;
        pixels[j + 1] = rgba[i + 1]!;
        pixels[j + 2] = rgba[i + 2]!;
      }
    }
    return {
      width,
      height,
      data: toBase64(pixels),
      clock,
      color: averageColor(rgba),
    };
  }

  /** Framebuffers that shrink a frame step by step, kept between ghosts. */
  private shrink: {width: number; height: number; steps: ShrinkStep[]} | null =
    null;

  /**
   * The frame just drawn, scaled to width x height, as RGBA rows from the
   * bottom. Each blit halves the size until the next would pass the
   * target, then a last blit lands on it. The pixels come back through a
   * pixel buffer once the GPU is done, so the worker never waits on it.
   */
  private async readSmall(
    width: number,
    height: number,
  ): Promise<Uint8Array | null> {
    const gl = this.gl;
    if (!gl) return null;
    const source = {width: this.canvas.width, height: this.canvas.height};
    if (
      !this.shrink ||
      this.shrink.width !== source.width ||
      this.shrink.height !== source.height
    ) {
      this.freeShrink();
      const steps: ShrinkStep[] = [];
      let w = source.width;
      let h = source.height;
      while (w / 2 >= width) {
        w = Math.max(width, Math.floor(w / 2));
        h = Math.max(height, Math.floor(h / 2));
        steps.push(this.shrinkStep(gl, w, h));
      }
      if (w !== width || h !== height) {
        steps.push(this.shrinkStep(gl, width, height));
      }
      this.shrink = {...source, steps};
    }
    let from: WebGLFramebuffer | null = null;
    let fromW = source.width;
    let fromH = source.height;
    for (const step of this.shrink.steps) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, step.framebuffer);
      gl.blitFramebuffer(
        0,
        0,
        fromW,
        fromH,
        0,
        0,
        step.width,
        step.height,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
      );
      from = step.framebuffer;
      fromW = step.width;
      fromH = step.height;
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from);
    const size = width * height * 4;
    const buffer = gl.createBuffer();
    if (!buffer) return null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, size, gl.STREAM_READ);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    try {
      // Check back between frames until the copy is done (~1-3 frames).
      for (let tries = 0; ; tries++) {
        if (!fence || this.gl !== gl) return null;
        const status = gl.clientWaitSync(fence, 0, 0);
        if (
          status === gl.ALREADY_SIGNALED ||
          status === gl.CONDITION_SATISFIED
        ) {
          break;
        }
        if (status === gl.WAIT_FAILED || tries > 100) return null;
        await new Promise(resolve => setTimeout(resolve, 8));
      }
      const rgba = new Uint8Array(size);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, rgba);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return rgba;
    } finally {
      if (this.gl === gl) {
        if (fence) gl.deleteSync(fence);
        gl.deleteBuffer(buffer);
      }
    }
  }

  private shrinkStep(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
  ): ShrinkStep {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {width, height, texture, framebuffer};
  }

  private freeShrink(): void {
    const gl = this.gl;
    if (gl && this.shrink) {
      for (const step of this.shrink.steps) {
        gl.deleteFramebuffer(step.framebuffer);
        gl.deleteTexture(step.texture);
      }
    }
    this.shrink = null;
  }

  dispose(): void {
    this.stopLoop();
    this.freeShrink();
    const gl = this.gl;
    if (gl) {
      for (const c of this.compiled.values()) gl.deleteProgram(c.program);
      if (this.glass) gl.deleteProgram(this.glass.program);
      if (this.frame) {
        gl.deleteFramebuffer(this.frame.framebuffer);
        gl.deleteTexture(this.frame.texture);
      }
      if (this.photo) gl.deleteTexture(this.photo.texture);
    }
    this.photo = null;
    this.photoLoading = null;
    this.compiled.clear();
    this.glass = null;
    this.frame = null;
    this.gl = null;
  }

  private initContext(): void {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) {
      this.events.onUnavailable?.();
      return;
    }
    this.gl = gl;
    // WebGL2 needs a bound VAO to draw, even with no attributes.
    gl.bindVertexArray(gl.createVertexArray());
    // Bound once to unit 0 for the lifetime of the context.
    createNoiseTexture(gl);
  }

  private applySize(): void {
    const scale = this.scene.resolution * this.governor.level.scale;
    const width = Math.max(1, Math.round(this.cssWidth * scale));
    const height = Math.max(1, Math.round(this.cssHeight * scale));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  /** Reconciles the loop with visibility and motion preferences. */
  private refresh(): void {
    if (!this.sized) return;
    if (!this.visible) {
      this.stopLoop();
      return;
    }
    // A photo never moves: one frame, then nothing until something changes
    // (tiles, size). Reduced motion stills a scene the same way.
    if (this.reducedMotion || this.scene.photo) {
      this.stopLoop();
      this.draw();
      // Tell the page the (stopped) moment, so it saves one ghost, not one
      // a second.
      this.reportClock(false);
      return;
    }
    this.draw();
    if (!this.looping) {
      this.looping = true;
      this.clockAt = performance.now();
      this.frameId = requestFrame(this.tick);
      this.reportClock(true);
    }
  }

  /**
   * Waits for the next frame. Between frames the loop sleeps on a timer and
   * only rejoins the display's frame callbacks just before a frame is due,
   * instead of waking at every refresh (up to 120 times a second) to skip
   * it. The frame itself is still drawn in step with the display.
   */
  private scheduleNext(delayMs: number): void {
    if (delayMs > WAKE_EARLY_MS * 2) {
      this.waitTimer = setTimeout(() => {
        this.waitTimer = 0;
        if (this.looping) this.frameId = requestFrame(this.tick);
      }, delayMs - WAKE_EARLY_MS);
    } else {
      this.frameId = requestFrame(this.tick);
    }
  }

  private tick = (now: number): void => {
    this.frameId = 0;
    if (!this.looping) return;
    const target = PACE_RATE[this.pace];
    // The frame rate follows the speed, but less than in proportion: calm
    // runs at 40% speed and 20 fps, so each frame moves the picture only
    // 60% as far as at full speed, and settling down never looks choppier.
    const fps = 2 / 3 + (Math.max(this.rate, 0.4) - 0.4) * (1 / 1.8);
    const interval = this.governor.frameIntervalMs / fps;
    const sinceLastFrame = now - this.lastFrameAt;
    if (this.tilesMoved && sinceLastFrame < interval - 2) {
      // Tiles are gliding: redraw now so the frost keeps up with them, but
      // leave the animation clock and the quality governor alone.
      this.tilesMoved = false;
      this.draw();
      this.scheduleNext(interval - sinceLastFrame);
      return;
    }
    if (sinceLastFrame < interval - 2) {
      this.scheduleNext(interval - sinceLastFrame);
      return;
    }
    this.tilesMoved = false;
    this.lastFrameAt = now;
    // Only full-speed frames tell the governor how the device is coping.
    if (this.rate > 0.98 && this.governor.record(sinceLastFrame)) {
      this.applySize();
    }
    const step = Math.min(Math.max(now - this.clockAt, 0), MAX_STEP_MS) / 1000;
    this.clockAt = now;
    const ease = target < this.rate ? EASE_DOWN_S : EASE_UP_S;
    this.rate += (target - this.rate) * (1 - Math.exp(-step / ease));
    if (Math.abs(target - this.rate) < 0.002) this.rate = target;
    this.clock += step * this.rate;
    this.draw();
    if (now - this.clockReportedAt > 1000) this.reportClock(true);
    this.scheduleNext(interval);
  };

  private reportClock(running: boolean): void {
    this.clockReportedAt = performance.now();
    this.events.onClock?.(
      this.clock,
      performance.timeOrigin + performance.now(),
      running,
      this.governor.index,
      this.rate,
    );
  }

  private stopLoop(): void {
    if (this.looping) {
      if (this.frameId) cancelFrame(this.frameId);
      clearTimeout(this.waitTimer);
      this.reportClock(false);
    }
    this.looping = false;
    this.frameId = 0;
    this.waitTimer = 0;
  }

  private draw(): void {
    const gl = this.gl;
    if (!gl) return;
    // A photo draws once its image is ready; until then the last frame (or
    // the page's base color) stays.
    if (!this.ready()) {
      this.loadPhoto(this.scene.id);
      return;
    }
    const compiled = this.compile(gl, this.scene);
    if (!compiled) return;

    const {width, height} = this.canvas;
    const target =
      this.tileCount > 0 && this.glassStrength > 0
        ? this.frameTarget(gl, width, height)
        : null;
    const glass = target ? this.glassProgram(gl) : null;

    // With widgets on screen the scene goes to a texture first; otherwise
    // straight to the canvas, exactly as before.
    gl.bindFramebuffer(gl.FRAMEBUFFER, glass ? target!.framebuffer : null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(compiled.program);
    gl.uniform2f(compiled.uResolution, width, height);
    gl.uniform1f(compiled.uTime, this.clock * this.scene.speed);
    gl.uniform3fv(compiled.uColors, compiled.colors);
    if (this.scene.photo && this.photo) {
      gl.activeTexture(gl.TEXTURE0 + PHOTO_UNIT);
      gl.bindTexture(gl.TEXTURE_2D, this.photo.texture);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(compiled.uPhotoSize, this.photo.width, this.photo.height);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (glass && target) this.drawGlass(gl, glass, target);
    if (!this.firstFrameDrawn) {
      this.firstFrameDrawn = true;
      this.events.onFirstFrame?.();
    }
    if (this.shownSceneId !== this.scene.id) {
      this.shownSceneId = this.scene.id;
      this.events.onSceneShown?.(this.scene.id);
    }
  }

  /** Whether the current scene can draw: a photo needs its image. */
  private ready(): boolean {
    return !this.scene.photo || this.photo?.id === this.scene.id;
  }

  /** The width a photo needs to cover the canvas without upscaling. */
  private photoWidth(): number {
    const size = this.scene.photo;
    if (!size) return 0;
    const cover = Math.max(
      this.canvas.width / size.width,
      this.canvas.height / size.height,
    );
    return Math.ceil(size.width * Math.min(1, cover));
  }

  /**
   * Decodes a photo off the page (in the worker, in production) at the
   * size the screen needs, and uploads it once. A photo that's gone shows
   * the default scene instead.
   */
  private loadPhoto(id: string): void {
    const size = this.scene.photo;
    if (!size || this.photoLoading === id || !this.sized) return;
    this.photoLoading = id;
    const width = this.photoWidth();
    const height = Math.ceil((width * size.height) / size.width);
    void getWallpaperImage(id)
      .then(blob =>
        blob
          ? createImageBitmap(blob, {
              resizeWidth: width,
              resizeHeight: height,
              resizeQuality: 'high',
            })
          : null,
      )
      .catch(() => null)
      .then(bitmap => {
        if (this.photoLoading !== id) {
          bitmap?.close();
          return;
        }
        this.photoLoading = null;
        const gl = this.gl;
        if (!bitmap) {
          if (this.scene.id === id) this.setScene(sceneById(DEFAULT_SCENE_ID));
          return;
        }
        if (!gl) {
          bitmap.close();
          return;
        }
        this.uploadPhoto(gl, id, bitmap);
        if (this.scene.id === id) this.refresh();
      });
  }

  private uploadPhoto(
    gl: WebGL2RenderingContext,
    id: string,
    bitmap: ImageBitmap,
  ): void {
    const texture = gl.createTexture();
    if (!texture) {
      bitmap.close();
      return;
    }
    gl.activeTexture(gl.TEXTURE0 + PHOTO_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bitmap,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    if (this.photo) gl.deleteTexture(this.photo.texture);
    this.photo = {id, texture, width: bitmap.width, height: bitmap.height};
    bitmap.close();
  }

  /** Frees the photo's GPU memory once another scene shows. */
  private freePhoto(): void {
    if (this.photo) this.gl?.deleteTexture(this.photo.texture);
    this.photo = null;
    this.photoLoading = null;
  }

  private drawGlass(
    gl: WebGL2RenderingContext,
    glass: GlassProgram,
    target: FrameTarget,
  ): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0 + FRAME_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.useProgram(glass.program);
    gl.uniform2f(glass.uResolution, target.width, target.height);
    gl.uniform1f(glass.uScale, target.width / this.cssWidth);
    gl.uniform4fv(glass.uTiles, this.tiles);
    gl.uniform1i(glass.uTileCount, this.tileCount);
    gl.uniform1f(glass.uRadius, this.glassRadius);
    gl.uniform1f(glass.uStrength, this.glassStrength);
    gl.uniform1f(glass.uFrost, sceneTone(this.scene) === 'light' ? 0.28 : 0.09);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** The texture the scene renders into when widgets need frosting. */
  private frameTarget(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
  ): FrameTarget | null {
    const current = this.frame;
    if (current && current.width === width && current.height === height) {
      return current;
    }
    if (current) {
      gl.deleteFramebuffer(current.framebuffer);
      gl.deleteTexture(current.texture);
      this.frame = null;
    }
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) return null;
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    gl.activeTexture(gl.TEXTURE0 + FRAME_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, width, height);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    const complete =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!complete) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      return null;
    }
    this.frame = {framebuffer, texture, width, height};
    return this.frame;
  }

  private glassProgram(gl: WebGL2RenderingContext): GlassProgram | null {
    if (this.glass) return this.glass;
    const program = linkProgram(gl, GLASS_VERTEX, GLASS_FRAGMENT);
    if (!program) return null;
    const u = (name: string) => gl.getUniformLocation(program, name);
    this.glass = {
      program,
      uFrame: u('uFrame'),
      uResolution: u('uResolution'),
      uScale: u('uScale'),
      uTiles: u('uTiles'),
      uTileCount: u('uTileCount'),
      uRadius: u('uRadius'),
      uStrength: u('uStrength'),
      uFrost: u('uFrost'),
    };
    gl.useProgram(program);
    gl.uniform1i(this.glass.uFrame, FRAME_UNIT);
    return this.glass;
  }

  private compile(
    gl: WebGL2RenderingContext,
    scene: Scene,
  ): CompiledScene | null {
    const cached = this.compiled.get(scene.id);
    if (cached) return cached;

    const program = linkProgram(
      gl,
      VERTEX_SHADER,
      fragmentSource(scene.fragment),
    );
    if (!program) return null;
    const compiled: CompiledScene = {
      program,
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uColors: gl.getUniformLocation(program, 'uColors'),
      uPhotoSize: gl.getUniformLocation(program, 'uPhotoSize'),
      colors: new Float32Array(scene.colors.flatMap(hexToRgb)),
    };
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uNoise'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'uPhoto'), PHOTO_UNIT);
    this.compiled.set(scene.id, compiled);
    return compiled;
  }
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSrc: string,
): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[tarn] program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (
    !gl.getShaderParameter(shader, gl.COMPILE_STATUS) &&
    !gl.isContextLost()
  ) {
    console.error('[tarn] shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Mean color of RGBA pixels, as #rrggbb. */
export function averageColor(pixels: ArrayLike<number>): string {
  let r = 0;
  let g = 0;
  let b = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i]!;
    g += pixels[i + 1]!;
    b += pixels[i + 2]!;
  }
  const hex = (v: number) =>
    Math.round(v / count)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function hexToRgb(hex: Hex): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
