/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

// Bundled and run in Chrome by scene-previews.mjs: draws one frame of a
// scene with the real shaders and returns it as a small WebP.

import {createNoiseTexture} from '../src/backdrop/noise-texture';
import {sceneById} from '../src/backdrop/scenes';
import {VERTEX_SHADER, fragmentSource} from '../src/backdrop/scenes/glsl';

/** Renders at 2x and scales down, so thin lines stay smooth. */
const SUPERSAMPLE = 2;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'compile failed');
  }
  return shader;
}

function render(id: string, clock: number, width: number, height: number) {
  const scene = sceneById(id);
  const canvas = document.createElement('canvas');
  canvas.width = width * SUPERSAMPLE;
  canvas.height = height * SUPERSAMPLE;
  const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true})!;
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(
    program,
    compile(gl, gl.FRAGMENT_SHADER, fragmentSource(scene.fragment)),
  );
  gl.linkProgram(program);
  gl.useProgram(program);
  createNoiseTexture(gl);
  gl.uniform1i(gl.getUniformLocation(program, 'uNoise'), 0);
  gl.uniform2f(
    gl.getUniformLocation(program, 'uResolution'),
    canvas.width,
    canvas.height,
  );
  gl.uniform1f(gl.getUniformLocation(program, 'uTime'), clock * scene.speed);
  const colors = scene.colors.flatMap(hex => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
  });
  gl.uniform3fv(gl.getUniformLocation(program, 'uColors'), colors);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, width, height);
  return out;
}

Object.assign(globalThis, {
  previewScene: (
    id: string,
    clock: number,
    width: number,
    height: number,
    quality: number,
  ) => render(id, clock, width, height).toDataURL('image/webp', quality),
});
