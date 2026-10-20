/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {NOISE_ORIGIN, NOISE_PERIOD} from '../noise-texture';

/** Full-screen triangle generated from gl_VertexID: no buffers needed. */
export const VERTEX_SHADER = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * Shared prelude for every scene. A scene defines
 * `vec3 scene(vec2 uv, float t)`, where `uv` is centered and
 * aspect-corrected (y spans -0.5..0.5) and `t` is scaled time.
 */
const PRELUDE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColors[4];

out vec4 outColor;

uint hash(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v.x ^ v.y;
}

float hash01(vec2 p) {
  return float(hash(uvec2(ivec2(floor(p))))) * (1.0 / 4294967295.0);
}

// Gradient noise, roughly in [-0.7, 0.7]. Two implementations of the same
// function, so each scene picks what it needs:
//
//   noise / fbm          computed per pixel: exact. For heavily warped
//                        scenes, where the warp amplifies tiny differences.
//   noiseFast / fbmFast  one filtered fetch from a texture baked from the
//                        exact same function (noise-texture.ts): several
//                        times cheaper on weak GPUs, near-identical when
//                        used gently. It repeats every NOISE_PERIOD cells.

vec2 gradient(ivec2 cell) {
  float a = float(hash(uvec2(cell))) * (6.28318530718 / 4294967295.0);
  return vec2(cos(a), sin(a));
}

float noise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradient(i), f);
  float b = dot(gradient(i + ivec2(1, 0)), f - vec2(1.0, 0.0));
  float c = dot(gradient(i + ivec2(0, 1)), f - vec2(0.0, 1.0));
  float d = dot(gradient(i + ivec2(1, 1)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

uniform sampler2D uNoise;

float noiseFast(vec2 p) {
  return texture(
    uNoise,
    (p + ${NOISE_ORIGIN.toFixed(1)}) * (1.0 / ${NOISE_PERIOD.toFixed(1)})
  ).r;
}

const mat2 OCTAVE = mat2(1.6, 1.2, -1.2, 1.6);

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    p = OCTAVE * p;
    amp *= 0.5;
  }
  return sum;
}

float fbmFast(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * noiseFast(p);
    p = OCTAVE * p;
    amp *= 0.5;
  }
  return sum;
}

vec3 scene(vec2 uv, float t);

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  vec3 color = scene(uv, uTime);
  // Dither to hide 8-bit banding in smooth gradients: interleaved gradient
  // noise, float math only (an integer hash per pixel was a large share of
  // a big frame's cost on GPUs with slow integer math).
  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  color += (dither - 0.5) / 255.0;
  outColor = vec4(color, 1.0);
}
`;

export function fragmentSource(body: string): string {
  return PRELUDE + body;
}
