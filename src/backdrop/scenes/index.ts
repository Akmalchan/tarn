/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  isPhotoId,
  photoMirror,
  type PhotoMirrorEntry,
} from '../../wallpapers/store';
import type {Hex, Scene} from './types';

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
  colors: ['#9ab4c8', '#dce6ee', '#fcfdfe', '#efb497'],
  base: '#e2eaf0',
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
  vec3 n = normalize(vec3(-0.8 * slope, 1.0));
  vec3 sun = normalize(vec3(-0.55, 0.5, 0.55));

  float diffuse = clamp(dot(n, sun), 0.0, 1.0);
  float sheen = pow(clamp(dot(n, normalize(sun + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 24.0);

  vec3 col = mix(uColors[0], uColors[1], smoothstep(0.05, 0.72, diffuse));
  col = mix(col, uColors[2], smoothstep(0.6, 0.95, diffuse));
  col = mix(col, uColors[3], 0.42 * smoothstep(0.35, 0.9, diffuse) * smoothstep(-0.7, 0.7, uv.x - uv.y));
  col += 0.12 * sheen;
  col *= 1.0 - 0.12 * dot(uv * vec2(0.6, 1.0), uv * vec2(0.6, 1.0));
  return col;
}
`,
};

/**
 * Mist: layered hills at dawn, each fainter with distance, with fog
 * drifting slowly between them.
 */
const mist: Scene = {
  id: 'mist',
  name: 'Mist',
  colors: ['#eef2f6', '#c4d2e0', '#7f95ad', '#f5cdb9'],
  base: '#e3e9ef',
  speed: 0.12,
  resolution: 0.4,
  fragment: /* glsl */ `
float ridge(float x, float seed, float t) {
  return 0.09 * fbmFast(vec2(x * 1.3 + seed, seed * 3.1))
       + 0.035 * sin(x * 2.1 + seed * 5.0 + 0.04 * t);
}

vec3 scene(vec2 uv, float t) {
  // Dawn: warm low on the right, cool and pale above.
  float glow = smoothstep(0.75, -0.1, length((uv - vec2(0.45, 0.2)) * vec2(0.75, 1.4)));
  vec3 col = mix(uColors[0], uColors[3], 0.75 * glow);
  // Five ridges, nearer ones lower and darker; fog drifts through them.
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float near = fi / 4.0;
    float top = 0.2 - 0.135 * fi + ridge(uv.x + 0.015 * t * (0.3 + near), fi * 1.7, t);
    float hill = smoothstep(0.003, -0.003, uv.y - top);
    vec3 tone = mix(uColors[1], uColors[2], 0.25 + near * 0.75);
    tone = mix(tone, uColors[3], 0.25 * glow * (1.0 - near));
    col = mix(col, tone, hill);
    float fog = smoothstep(-0.2, 0.6, fbmFast(vec2(uv.x * 1.6 - 0.05 * t * (0.6 + near), uv.y * 4.0 + fi * 2.3)));
    float band = smoothstep(0.14, 0.0, top - uv.y) * hill;
    col = mix(col, uColors[0], 0.55 * fog * band * (1.0 - near * 0.5));
  }
  return col;
}
`,
};

/**
 * Dunes: soft sand ridges in late afternoon light, their shadows
 * shifting slowly as the wind moves them.
 */
const dunes: Scene = {
  id: 'dunes',
  name: 'Dunes',
  colors: ['#c98f6a', '#e8c4a2', '#f7e6d3', '#9b6b57'],
  base: '#ecd3bb',
  speed: 0.1,
  resolution: 0.4,
  fragment: /* glsl */ `
float sand(vec2 p, float t) {
  vec2 w = p + 0.45 * vec2(fbmFast(0.35 * p + vec2(0.02 * t, 0.0)),
                           fbmFast(0.35 * p + vec2(3.1, -0.015 * t)));
  // Dunes: rounded ridges, steeper on the far side (no hard edges).
  float wave = 0.5 + 0.5 * sin(3.4 * w.y + 1.9 * sin(0.8 * w.x));
  float dune = pow(wave, 1.8);
  // Wind ripples, small and many.
  float ripple = 0.04 * sin(7.0 * (w.y + 0.35 * w.x) + 2.0 * noiseFast(2.0 * w));
  return dune + ripple;
}

vec3 scene(vec2 uv, float t) {
  vec2 p = uv * vec2(2.6, 3.8);
  const float E = 0.01;
  float h = sand(p, t);
  vec2 slope = vec2(sand(p + vec2(E, 0.0), t) - h, sand(p + vec2(0.0, E), t) - h) / E;
  vec3 n = normalize(vec3(-0.25 * slope, 1.0));
  vec3 sun = normalize(vec3(0.75, 0.35, 0.45));
  float light = clamp(dot(n, sun), 0.0, 1.0);

  vec3 col = mix(uColors[3], uColors[0], smoothstep(0.15, 0.5, light));
  col = mix(col, uColors[1], smoothstep(0.45, 0.8, light));
  col = mix(col, uColors[2], smoothstep(0.82, 1.0, light));
  col = mix(col, uColors[2], 0.3 * smoothstep(0.0, 0.6, uv.y));
  return col;
}
`,
};

/**
 * Rain: drops landing on a still lake at night, rings spreading and
 * fading across dark water.
 */
const rain: Scene = {
  id: 'rain',
  name: 'Rain',
  colors: ['#03080d', '#0b2230', '#2b5a6b', '#8fc0cc'],
  base: '#050b11',
  speed: 0.5,
  resolution: 0.5,
  fragment: /* glsl */ `
vec3 scene(vec2 uv, float t) {
  // Dark water, a faint sky reflection toward the far shore (the top).
  vec3 col = mix(uColors[0], uColors[1], smoothstep(-0.5, 0.5, uv.y));
  col += 0.06 * uColors[2] * fbmFast(uv * vec2(1.0, 4.0) + vec2(0.02 * t, 0.0));

  // Seen at a low angle, rings are flattened ovals, smaller with distance.
  float depth = 1.0 + 1.6 * smoothstep(-0.5, 0.5, uv.y);
  vec2 g = vec2(uv.x, uv.y * 3.2) * 3.5 * depth;
  vec2 cell = floor(g);
  float rings = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 c = cell + vec2(dx, dy);
      float r1 = hash01(c * 1.7);
      float r2 = hash01(c * 3.1 + 7.0);
      float r3 = hash01(c * 5.3 + 2.0);
      vec2 drop = c + vec2(r1, r2);
      float period = 2.5 + 3.5 * r3;
      float age = fract(t / period + r2);
      // Not every spot gets a drop each time.
      float live = step(0.45, hash01(c + floor(t / period + r2) * 17.0));
      float d = length(g - drop);
      for (int k = 0; k < 2; k++) {
        float radius = age * (0.85 - 0.3 * float(k));
        float band = exp(-pow((d - radius) * 22.0, 2.0));
        rings += live * band * pow(1.0 - age, 2.0) * (1.0 - 0.45 * float(k));
      }
    }
  }
  col += uColors[3] * rings * 0.42 / depth;
  col *= 1.0 - 0.35 * dot(uv * vec2(0.55, 1.0), uv * vec2(0.55, 1.0));
  return col;
}
`,
};

/**
 * Nebula: slow clouds of dust and light drifting in deep space, blue and
 * violet, with faint stars behind.
 */
const nebula: Scene = {
  id: 'nebula',
  name: 'Nebula',
  colors: ['#05050f', '#211b52', '#4652b0', '#d4b8f2'],
  base: '#06060f',
  speed: 0.15,
  resolution: 0.5,
  fragment: /* glsl */ `
