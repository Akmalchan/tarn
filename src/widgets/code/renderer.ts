/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {TileBudget} from './budget';
import {fragmentFor, hasEntry, parseErrors, type CodeError} from './source';

/**
 * Draws every custom widget on a page with one WebGL2 context: each tile is
 * drawn in turn into a shared canvas and copied into the tile's own 2D
 * canvas. One context however many tiles (browsers cap live contexts at
 * about 16), and in production it all runs in a worker (stage.ts).
 */

/** How a tile is doing, for the words over it. */
export type TileState =
  | {readonly state: 'ok'}
  /** `running`: an earlier version still draws while this one is broken. */
  | {
      readonly state: 'error';
      readonly errors: readonly CodeError[];
      readonly running: boolean;
    }
  | {readonly state: 'missing'}
  | {readonly state: 'heavy'}
  | {readonly state: 'unavailable'};

export type StagePace = 'active' | 'calm';

export type StageCommand =
  | {
      readonly type: 'add';
      readonly id: string;
      readonly canvas: OffscreenCanvas | HTMLCanvasElement;
    }
  | {readonly type: 'remove'; readonly id: string}
  /** `paused`: this code was too heavy here before (heavy.ts); wait for Run. */
  | {
      readonly type: 'code';
      readonly id: string;
      readonly code: string;
      readonly paused?: boolean;
    }
  /** The tile's size in device pixels (CSS pixels times up to 2). */
  | {
      readonly type: 'size';
      readonly id: string;
      readonly width: number;
      readonly height: number;
    }
  /** In the tile's device pixels from its top left; `inside`, `down` 0/1. */
  | {
      readonly type: 'mouse';
      readonly id: string;
      readonly x: number;
      readonly y: number;
      readonly inside: number;
      readonly down: number;
    }
  /** Runs a tile again after it was paused for being too heavy. */
  | {readonly type: 'run'; readonly id: string}
  | {
      readonly type: 'look';
      readonly colors: readonly number[];
      readonly ink: readonly number[];
    }
  | {readonly type: 'pace'; readonly pace: StagePace}
  | {readonly type: 'visible'; readonly visible: boolean}
  | {readonly type: 'reduced'; readonly reduced: boolean};

export type StageEvent =
  | {readonly type: 'state'; readonly id: string; readonly state: TileState}
  /** The tile's first frame is on screen. */
  | {readonly type: 'drawn'; readonly id: string};

/** Frames per second at each pace, and how fast time runs (like scenes). */
const FPS: Record<StagePace, number> = {active: 30, calm: 20};
const RATE: Record<StagePace, number> = {active: 1, calm: 0.4};
/** A fence this old when the context is lost: its tile hung the GPU. */
const STUCK_MS = 150;

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** A version of a tile's code, compiling or compiled. */
interface Build {
  readonly program: WebGLProgram;
  readonly fragment: WebGLShader;
  readonly code: string;
}

/** A version that compiled, with its inputs looked up once. */
interface Program extends Build {
  readonly uResolution: WebGLUniformLocation | null;
  readonly uTime: WebGLUniformLocation | null;
  readonly uMouse: WebGLUniformLocation | null;
  readonly uDate: WebGLUniformLocation | null;
  readonly uInk: WebGLUniformLocation | null;
  readonly uColors: WebGLUniformLocation | null;
}

