/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

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
  | {readonly type: 'code'; readonly id: string; readonly code: string}
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
/** Resolution steps for a tile the GPU can't keep up with, then a pause. */
const SCALES = [1, 0.5, 0.25];
/** Frames a tile may fall behind before it steps down. */
const LATE_LIMIT = 12;

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
  scale: number;
  late: number;
  paused: boolean;
  drawn: boolean;
  fence: WebGLSync | null;
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class CodeRenderer {
  private readonly canvas: OffscreenCanvas;
  private gl: WebGL2RenderingContext | null;
  private readonly parallel: boolean;
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
        this.setCode(command.id, command.code);
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
        tile.scale = SCALES[SCALES.length - 1]!;
        tile.late = 0;
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
      scale: SCALES[0]!,
      late: 0,
      paused: false,
      drawn: false,
      fence: null,
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

  private setCode(id: string, code: string): void {
    const tile = this.tiles.get(id);
    const gl = this.gl;
    if (!tile || !gl || code === tile.code) return;
    tile.code = code;
    tile.paused = false;
    tile.scale = SCALES[0]!;
    tile.late = 0;
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
      this.post({type: 'state', id, state: {state: 'ok'}});
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
    for (const [id, tile] of this.tiles) {
      if (tile.pending) this.settle(id, tile);
      if (tile.pending) animating = true;
      // Reduced motion: one still frame, drawn again only when asked.
      if (this.reduced && tile.drawn) continue;
      if (this.draw(gl, id, tile)) animating = true;
    }
    if (animating && (!this.reduced || this.hasPending())) {
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

  private hasPending(): boolean {
    for (const tile of this.tiles.values()) if (tile.pending) return true;
    return false;
  }

  /** Draws one tile; true while it should keep animating. */
  private draw(gl: WebGL2RenderingContext, id: string, tile: Tile): boolean {
    const program = tile.program;
    if (!program || tile.paused || !tile.context) return false;
    if (tile.width < 1 || tile.height < 1) return false;

    // The GPU hasn't finished this tile's last frame: it is too heavy.
    if (tile.fence) {
      const done =
        gl.getSyncParameter(tile.fence, gl.SYNC_STATUS) === gl.SIGNALED;
      if (!done) {
        if (++tile.late >= LATE_LIMIT) this.stepDown(id, tile);
        return !tile.paused;
      }
      gl.deleteSync(tile.fence);
      tile.fence = null;
      tile.late = Math.max(0, tile.late - 1);
    }

    const width = Math.max(1, Math.round(tile.width * tile.scale));
    const height = Math.max(1, Math.round(tile.height * tile.scale));
    this.fit(width, height);
    const date = new Date();
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program.program);
    gl.uniform2f(program.uResolution, width, height);
    gl.uniform1f(program.uTime, this.clock);
    const [mx, my, inside, down] = tile.mouse;
    gl.uniform4f(
      program.uMouse,
      mx * tile.scale,
      height - my * tile.scale,
      inside,
      down,
    );
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
    gl.flush();

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

  /** Grows the shared canvas to fit the biggest tile, never shrinks it. */
  private fit(width: number, height: number): void {
    const round = (n: number) => Math.ceil(n / 64) * 64;
    if (width > this.canvas.width || height > this.canvas.height) {
      this.canvas.width = Math.max(this.canvas.width, round(width));
      this.canvas.height = Math.max(this.canvas.height, round(height));
    }
  }

  private stepDown(id: string, tile: Tile): void {
    tile.late = 0;
    const next = SCALES.indexOf(tile.scale) + 1;
    if (next < SCALES.length) {
      tile.scale = SCALES[next]!;
      return;
    }
    tile.paused = true;
    this.post({type: 'state', id, state: {state: 'heavy'}});
  }

  // ---- A lost context ---------------------------------------------------

  private onLost(): void {
    // Twice within a minute: something on the page is too much for the
    // GPU, so nothing restarts by itself.
    const now = performance.now();
    const again = now - this.lostAt < 60_000;
    this.lostAt = now;
    for (const [id, tile] of this.tiles) {
      tile.program = null;
      tile.pending = null;
      tile.fence = null;
      tile.drawn = false;
      if (again) {
        tile.paused = true;
        this.post({type: 'state', id, state: {state: 'heavy'}});
      }
    }
  }

  private onRestored(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const [id, tile] of this.tiles) {
      const code = tile.code;
      const paused = tile.paused;
      tile.code = '';
      this.setCode(id, code);
      tile.paused = paused;
    }
  }
}
