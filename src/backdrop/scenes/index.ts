/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {Scene} from './types';

/**
 * Domain-warped noise: slow, deep, like light moving through still water.
 * Uses exact fbm(): the triple warp amplifies the baked texture's tiny
 * differences into a visibly flatter pattern.
 */
const tarn: Scene = {
  id: 'tarn',
  name: 'Tarn',
  colors: ['#04070d', '#0d2740', '#1f6178', '#a9cfe0'],
  base: '#05080f',
  speed: 0.22,
  resolution: 0.5,
  fragment: /* glsl */ `
vec3 scene(vec2 uv, float t) {
  vec2 p = uv * 1.7;
  vec2 q = vec2(fbm(p + vec2(0.0, 0.3 * t)),
                fbm(p + vec2(5.2, 1.3) - 0.25 * t));
  vec2 r = vec2(fbm(p + 2.8 * q + vec2(1.7, 9.2) + 0.4 * t),
                fbm(p + 2.8 * q + vec2(8.3, 2.8) - 0.3 * t));
  float f = fbm(p + 2.6 * r);

  float v = clamp(f * 1.8 + 0.5, 0.0, 1.0);
  vec3 col = mix(uColors[0], uColors[1], smoothstep(0.15, 0.85, v));
  col = mix(col, uColors[2], smoothstep(0.25, 0.75, length(q) * 1.8));
  col = mix(col, uColors[3], smoothstep(0.62, 1.0, v) * smoothstep(-0.1, 0.5, r.y));

  col *= 0.7 + 0.4 * smoothstep(-0.7, 0.5, uv.y);
  col *= 1.0 - 0.45 * dot(uv * vec2(0.55, 1.0), uv * vec2(0.55, 1.0));
  return col;
}
`,
};

/** Folding color waves under animated film grain. */
const ember: Scene = {
  id: 'ember',
  name: 'Ember',
  colors: ['#06050a', '#3a0d5e', '#d4336f', '#ffb46b'],
  base: '#06050a',
  speed: 0.6,
  resolution: 0.75,
  fragment: /* glsl */ `
vec3 scene(vec2 uv, float t) {
  const float A = 0.35;
  vec2 p = mat2(cos(A), -sin(A), sin(A), cos(A)) * uv;
  vec2 flow = p + vec2(0.18 * sin(2.2 * p.y + 1.3 * t),
                       0.12 * cos(1.8 * p.x - t));
  float wave = 0.16 * sin(3.0 * flow.x + 1.2 * flow.y - 1.8 * t)
             + 0.09 * cos(-2.1 * flow.x + 3.4 * flow.y + 1.2 * t)
             + 0.12 * noiseFast(flow * 2.2 + 0.3 * t);
  float shape = smoothstep(-0.5, 0.5, -(flow.y + 0.1 + wave));

  vec3 col = mix(uColors[1], uColors[2], smoothstep(0.1, 0.6, shape));
  col = mix(col, uColors[3], smoothstep(0.55, 1.0, shape));
  col = mix(uColors[0], col, smoothstep(0.0, 0.3, shape));

  float grain = hash01(gl_FragCoord.xy + floor(uTime * 24.0) * 31.0) - 0.5;
  col += grain * mix(0.04, 0.12, shape);
  return col;
}
`,
};

/** Soft pastel mesh gradient, pushed around by low-frequency noise. */
const bloom: Scene = {
  id: 'bloom',
  name: 'Bloom',
  colors: ['#b9a8f5', '#8cc8f2', '#f7b9d6', '#fff1d0'],
  base: '#d9d3f2',
  speed: 0.18,
  resolution: 0.35,
  fragment: /* glsl */ `
vec3 scene(vec2 uv, float t) {
  vec2 p = uv * 1.2;
  float n = fbmFast(p + vec2(0.35 * t, -0.2 * t));
  float m = fbmFast(p * 1.6 - vec2(0.15 * t, 0.3 * t) + 4.0);

  vec3 col = mix(uColors[0], uColors[1], smoothstep(-0.8, 0.8, p.x + 1.6 * n));
  col = mix(col, uColors[2], smoothstep(-0.05, 0.3, m + 0.15 * sin(t + p.y * 2.0)));
  col = mix(col, uColors[3], smoothstep(0.08, 0.35, n));
  return col;
}
`,
};

