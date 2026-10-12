/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Scenes are built from layered gradient noise. Computing it per pixel per
// frame costs four hashes and four sin/cos pairs per sample, which weak GPUs
// feel. noiseFast() instead samples this texture, baked once from the exact
// same function as the shader's noise() (same hash, same gradients), so the
// two agree to within half-float precision inside the baked range.

/** Noise cells across the texture; the pattern repeats every PERIOD cells. */
export const NOISE_PERIOD = 32;
/** Texels per noise cell: dense enough that bilinear filtering is smooth. */
export const NOISE_TEXELS_PER_CELL = 16;
export const NOISE_SIZE = NOISE_PERIOD * NOISE_TEXELS_PER_CELL;
/** The texture covers cells [-ORIGIN, PERIOD - ORIGIN): centred on 0. */
export const NOISE_ORIGIN = NOISE_PERIOD / 2;

/** Exact port of the GLSL prelude's uint hash(uvec2). */
export function hashGlsl(x: number, y: number): number {
  let vx = x >>> 0;
  let vy = y >>> 0;
  vx = (Math.imul(vx, 1664525) + 1013904223) >>> 0;
  vy = (Math.imul(vy, 1664525) + 1013904223) >>> 0;
  vx = (vx + Math.imul(vy, 1664525)) >>> 0;
  vy = (vy + Math.imul(vx, 1664525)) >>> 0;
  vx = (vx ^ (vx >>> 16)) >>> 0;
  vy = (vy ^ (vy >>> 16)) >>> 0;
  vx = (vx + Math.imul(vy, 1664525)) >>> 0;
  vy = (vy + Math.imul(vx, 1664525)) >>> 0;
  vx = (vx ^ (vx >>> 16)) >>> 0;
  vy = (vy ^ (vy >>> 16)) >>> 0;
  return (vx ^ vy) >>> 0;
}

/** The shader's gradient angle for a cell, rounded like float32 GLSL math. */
function gradientAngle(cellX: number, cellY: number): number {
  return Math.fround(
    Math.fround(hashGlsl(cellX, cellY)) *
      Math.fround((Math.PI * 2) / 4294967295),
  );
}

/**
 * Tileable 2D gradient noise in roughly [-0.7, 0.7]. Texel i holds the noise
 * at (i + 0.5) / NOISE_TEXELS_PER_CELL - NOISE_ORIGIN cells, so linear
 * filtering at uv = (p + NOISE_ORIGIN) / NOISE_PERIOD reproduces noise(p).
 */
export function createNoiseData(): Float32Array {
  const gx = new Float32Array(NOISE_PERIOD * NOISE_PERIOD);
  const gy = new Float32Array(NOISE_PERIOD * NOISE_PERIOD);
  for (let y = 0; y < NOISE_PERIOD; y++) {
    for (let x = 0; x < NOISE_PERIOD; x++) {
      const angle = gradientAngle(x - NOISE_ORIGIN, y - NOISE_ORIGIN);
      gx[y * NOISE_PERIOD + x] = Math.cos(angle);
      gy[y * NOISE_PERIOD + x] = Math.sin(angle);
    }
  }
  const dot = (cx: number, cy: number, dx: number, dy: number) => {
    const i = (cy % NOISE_PERIOD) * NOISE_PERIOD + (cx % NOISE_PERIOD);
    return gx[i]! * dx + gy[i]! * dy;
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

  const data = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  for (let ty = 0; ty < NOISE_SIZE; ty++) {
    const py = (ty + 0.5) / NOISE_TEXELS_PER_CELL;
    const cy = Math.floor(py);
    const fy = py - cy;
    const v = fade(fy);
    for (let tx = 0; tx < NOISE_SIZE; tx++) {
      const px = (tx + 0.5) / NOISE_TEXELS_PER_CELL;
      const cx = Math.floor(px);
      const fx = px - cx;
      const u = fade(fx);
      const a = dot(cx, cy, fx, fy);
      const b = dot(cx + 1, cy, fx - 1, fy);
      const c = dot(cx, cy + 1, fx, fy - 1);
      const d = dot(cx + 1, cy + 1, fx - 1, fy - 1);
      const top = a + (b - a) * u;
      const bottom = c + (d - c) * u;
      data[ty * NOISE_SIZE + tx] = top + (bottom - top) * v;
    }
  }
  return data;
}

/** Uploads the noise as a repeating, linearly filtered half-float texture. */
export function createNoiseTexture(
  gl: WebGL2RenderingContext,
): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R16F,
    NOISE_SIZE,
    NOISE_SIZE,
    0,
    gl.RED,
    gl.FLOAT,
    createNoiseData(),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return texture;
}