interface Tile {
  readonly target: OffscreenCanvas | HTMLCanvasElement;
  readonly context:
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  code: string;
  /** What draws now: the last version that compiled. */
  program: Program | null;
  /** A newer version still compiling. */
  pending: Build | null;
  width: number;
  height: number;
  mouse: [number, number, number, number];
  budget: TileBudget;
  paused: boolean;
  drawn: boolean;
  fence: WebGLSync | null;
  /** Its fence's place in the GPU's queue, its time, and frames waited. */
  fenceAt: number;
  fencedAt: number;
  waited: number;
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class CodeRenderer {
  private readonly canvas: OffscreenCanvas;
  private gl: WebGL2RenderingContext | null;
  private parallel: boolean;
  private readonly tiles = new Map<string, Tile>();
  private colors = new Float32Array(12).fill(0.6);
  private ink = new Float32Array([0.96, 0.97, 0.98]);
  private pace: StagePace = 'active';
  private visible = true;
  private reduced = false;
  private clock = 0;
  private last = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lostAt = -Infinity;
  private fences = 0;

  constructor(private readonly post: (event: StageEvent) => void) {
    this.canvas = new OffscreenCanvas(256, 256);
    this.gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      // The frame is copied into each tile's canvas after drawing.
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    this.parallel = !!this.gl?.getExtension('KHR_parallel_shader_compile');
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.onLost();
    });
    this.canvas.addEventListener('webglcontextrestored', () =>
      this.onRestored(),
    );
  }

  apply(command: StageCommand): void {
    switch (command.type) {
      case 'add':
        this.add(command.id, command.canvas);
        break;
      case 'remove':
        this.remove(command.id);
        break;
      case 'code':
        this.setCode(command.id, command.code, command.paused);
        break;
      case 'size': {
        const tile = this.tiles.get(command.id);
        if (!tile) break;
        tile.width = Math.max(0, Math.round(command.width));
        tile.height = Math.max(0, Math.round(command.height));
        tile.target.width = tile.width;
        tile.target.height = tile.height;
        tile.drawn = false;
        this.wake();
        break;
      }
      case 'mouse': {
        const tile = this.tiles.get(command.id);
        if (tile) {
          tile.mouse = [command.x, command.y, command.inside, command.down];
        }
        break;
      }
      case 'run': {
        const tile = this.tiles.get(command.id);
        if (!tile?.paused) break;
        tile.paused = false;
        tile.budget = new TileBudget();
        this.post({type: 'state', id: command.id, state: {state: 'ok'}});
        this.wake();
        break;
      }
      case 'look':
        this.colors = new Float32Array(command.colors.slice(0, 12));
        this.ink = new Float32Array(command.ink.slice(0, 3));
        this.redrawStill();
        break;
      case 'pace':
        this.pace = command.pace;
        break;
      case 'visible':
        this.visible = command.visible;
        this.wake();
        break;
      case 'reduced':
        this.reduced = command.reduced;
        this.wake();
        break;
    }
  }

  private add(id: string, target: OffscreenCanvas | HTMLCanvasElement): void {
    const context = target.getContext('2d') as Context2D | null;
    this.tiles.set(id, {
      target,
      context,
      code: '',
      program: null,
      pending: null,
      width: 0,
      height: 0,
      mouse: [-1, -1, 0, 0],
      budget: new TileBudget(),
      paused: false,
      drawn: false,
      fence: null,
      fenceAt: 0,
      fencedAt: 0,
      waited: 0,
    });
    if (!this.gl || !context) {
      this.post({type: 'state', id, state: {state: 'unavailable'}});
    }
  }

  private remove(id: string): void {
    const tile = this.tiles.get(id);
    if (!tile) return;
    this.release(tile.program);
    this.release(tile.pending);
    if (tile.fence) this.gl?.deleteSync(tile.fence);
    this.tiles.delete(id);
  }

  private setCode(id: string, code: string, paused = false): void {
    const tile = this.tiles.get(id);
    const gl = this.gl;
    if (!tile || !gl || code === tile.code) return;
    tile.code = code;
    tile.paused = paused;
    tile.budget = new TileBudget();
    if (!hasEntry(code)) {
      this.release(tile.pending);
      tile.pending = null;
      this.post({type: 'state', id, state: {state: 'missing'}});
      return;
    }
    this.release(tile.pending);
    tile.pending = this.build(gl, code);
    if (!this.parallel) this.settle(id, tile);
    this.wake();
  }

  private build(gl: WebGL2RenderingContext, code: string): Build | null {
    const vertex = gl.createShader(gl.VERTEX_SHADER);
    const fragment = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.shaderSource(vertex, VERTEX);
    gl.compileShader(vertex);
    gl.shaderSource(fragment, fragmentFor(code));
    gl.compileShader(fragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    // The program keeps it; it goes with the program.
    gl.deleteShader(vertex);
    return {program, fragment, code};
  }

  /**
   * A compiling version, once done: draws from now on, or reports its
   * errors while the last working version keeps drawing.
   */
  private settle(id: string, tile: Tile): void {
    const gl = this.gl;
    const pending = tile.pending;
    if (!gl || !pending) return;
    if (
      this.parallel &&
      !gl.getProgramParameter(
        pending.program,
        0x91b1 /* COMPLETION_STATUS_KHR */,
      )
    ) {
      return;
    }
    tile.pending = null;
    if (gl.getProgramParameter(pending.program, gl.LINK_STATUS)) {
      const at = (name: string) => gl.getUniformLocation(pending.program, name);
      const ready: Program = {
        ...pending,
        uResolution: at('uResolution'),
        uTime: at('uTime'),
        uMouse: at('uMouse'),
        uDate: at('uDate'),
        uInk: at('uInk'),
        uColors: at('uColors'),
      };
      this.release(tile.program);
      tile.program = ready;
      tile.drawn = false;
      this.post({
        type: 'state',
        id,
        state: tile.paused ? {state: 'heavy'} : {state: 'ok'},
      });
    } else {
      const log =
        gl.getShaderInfoLog(pending.fragment) ||
        gl.getProgramInfoLog(pending.program) ||
        '';
      this.release(pending);
      const errors = parseErrors(log, pending.code);
      this.post({
        type: 'state',
        id,
        state: {
          state: 'error',
          errors: errors.length ? errors : [{line: null, message: log}],
          running: !!tile.program,
        },
      });
    }
  }

  private release(program: Build | null): void {
    if (!program || !this.gl) return;
    this.gl.deleteShader(program.fragment);
    this.gl.deleteProgram(program.program);
  }

  // ---- The loop ---------------------------------------------------------

  /** Draws now, and keeps drawing while anything animates. */
  private wake(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => this.frame(), 0);
  }

  private redrawStill(): void {
    for (const tile of this.tiles.values()) tile.drawn = false;
    this.wake();
  }

  private frame(): void {
    this.timer = null;
    const gl = this.gl;
    if (!gl || gl.isContextLost() || !this.visible) {
      this.last = 0;
      return;
    }
    const now = performance.now();
    const dt = this.last ? Math.min(now - this.last, 100) / 1000 : 0;
    this.last = now;
    if (!this.reduced) this.clock += dt * RATE[this.pace];

    let animating = false;
    // Compiling, or not yet at its step: reduced motion keeps going too.
    let settling = false;
    for (const [id, tile] of this.tiles) {
      if (tile.pending) this.settle(id, tile);
      if (tile.pending) animating = settling = true;
      // Reduced motion: one still frame, drawn again only when asked.
      if (this.reduced && tile.drawn) continue;
      if (this.draw(gl, id, tile)) {
        animating = true;
        if (!tile.drawn) settling = true;
      }
    }
    if (animating && (!this.reduced || settling)) {
      const interval = 1000 / FPS[this.pace];
      const spent = performance.now() - now;
      this.timer = setTimeout(
        () => this.frame(),
        Math.max(0, interval - spent),
      );
    } else {
      this.last = 0;
    }
  }

  /** Draws one tile; true while it should keep animating. */
  private draw(gl: WebGL2RenderingContext, id: string, tile: Tile): boolean {
    const program = tile.program;
    if (!program || tile.paused || !tile.context) return false;
    if (tile.width < 1 || tile.height < 1) return false;

    // The GPU hasn't finished this tile's last frame: it is too heavy,
    // unless it waits behind another tile's (one context runs in order).
    if (tile.fence) {
      if (!this.signaled(gl, tile.fence)) {
        tile.waited++;
        if (!this.queued(gl, tile) && tile.budget.behind()) {
          this.pause(id, tile);
        }
        return !tile.paused;
      }
      gl.deleteSync(tile.fence);
      tile.fence = null;
      tile.budget.done(tile.waited === 0);
    }

    const scale = tile.budget.scale;
    const width = Math.max(1, Math.round(tile.width * scale));
    const height = Math.max(1, Math.round(tile.height * scale));
    this.fit(width, height);
    const date = new Date();
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program.program);
    gl.uniform2f(program.uResolution, width, height);
    gl.uniform1f(program.uTime, this.clock);
    const [mx, my, inside, down] = tile.mouse;
    gl.uniform4f(program.uMouse, mx * scale, height - my * scale, inside, down);
    gl.uniform4f(
      program.uDate,
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours() * 3600 +
        date.getMinutes() * 60 +
        date.getSeconds() +
        date.getMilliseconds() / 1000,
    );
    gl.uniform3fv(program.uInk, this.ink);
    gl.uniform3fv(program.uColors, this.colors);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    tile.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    tile.fenceAt = ++this.fences;
    tile.fencedAt = performance.now();
    tile.waited = 0;
    gl.flush();

    // Still finding its step: the tile keeps its last picture meanwhile.
    if (!tile.budget.settled) return true;
    const context = tile.context;
    context.clearRect(0, 0, tile.width, tile.height);
    context.drawImage(
      this.canvas,
      0,
      this.canvas.height - height,
      width,
      height,
      0,
      0,
      tile.width,
      tile.height,
    );
    if (!tile.drawn) {
      tile.drawn = true;
      this.post({type: 'drawn', id});
    }
    return true;
  }

  private signaled(gl: WebGL2RenderingContext, fence: WebGLSync): boolean {
    return gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED;
  }

  /** Another tile's older frame isn't done either: this one waits behind it. */
  private queued(gl: WebGL2RenderingContext, tile: Tile): boolean {
    for (const other of this.tiles.values()) {
      if (
        other.fence &&
        other.fenceAt < tile.fenceAt &&
        !this.signaled(gl, other.fence)
      ) {
        return true;
      }
    }
    return false;
  }

  /** Grows the shared canvas to fit the biggest tile, never shrinks it. */
  private fit(width: number, height: number): void {
    const round = (n: number) => Math.ceil(n / 64) * 64;
    if (width > this.canvas.width || height > this.canvas.height) {
      this.canvas.width = Math.max(this.canvas.width, round(width));
      this.canvas.height = Math.max(this.canvas.height, round(height));
    }
  }

  /** Too heavy even at the smallest step; the page remembers it (heavy.ts). */
  private pause(id: string, tile: Tile): void {
    tile.paused = true;
    this.post({type: 'state', id, state: {state: 'heavy'}});
  }

  // ---- A lost context ---------------------------------------------------

  private onLost(): void {
    // The tile whose frame the GPU was stuck on: the oldest fence, if it
    // is older than a few frames (a reset from elsewhere finds them
    // fresh). It doesn't restart.
    const now = performance.now();
    let stuck: [string, Tile] | null = null;
    for (const entry of this.tiles) {
      const tile = entry[1];
      if (tile.paused || !tile.fence || now - tile.fencedAt < STUCK_MS) {
        continue;
      }
      if (!stuck || tile.fenceAt < stuck[1].fenceAt) stuck = entry;
    }
    if (stuck) this.pause(...stuck);
    // Twice within a minute: something on the page is too much for the
    // GPU, so nothing restarts by itself.
    const again = now - this.lostAt < 60_000;
    this.lostAt = now;
    for (const [id, tile] of this.tiles) {
      tile.program = null;
      tile.pending = null;
      tile.fence = null;
      tile.drawn = false;
      if (again && !tile.paused) this.pause(id, tile);
    }
  }

  private onRestored(): void {
    const gl = this.gl;
    if (!gl) return;
    // Extensions are asked for again on a restored context.
    this.parallel = !!gl.getExtension('KHR_parallel_shader_compile');
    // Every tile from its smallest step again; paused ones stay paused.
    for (const [id, tile] of this.tiles) {
      if (!hasEntry(tile.code)) continue;
      tile.budget.restart();
      tile.pending = this.build(gl, tile.code);
      if (!this.parallel) this.settle(id, tile);
    }
    this.wake();
  }
}