/** Luminous ribbons drifting over a deep gradient, after the classic console wave. */
const wave: Scene = {
  id: 'wave',
  name: 'Wave',
  colors: ['#050d24', '#173f8f', '#4f8dff', '#d6e7ff'],
  base: '#071230',
  speed: 0.35,
  resolution: 1,
  fragment: /* glsl */ `
vec3 scene(vec2 uv, float t) {
  vec3 col = mix(uColors[0], uColors[1], smoothstep(-0.7, 0.7, uv.y + 0.2 * uv.x));

  float glow = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float y = -0.06
      + 0.12 * sin(uv.x * (1.1 + 0.06 * fi) + t * (0.6 + 0.05 * fi) + fi * 0.45)
      + 0.04 * sin(uv.x * 2.7 - t * 0.8 + fi * 1.3);
    float d = abs(uv.y - y);
    glow += 0.0016 / (d + 0.0028) * (0.3 + 0.7 * fract(fi * 0.618));
  }

  float sheetY = uv.y + 0.06 - 0.1 * sin(uv.x * 1.2 + t * 0.6);
  float sheet = exp(-sheetY * sheetY * 22.0);

  col += uColors[2] * sheet * 0.32;
  col += uColors[3] * glow * 0.45;
  col *= 1.0 - 0.35 * dot(uv * vec2(0.6, 1.0), uv * vec2(0.6, 1.0));
  return col;
}
`,
};

/**
 * Northern lights: curtains of light hang over a night sky, their lower
 * edges bright and sharp, fading upward, swaying slowly.
 */
const aurora: Scene = {
  id: 'aurora',
  name: 'Aurora',
  colors: ['#02050b', '#08141f', '#3ed6a6', '#8d7ce0'],
  base: '#03070d',
  speed: 0.25,
  resolution: 0.5,
  fragment: /* glsl */ `
float curtain(vec2 uv, float t, float seed, float height) {
  float x = uv.x + seed;
  float edge = height
    + 0.2 * fbmFast(vec2(1.1 * x + 0.05 * t, seed - 0.03 * t))
    + 0.06 * sin(3.1 * x - 0.25 * t + seed);
  float d = uv.y - edge;
  float rays = 0.12 + 0.88 * smoothstep(-0.4, 0.5,
    noiseFast(vec2(7.0 * x + 0.35 * t, 0.6 * d + seed - 0.12 * t)));
  float above = 0.6 * exp(-max(d, 0.0) * 12.0) + 0.4 * exp(-max(d, 0.0) * 3.2);
  float below = exp(min(d, 0.0) * 30.0);
  float sweep = smoothstep(-0.3, 0.4, noiseFast(vec2(0.9 * x - 0.06 * t, seed)));
  return above * below * rays * (0.1 + 0.9 * sweep);
}

vec3 scene(vec2 uv, float t) {
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.8, 0.1, uv.y));

  // The band crosses the sky at a slight angle, rising to the right.
  const float TILT = 0.2;
  vec2 r = mat2(cos(TILT), -sin(TILT), sin(TILT), cos(TILT)) * uv;
  float a = curtain(r, t, 0.0, -0.1);
  float b = curtain(r * vec2(0.75, 1.0), t * 0.8, 7.3, 0.06);
  float high = smoothstep(0.0, 0.55, r.y + 0.12);
  vec3 light = mix(uColors[2], uColors[3], high);
  col += light * (a + 0.55 * b) * 1.2;
  col += uColors[2] * 0.03 * smoothstep(0.1, -0.5, uv.y);

  vec2 grid = uv * 180.0;
  float star = step(0.9975, hash01(floor(grid) + 17.0))
    * smoothstep(0.35, 0.0, length(fract(grid) - 0.5))
    * smoothstep(-0.1, 0.45, uv.y);
  col += star * 0.3 * (1.0 - min(a + b, 1.0));

  col *= 1.0 - 0.35 * dot(uv * vec2(0.55, 1.0), uv * vec2(0.55, 1.0));
  return col;
}
`,
};