vec3 scene(vec2 uv, float t) {
  vec2 p = uv * 1.4;
  vec2 q = vec2(fbmFast(p + vec2(0.0, 0.05 * t)), fbmFast(p + vec2(4.7, 1.3) - 0.04 * t));
  float cloud = fbmFast(p + 1.6 * q + vec2(0.03 * t, -0.02 * t));
  float glow = smoothstep(-0.35, 0.35, cloud);

  vec3 col = mix(uColors[0], uColors[1], glow);
  col = mix(col, uColors[2], smoothstep(0.0, 0.4, cloud) * 0.85);
  col += uColors[3] * smoothstep(0.2, 0.6, cloud) * smoothstep(-0.3, 0.3, q.x) * 0.55;
  // A soft core of light where the clouds are thickest.
  col += 0.12 * uColors[3] * smoothstep(0.3, 0.7, cloud + 0.2 * q.y);

  vec2 grid = uv * 140.0;
  float star = step(0.995, hash01(floor(grid) + 3.0))
    * smoothstep(0.35, 0.0, length(fract(grid) - 0.5));
  col += star * (0.55 - 0.4 * glow);

  col *= 1.0 - 0.3 * dot(uv * vec2(0.55, 1.0), uv * vec2(0.55, 1.0));
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
  mist,
  dunes,
  rain,
  nebula,
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

/**
 * A photo, covering the screen like CSS `background-size: cover`. Photo
 * rows run top-down, so y is flipped.
 */
const PHOTO_FRAGMENT = /* glsl */ `
uniform sampler2D uPhoto;
uniform vec2 uPhotoSize;

vec3 scene(vec2 uv, float t) {
  vec2 p = gl_FragCoord.xy / uResolution;
  float screen = uResolution.x / uResolution.y;
  float image = uPhotoSize.x / uPhotoSize.y;
  vec2 fit = screen > image ? vec2(1.0, image / screen) : vec2(screen / image, 1.0);
  vec2 q = (p - 0.5) * fit + 0.5;
  return texture(uPhoto, vec2(q.x, 1.0 - q.y)).rgb;
}
`;

/**
 * The scene for one of the user's photos. Still (speed 0), drawn at the
 * screen's full pixel density so it stays sharp.
 */
export function photoScene(id: string, entry: PhotoMirrorEntry): Scene {
  const base = entry.base as Hex;
  return {
    id,
    name: 'Photo',
    fragment: PHOTO_FRAGMENT,
    colors: [base, base, base, base],
    base,
    speed: 0,
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
    photo: {width: entry.w, height: entry.h},
    tone: entry.tone,
  };
}

/**
 * The scene for a `scene` setting. A photo this computer doesn't have
 * (synced from another, or deleted) shows the default scene instead.
 */
export function sceneById(id: string): Scene {
  if (isPhotoId(id)) {
    const entry = photoMirror()[id];
    return entry ? photoScene(id, entry) : tarn;
  }
  return SCENES.find(s => s.id === id) ?? tarn;
}

/**
 * Whether a scene is light or dark, from its base color's luminance: light
 * scenes get dark text and a stronger frost on widgets.
 */
export function sceneTone(scene: Scene): 'light' | 'dark' {
  if (scene.tone) return scene.tone;
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
