/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {toBase64} from '../app/codec';
import {createNoiseTexture} from './noise-texture';
import {QualityGovernor, initialQualityLevel} from './quality';
import {VERTEX_SHADER, fragmentSource} from './scenes/glsl';
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

/** Lets the page follow the renderer without polling it. */
export interface RendererEvents {
  /** The first frame at the real size has been drawn. */
  onFirstFrame?: () => void;
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

interface CompiledScene {
  program: WebGLProgram;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uColors: WebGLUniformLocation | null;
  colors: Float32Array;
}

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
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.initContext();
      this.refresh();
    });
    this.initContext();
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    this.applySize();
    this.refresh();
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.sized = true;
    this.applySize();
    this.refresh();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible && this.clock > CLOCK_WRAP_AFTER_S) {
      this.clock %= TIME_PERIOD_S;
    }
    this.refresh();
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
    if (!this.gl || !this.sized) return null;
    // Capture in the same task as the draw, before the buffer is presented.
    this.draw();
    const clock = this.clock;
    const width = GHOST_WIDTH;
    const height = Math.max(
      1,
      Math.round((GHOST_WIDTH * this.canvas.height) / this.canvas.width),
    );
    // Downscale with drawImage, which clamps at the edges (resizing in
    // createImageBitmap darkens the border by sampling outside the image).
    const bitmap = await createImageBitmap(this.canvas);
    const small = new OffscreenCanvas(width, height);
    const context = small.getContext('2d', {willReadFrequently: true});
    if (!context) {
      bitmap.close();
      return null;
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const rgba = context.getImageData(0, 0, width, height).data;
    const pixels = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      pixels[j] = rgba[i]!;
      pixels[j + 1] = rgba[i + 1]!;
      pixels[j + 2] = rgba[i + 2]!;
    }
    return {
      width,
      height,
      data: toBase64(pixels),
      clock,
      color: averageColor(rgba),
    };
  }

  dispose(): void {
    this.stopLoop();
    const gl = this.gl;
    if (gl) {
      for (const c of this.compiled.values()) gl.deleteProgram(c.program);
    }
    this.compiled.clear();
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
    if (this.reducedMotion) {
      this.stopLoop();
      this.draw();
      return;
    }
    this.draw();
    if (!this.frameId) {
      this.clockAt = performance.now();
      this.frameId = requestFrame(this.tick);
      this.reportClock(true);
    }
  }

  private tick = (now: number): void => {
    this.frameId = requestFrame(this.tick);
    const sinceLastFrame = now - this.lastFrameAt;
    if (sinceLastFrame < this.governor.frameIntervalMs - 2) return;
    this.lastFrameAt = now;
    if (this.governor.record(sinceLastFrame)) this.applySize();
    this.clock += Math.min(Math.max(now - this.clockAt, 0), MAX_STEP_MS) / 1000;
    this.clockAt = now;
    this.draw();
    if (now - this.clockReportedAt > 1000) this.reportClock(true);
  };

  private reportClock(running: boolean): void {
    this.clockReportedAt = performance.now();
    this.events.onClock?.(
      this.clock,
      performance.timeOrigin + performance.now(),
      running,
      this.governor.index,
    );
  }

  private stopLoop(): void {
    if (this.frameId) {
      cancelFrame(this.frameId);
      this.reportClock(false);
    }
    this.frameId = 0;
  }

  private draw(): void {
    const gl = this.gl;
    if (!gl) return;
    const compiled = this.compile(gl, this.scene);
    if (!compiled) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(compiled.program);
    gl.uniform2f(compiled.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(compiled.uTime, this.clock * this.scene.speed);
    gl.uniform3fv(compiled.uColors, compiled.colors);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!this.firstFrameDrawn) {
      this.firstFrameDrawn = true;
      this.events.onFirstFrame?.();
    }
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
      colors: new Float32Array(scene.colors.flatMap(hexToRgb)),
    };
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uNoise'), 0);
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
export function averageColor(pixels: Uint8ClampedArray): string {
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
