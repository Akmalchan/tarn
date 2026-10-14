/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {createNoiseTexture} from '../backdrop/noise-texture';
import {VERTEX_SHADER, fragmentSource} from '../backdrop/scenes/glsl';
import type {Scene} from '../backdrop/scenes/types';

// Settings' wallpaper cards show a still thumbnail; resting the pointer on
// one plays the real scene inside it, with the same shaders as the page.
// One small canvas and one GL context, moved to whichever card is hovered,
// 30 fps, and nothing at all runs when no card is hovered. Reduced motion
// keeps the stills.

interface Program {
  readonly program: WebGLProgram;
  readonly time: WebGLUniformLocation | null;
  readonly resolution: WebGLUniformLocation | null;
  readonly colors: WebGLUniformLocation | null;
}

const FRAME_MS = 1000 / 30;

export class ScenePlayer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private programs = new Map<string, Program | null>();
  private frame = 0;
  private current: {scene: Scene; program: Program; start: number} | null =
    null;
  private last = 0;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /** Plays `scene` over `thumb` until `stop`. */
  play(thumb: HTMLElement, scene: Scene): void {
    if (this.reducedMotion.matches) return;
    const gl = this.context();
    const canvas = this.canvas;
    if (!gl || !canvas) return;
    const program = this.program(gl, scene);
    if (!program) return;
    const box = thumb.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(box.width * scale);
    canvas.height = Math.round(box.height * scale);
    canvas.classList.remove('shown');
    thumb.append(canvas);
    this.current = {scene, program, start: performance.now()};
    this.last = 0;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.draw);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.current = null;
    this.canvas?.classList.remove('shown');
    this.canvas?.remove();
  }

  private draw = (now: number) => {
    const current = this.current;
    const gl = this.gl;
    const canvas = this.canvas;
    if (!current || !gl || !canvas) return;
    this.frame = requestAnimationFrame(this.draw);
    if (now - this.last < FRAME_MS - 2) return;
    this.last = now;
    const {scene, program} = current;
    gl.useProgram(program.program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(program.resolution, canvas.width, canvas.height);
    // Starts a little way in, where the scene's motion is under way.
    const seconds = 40 + (now - current.start) / 1000;
    gl.uniform1f(program.time, seconds * scene.speed);
    gl.uniform3fv(program.colors, colorsOf(scene));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Fade in once the first frame is drawn, never over a blank canvas.
    if (!canvas.classList.contains('shown')) canvas.classList.add('shown');
  };

  private context(): WebGL2RenderingContext | null {
    if (this.gl) return this.gl;
    const canvas = document.createElement('canvas');
    canvas.className = 'live';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return null;
    createNoiseTexture(gl);
    this.canvas = canvas;
    this.gl = gl;
    return gl;
  }

  private program(gl: WebGL2RenderingContext, scene: Scene): Program | null {
    if (this.programs.has(scene.id)) return this.programs.get(scene.id)!;
    let result: Program | null = null;
    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(
        program,
        compile(gl, gl.FRAGMENT_SHADER, fragmentSource(scene.fragment)),
      );
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.useProgram(program);
        gl.uniform1i(gl.getUniformLocation(program, 'uNoise'), 0);
        result = {
          program,
          time: gl.getUniformLocation(program, 'uTime'),
          resolution: gl.getUniformLocation(program, 'uResolution'),
          colors: gl.getUniformLocation(program, 'uColors'),
        };
      }
    } catch {
      // A scene that won't build keeps its still.
    }
    this.programs.set(scene.id, result);
    return result;
  }
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'compile failed');
  }
  return shader;
}

const colorCache = new WeakMap<Scene, Float32Array>();

function colorsOf(scene: Scene): Float32Array {
  let colors = colorCache.get(scene);
  if (!colors) {
    colors = new Float32Array(
      scene.colors.flatMap(hex => {
        const n = Number.parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
      }),
    );
    colorCache.set(scene, colors);
  }
  return colors;
}