/**
 * Satin in morning light: slow folds of pale cloth, ice-blue in the
 * shadows and faintly warm where the light catches them.
 */
const silk: Scene = {
  id: 'silk',
  name: 'Silk',
  colors: ['#b9cfdd', '#e4ecf1', '#fbfcfd', '#f2c4ae'],
  base: '#e6edf2',
  speed: 0.2,
  resolution: 0.4,
  fragment: /* glsl */ `
float folds(vec2 p, float t) {
  vec2 w = p + 0.38 * vec2(noiseFast(0.6 * p + vec2(0.0, 0.1 * t)),
                           noiseFast(0.6 * p + vec2(4.3, -0.08 * t)));
  return 0.7 * sin(2.4 * w.x + 1.6 * w.y + 0.3 * t)
       + 0.22 * sin(-1.0 * w.x + 2.2 * w.y - 0.22 * t)
       + 0.08 * sin(4.4 * w.x + 2.6 * w.y + 0.17 * t);
}

vec3 scene(vec2 uv, float t) {
  vec2 p = uv * 2.1;
  const float E = 0.01;
  float h = folds(p, t);
  vec2 slope = vec2(folds(p + vec2(E, 0.0), t) - h,
                    folds(p + vec2(0.0, E), t) - h) / E;
  vec3 n = normalize(vec3(-0.6 * slope, 1.0));
  vec3 sun = normalize(vec3(-0.55, 0.5, 0.55));

  float diffuse = clamp(dot(n, sun), 0.0, 1.0);
  float sheen = pow(clamp(dot(n, normalize(sun + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 24.0);

  vec3 col = mix(uColors[0], uColors[1], smoothstep(0.0, 0.6, diffuse));
  col = mix(col, uColors[2], smoothstep(0.6, 0.95, diffuse));
  col = mix(col, uColors[3], 0.3 * smoothstep(0.4, 0.9, diffuse) * smoothstep(-0.7, 0.7, uv.x - uv.y));
  col += 0.08 * sheen;
  col *= 1.0 - 0.12 * dot(uv * vec2(0.6, 1.0), uv * vec2(0.6, 1.0));
  return col;
}
`,
};

export const SCENES: readonly Scene[] = [
  tarn,
  ember,
  bloom,
  wave,
  aurora,
  silk,
];

export const DEFAULT_SCENE_ID = tarn.id;

/**
 * A still CSS gradient of a scene, built from its own colors: the background
 * when WebGL is unavailable, and under the thumbnail while it loads.
 */
export function sceneStill(scene: Scene): string {
  const [a, b, c, d] = scene.colors;
  return `radial-gradient(120% 90% at 80% 100%, ${d} 0%, transparent 55%),
    radial-gradient(90% 80% at 20% 90%, ${c} 0%, transparent 60%),
    linear-gradient(160deg, ${a} 0%, ${b} 100%)`;
}

/**
 * A scene's settings thumbnail: a real frame of it (`public/scenes/`, made
 * by `scripts/scene-previews.mjs`, ~2-4 KB each) over its still gradient.
 */
export function scenePreview(scene: Scene): string {
  return `url('/scenes/${scene.id}.webp') center / cover no-repeat,
    ${sceneStill(scene)}`;
}

export function sceneById(id: string): Scene {
  return SCENES.find(s => s.id === id) ?? tarn;
}

/**
 * Whether a scene is light or dark, from its base color's luminance: light
 * scenes get dark text and a stronger frost on widgets.
 */
export function sceneTone(scene: Scene): 'light' | 'dark' {
  const n = Number.parseInt(scene.base.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return luminance > 0.35 ? 'light' : 'dark';
}
