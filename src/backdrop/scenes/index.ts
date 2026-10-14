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
const sora: Scene = {
  id: 'sora',
  name: 'Sora',
  colors: ['#1846a3', '#a9d4f2', '#7d97c7', '#ffd9b0'],
  base: '#2a5db0',
  speed: 0.12,
  resolution: 0.5,
  fragment: /* glsl */ `
// Summer anime sky: towering cumulus painted puff by puff, cel-shaded.

// Each tower: base x, top y, width, puff count.
const vec4 TOWERS[4] = vec4[4](
  vec4(-0.72, 0.24, 0.16, 22.0),
  vec4(0.76, 0.1, 0.17, 22.0),
  vec4(-0.4, -0.42, 0.11, 9.0),
  vec4(0.42, -0.46, 0.1, 8.0)
);

// One puff over what is behind it: a scalloped disc, lit like a ball.
vec3 puff(vec3 col, vec2 p, vec2 c, float r, float seed, float t, float depth, float side) {
  vec2 d = p - c;
  float len = length(d);
  if (len > r * 1.25) return col;
  float a = atan(d.y, d.x);
  float lobes = 5.0 + floor(4.0 * seed);
  float scallop = abs(sin(0.5 * lobes * a + 6.28 * seed + 0.05 * t));
  float edge = r * (1.0 + 0.1 * scallop);
  float inside = smoothstep(edge, edge - 0.0025, len);
  if (inside <= 0.0) return col;

  vec2 q = d / edge;
  vec3 n = normalize(vec3(q, sqrt(max(1.0 - dot(q, q), 0.0)) + 0.15));
  vec3 L = normalize(vec3(0.55, 0.7, 0.45));
  float light = dot(n, L);
  // Brushy band edges.
  light += 0.06 * noiseFast(p * 30.0 + seed * 40.0);
  // Low in a tower, its own mass shades it.
  light -= 0.35 * depth;
  // The whole tower is lit as one mass: its sunward side brighter.
  light = mix(light, light + 0.45 * side, 0.7);

  vec3 shadow = uColors[2] * (1.0 - 0.18 * depth);
  vec3 mid = mix(shadow, vec3(1.0), 0.55);
  vec3 cel = mix(shadow, mid, smoothstep(0.2, 0.23, light));
  cel = mix(cel, vec3(1.0), smoothstep(0.58, 0.61, light));
  // Sunlit edge, warm.
  float rim = smoothstep(0.82, 1.0, len / edge) * smoothstep(0.35, 0.8, light);
  cel = mix(cel, uColors[3], 0.55 * rim);
  return mix(col, cel, inside);
}

vec3 scene(vec2 uv, float t) {
  vec3 zenith = uColors[0];
  vec3 horizon = uColors[1];
  vec3 col = mix(horizon, zenith, smoothstep(-0.45, 0.6, uv.y));
  vec2 sun = vec2(0.46, 0.42);
  float glow = exp(-3.0 * length(uv - sun));
  col = mix(col, vec3(1.0, 0.97, 0.9), 0.6 * glow);

  vec2 c = uv * vec2(1.4, 7.0) + vec2(0.015 * t, 0.0);
  float cirrus = smoothstep(0.15, 0.5, fbmFast(c + 9.0)) * smoothstep(0.05, 0.4, uv.y);
  col = mix(col, vec3(1.0), 0.3 * cirrus);

  // Towers, back to front; within a tower, top puffs first.
  for (int k = 0; k < 4; k++) {
    vec4 tw = TOWERS[k];
    if (abs(uv.x - tw.x) > tw.z * 2.8) continue;
    float sway = 0.012 * sin(0.05 * t + float(k) * 2.0);
    for (int j = 21; j >= 0; j--) {
      if (float(j) >= tw.w) continue;
      float a = float(j) / (tw.w - 1.0);
      float r1 = hash01(vec2(float(k) * 17.0 + float(j), 3.0));
      float r2 = hash01(vec2(float(k) * 17.0 + float(j), 9.0));
      float breathe = 1.0 + 0.04 * sin(0.1 * t + 6.28 * r2);
      // Wide at the base, narrowing to a rounded crown.
      float width = tw.z * (1.25 - 0.75 * a * a);
      vec2 center = vec2(
        tw.x + sway * (1.0 + a) + (r1 - 0.5) * 2.0 * width,
        mix(-0.62, tw.y, a) + 0.02 * (r2 - 0.5)
      );
      float r = tw.z * (0.95 - 0.4 * a) * (0.65 + 0.45 * r2) * breathe;
      col = puff(col, uv, center, r, r1, t, smoothstep(0.35, 0.0, a) * 0.8,
        clamp((center.x - tw.x) / width + 0.6 * a - 0.3, -1.0, 1.0));
    }
  }
  // A low bank along the bottom, in front.
  for (int j = 0; j < 10; j++) {
    float r1 = hash01(vec2(float(j), 41.0));
    vec2 center = vec2(-0.98 + 0.22 * float(j) + 0.06 * (r1 - 0.5), -0.6 + 0.04 * r1);
    col = puff(col, uv, center, 0.085 + 0.04 * r1, r1, t, 0.3, 0.0);
  }
  return col;
}
`,
};

const sakura: Scene = {
  id: 'sakura',
  name: 'Sakura',
  colors: ['#dfeaf6', '#fbe3ea', '#f2a7bc', '#fff6f2'],
  base: '#f4e4ea',
  speed: 0.5,
  resolution: 0.5,
  fragment: /* glsl */ `
// Cherry blossoms: a canopy out of focus overhead, petals drifting down
// in three depths, each turning as it falls.

// One petal per cell (some cells empty): coverage and its tip-to-base
// position at p (cell units).
vec2 petal(vec2 p, float t, float layer, float blur, float density) {
  vec2 cell = floor(p);
  float r = hash01(cell + layer * 19.0);
  if (r > density) return vec2(0.0);
  r /= density;
  float r2 = hash01(cell + layer * 19.0 + 4.7);
  float r3 = hash01(cell + layer * 19.0 + 9.1);
  vec2 c = cell + 0.5 + vec2(0.16 * sin(t * (0.6 + r2) + 6.28 * r), 0.1 * (r3 - 0.5));
  vec2 q = p - c;
  float a = t * (0.3 + 0.6 * r3) + 6.28 * r2;
  q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
  // Turning in 3D: the petal narrows as it shows its edge.
  float spin = 0.2 + 0.8 * abs(sin(t * (0.5 + 0.6 * r) + 6.28 * r3));
  q.x /= spin;
  float size = 0.17 + 0.07 * r2;
  float e = length(q / vec2(0.62 * size, size));
  // The notch at the tip of a cherry petal.
  float notch = length(q - vec2(0.0, size * 1.02)) / (0.3 * size);
  float d = max(e - 1.0, -(notch - 1.0) * 0.6);
  float cover = smoothstep(blur, -blur * 0.3, d);
  return vec2(cover, clamp(0.5 + 0.5 * q.y / size, 0.0, 1.0));
}

vec3 scene(vec2 uv, float t) {
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.5, 0.35, uv.y));
  // Sunlight through the blossoms.
  col = mix(col, uColors[3], 0.6 * exp(-2.5 * length(uv - vec2(0.15, 0.62))));

  // The canopy, out of focus: soft branches, then layers of blossom discs.
  float reach = uv.y + 0.28 * uv.x * uv.x;
  float canopy = smoothstep(0.12, 0.42, reach + 0.08 * fbmFast(uv * 3.0 + 0.02 * t));
  vec2 bq = uv * vec2(2.2, 3.0) + 0.03 * vec2(sin(0.2 * t), cos(0.17 * t));
  float branch = smoothstep(0.08, 0.0, abs(fbmFast(bq + 3.0) - 0.05 + 0.4 * (reach - 0.3)));
  col = mix(col, vec3(0.42, 0.3, 0.33), 0.35 * branch * smoothstep(0.15, 0.4, reach));
  for (int i = 0; i < 2; i++) {
    float sc = i == 0 ? 5.0 : 9.0;
    vec2 g = uv * sc + vec2(0.05 * sin(0.15 * t + float(i)), 0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell = floor(g) + vec2(x, y);
        float h = hash01(cell + 2.0 + float(i) * 7.0);
        vec2 c = cell + 0.5 + 0.7 * (vec2(hash01(cell + 5.0), hash01(cell + 8.0)) - 0.5);
        float rad = 0.4 + 0.4 * h;
        float soft = i == 0 ? 0.35 : 0.6;
        float disc = smoothstep(rad, rad * soft, length(g - c));
        vec3 bloom = mix(uColors[2], vec3(1.0, 0.97, 0.98), 0.3 + 0.6 * hash01(cell + 11.0));
        float local = smoothstep(0.1, 0.5, reach + 0.25 * (h - 0.5));
        col = mix(col, bloom, disc * local * (i == 0 ? 0.6 : 0.75));
      }
    }
  }

  // Petals: far (small, sharp), middle, near (big, soft), not too many.
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float k = layer / 2.0;
    float scale = mix(13.0, 3.6, k);
    vec2 p = uv * scale + vec2(0.22 * t * (0.6 + 0.3 * layer), mix(0.18, 0.5, k) * t);
    p.x += 0.35 * sin(0.3 * t + p.y * 0.4);
    vec2 pc = petal(p, t, layer, mix(0.04, 0.32, k), mix(0.16, 0.22, k));
    vec3 base = uColors[2] * 0.95;
    vec3 tip = vec3(1.0, 0.95, 0.96);
    vec3 tint = mix(base, tip, 0.35 + 0.5 * pc.y);
    col = mix(col, tint, pc.x * mix(0.8, 0.95, k));
  }
  return col;
}
`,
};

const comet: Scene = {
  id: 'comet',
  name: 'Comet',
  colors: ['#070b26', '#3a2a6e', '#f09a78', '#bfe6ff'],
  base: '#0b0f2c',
  speed: 0.2,
  resolution: 0.5,
  fragment: /* glsl */ `
// Anime twilight: a comet over a mountain town, stars coming out.

float stars(vec2 uv, float scale, float density, float t) {
  vec2 g = uv * scale;
  vec2 cell = floor(g);
  float r = hash01(cell + 3.1);
  if (r < 1.0 - density) return 0.0;
  vec2 c = vec2(hash01(cell + 7.7), hash01(cell + 1.9)) * 0.6 + 0.2;
  float d = length(fract(g) - c);
  float twinkle = 0.65 + 0.35 * sin(t * (1.5 + 3.0 * r) + 40.0 * r);
  return smoothstep(0.12, 0.0, d) * twinkle * (0.4 + 0.6 * hash01(cell + 5.3));
}

vec3 scene(vec2 uv, float t) {
  float y = uv.y;
  // Indigo overhead, violet, then the warm afterglow at the horizon.
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.2, 0.5, y));
  col = mix(col, uColors[2], smoothstep(-0.05, -0.42, y) * 0.85);
  col += vec3(0.25, 0.12, 0.05) * exp(-12.0 * abs(y + 0.36)) * 0.6;

  // The Milky Way: a faint diagonal river of dust and tiny stars.
  vec2 m = mat2(0.86, 0.5, -0.5, 0.86) * uv;
  float band = exp(-pow((m.y - 0.12 + 0.05 * fbmFast(m * 2.0)) / 0.12, 2.0));
  float dust = smoothstep(-0.2, 0.5, fbmFast(m * vec2(3.0, 8.0) + 2.0));
  float sky = smoothstep(-0.2, 0.25, y);
  col += uColors[3] * band * (0.06 + 0.1 * dust) * sky;
  float s = stars(uv, 300.0, 0.1 + 0.35 * band, t) * (0.45 + 0.55 * band)
          + stars(uv, 150.0, 0.08, t) * 1.1
          + stars(uv + 3.0, 70.0, 0.05, t) * 1.5
          + stars(uv + 7.0, 34.0, 0.04, t) * 2.0;
  col += vec3(0.9, 0.95, 1.0) * s * sky;

  // The comet: a small bright head, its tails streaming up and away from
  // the sun below the horizon, fanning out and fading. It drifts slowly.
  vec2 head = vec2(0.52 + 0.03 * sin(0.004 * t), 0.08 + 0.02 * sin(0.003 * t));
  vec2 dir = normalize(vec2(-0.55, 0.83));
  vec2 rel = uv - head;
  float along = dot(rel, dir);
  float across = dot(rel, vec2(-dir.y, dir.x));
  float tail = smoothstep(-0.01, 0.03, along) * exp(-max(along, 0.0) * 1.7);
  float ionW = 0.003 + 0.022 * max(along, 0.0);
  float ion = exp(-pow(across / ionW, 2.0)) * tail;
  float bend = across - 0.22 * along * along;
  float dustW = 0.006 + 0.11 * max(along, 0.0);
  float dustTail = exp(-pow(bend / dustW, 2.0)) * tail;
  float rays = 0.7 + 0.3 * noiseFast(vec2(across / (0.01 + 0.05 * along) * 3.0, along * 2.0 - 0.15 * t));
  col += mix(uColors[3], vec3(0.6, 0.85, 1.0), 0.5) * ion * 0.55 * rays;
  col += mix(uColors[3], vec3(1.0, 0.86, 0.72), 0.65) * dustTail * 0.38 * rays;
  float coma = exp(-length(rel) * 140.0) + 0.35 * exp(-length(rel) * 30.0);
  col += vec3(1.0, 0.98, 0.95) * coma * 0.9;

  // Now and then a shooting star.
  float period = 23.0;
  float k = floor(t / period);
  float ph = fract(t / period) * period;
  if (ph < 1.2) {
    vec2 a = vec2(hash01(vec2(k, 1.0)) - 0.6, 0.15 + 0.3 * hash01(vec2(k, 2.0)));
    vec2 v = normalize(vec2(-0.8, -0.35));
    vec2 p = a + v * ph * 0.5;
    vec2 r = uv - p;
    float l = dot(r, -v);
    float w = abs(dot(r, vec2(-v.y, v.x)));
    float streak = smoothstep(0.0015, 0.0, w) * smoothstep(0.18, 0.0, l) * step(0.0, l);
    col += vec3(1.0) * streak * sin(3.14 * ph / 1.2) * 0.9;
  }

  // Thin clouds, dark violet with undersides lit by the afterglow.
  vec2 cq = uv * vec2(1.3, 11.0) + vec2(0.012 * t, 0.0);
  float shape = fbmFast(cq + 5.0) + 0.3 * fbmFast(cq * 2.7);
  float cl = smoothstep(0.02, 0.3, shape) * exp(-pow((y + 0.17) / 0.13, 2.0));
  // Lit from below: the lower edge of each streak glows.
  float above = fbmFast(cq + 5.0 + vec2(0.0, 0.35)) + 0.3 * fbmFast((cq + vec2(0.0, 0.35)) * 2.7);
  float underside = clamp((shape - above) * 4.0, 0.0, 1.0);
  vec3 cloudCol = mix(mix(uColors[1], uColors[0], 0.4), uColors[2] * 1.15, underside);
  col = mix(col, cloudCol, cl * 0.9);

  // Mountains with a scatter of warm town lights.
  float ridge = -0.38 + 0.06 * fbmFast(vec2(uv.x * 2.2, 1.0)) + 0.02 * fbmFast(vec2(uv.x * 9.0, 4.0));
  float near = -0.44 + 0.04 * fbmFast(vec2(uv.x * 3.5 + 8.0, 2.0));
  vec3 far = mix(uColors[1] * 0.45, uColors[0], 0.5);
  col = mix(col, far, smoothstep(0.002, -0.002, y - ridge));
  vec3 land = uColors[0] * 0.5;
  col = mix(col, land, smoothstep(0.002, -0.002, y - near));
  vec2 lg = uv * 170.0;
  float cluster = smoothstep(0.0, 0.3, fbmFast(vec2(uv.x * 4.0, 3.0)));
  vec2 jitter = vec2(hash01(floor(lg) + 2.3), hash01(floor(lg) + 8.9)) * 0.6 + 0.2;
  float town = step(0.86 - 0.12 * cluster, hash01(floor(lg) + 11.0))
    * smoothstep(0.22, 0.0, length(fract(lg) - jitter))
    * smoothstep(near - 0.004, near - 0.012, y);
  float flicker = 0.75 + 0.25 * sin(t * 1.3 + hash01(floor(lg)) * 30.0);
  col += vec3(1.0, 0.72, 0.38) * town * flicker * 1.2;
  return col;
}
`,
};

const koi: Scene = {
  id: 'koi',
  name: 'Koi',
  colors: ['#0a2a2c', '#1d4a45', '#f0662e', '#4f7d3a'],
  base: '#0f302f',
  speed: 0.5,
  resolution: 0.5,
  fragment: /* glsl */ `
// A koi pond from above: fish gliding in slow loops, their shadows on the
// floor below, lily pads floating over them, light shimmering.

// Where fish i is at time t, on a slow looping path.
vec2 koiPath(float i, float t) {
  float s = 0.045 + 0.025 * hash01(vec2(i, 2.0));
  float ph = 6.28 * hash01(vec2(i, 3.0)) + i * 1.3;
  float dirn = hash01(vec2(i, 4.0)) < 0.5 ? 1.0 : -1.0;
  vec2 home = (vec2(hash01(vec2(i, 6.0)), hash01(vec2(i, 8.0))) - 0.5) * vec2(0.5, 0.3);
  return home + vec2(0.55 * sin(dirn * t * s + ph), 0.3 * sin(t * s * 1.6 + ph * 1.3));
}

// A fish's body and fins at p: coverage, its position along the body
// (0 head .. 1 tail), and sideways offset.
vec3 koiShape(vec2 p, float i, float t, float len) {
  vec2 c = koiPath(i, t);
  vec2 ahead = koiPath(i, t + 0.4);
  vec2 dir = normalize(ahead - c + 1e-5);
  vec2 rel = p - c;
  // From the head (0) back along the body, in world units.
  float back = len * 0.4 - dot(rel, dir);
  float side = dot(rel, vec2(-dir.y, dir.x));
  float s = back / len;
  // The body sways in a wave that grows toward the tail.
  side -= 0.07 * len * sin(t * 3.0 - s * 5.0 + i) * s * s;
  float ss = clamp(s, 0.0, 1.0);
  // Rounded head, widest a third of the way back, narrowing to the tail.
  float width = 0.2 * len * pow(sin(3.14159 * ss), 0.6) * (1.0 - 0.75 * smoothstep(0.35, 1.0, ss));
  float body = smoothstep(width, width - 0.0025, abs(side)) * step(0.0, s) * step(s, 1.0);
  // Tail: a fan that opens behind the body, a little translucent.
  float ts = s - 0.92;
  float spread = 0.012 * len + 0.75 * max(ts, 0.0) * len;
  float tail = step(0.0, ts) * smoothstep(0.42, 0.3, ts) * smoothstep(spread, spread - 0.003, abs(side))
    * (0.7 + 0.3 * smoothstep(0.0, 0.3, ts));
  // Pectoral fins: swept-back ovals beside the chest, gently paddling.
  float flap = 0.75 + 0.25 * sin(t * 2.0 + i * 3.0);
  vec2 f = vec2(back - 0.3 * len, abs(side) - 0.17 * len);
  f = mat2(0.8, 0.6, -0.6, 0.8) * f;
  float fins = smoothstep(1.0, 0.85, length(f / vec2(0.1 * len, 0.045 * len * flap)));
  return vec3(max(body, max(tail * 0.65, fins * 0.55 * (1.0 - body))), ss, side / (0.2 * len));
}

vec3 scene(vec2 uv, float t) {
  // Deep water, lighter toward the middle; light shimmers on the floor.
  vec3 col = mix(uColors[1], uColors[0], smoothstep(0.1, 0.9, length(uv * vec2(0.8, 1.1))));
  vec2 q = uv * 5.0;
  float caustic = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 w = q * (1.0 + float(k) * 0.6) + vec2(0.1 * t, -0.07 * t) * (k == 0 ? 1.0 : -1.0);
    float n = noiseFast(w + 0.6 * vec2(noiseFast(w * 0.7 + 0.05 * t), noiseFast(w * 0.7 - 0.04 * t)));
    caustic += pow(1.0 - abs(n) * 2.2, 6.0);
  }
  col += vec3(0.5, 0.75, 0.65) * 0.08 * caustic;

  // Shadows of the fish on the floor, then the fish.
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float len = 0.17 + 0.06 * hash01(vec2(fi, 5.0));
    vec3 sh = koiShape(uv - vec2(0.018, -0.024), fi, t, len);
    col *= 1.0 - 0.35 * sh.x;
  }
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float len = 0.17 + 0.06 * hash01(vec2(fi, 5.0));
    vec3 f = koiShape(uv, fi, t, len);
    if (f.x <= 0.0) continue;
    // Each koi its own pattern: red-orange patches on white, or gold, or
    // black and white.
    float kind = hash01(vec2(fi, 7.0));
    vec2 local = vec2(f.y * 4.0, f.z) + fi * 3.0;
    float spots = smoothstep(-0.05, 0.1, noise(local * 1.6));
    vec3 white = vec3(0.96, 0.94, 0.9);
    vec3 fish = kind < 0.55 ? mix(white, uColors[2], spots)
      : kind < 0.8 ? mix(vec3(1.0, 0.75, 0.3), uColors[2], 0.3 * spots)
      : mix(white, vec3(0.08, 0.08, 0.1), spots);
    // Rounded: lighter along the spine, darker at the sides.
    fish *= 0.75 + 0.25 * (1.0 - f.z * f.z);
    col = mix(col, fish * 0.95, f.x * 0.92);
  }

  // Lily pads on the surface, drifting a little.
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(hash01(vec2(fi, 11.0)) - 0.5, hash01(vec2(fi, 12.0)) - 0.5) * vec2(1.7, 1.0);
    c += 0.015 * vec2(sin(0.1 * t + fi), cos(0.08 * t + fi));
    // Keep the middle clear.
    c *= 1.0 + 0.6 * smoothstep(0.4, 0.0, length(c));
    float r = 0.06 + 0.05 * hash01(vec2(fi, 13.0));
    vec2 d = uv - c;
    float ang = atan(d.y, d.x) + 6.28 * hash01(vec2(fi, 14.0)) + 0.02 * t;
    float notch = smoothstep(0.12, 0.2, abs(mod(ang, 6.28318) - 3.14159) - 2.95 + 3.14159 * 0.0);
    float wedge = step(0.18, abs(mod(ang + 3.14159, 6.28318) - 3.14159));
    float pad = smoothstep(r, r - 0.003, length(d)) * wedge;
    float shadow = smoothstep(r, r - 0.02, length(d - vec2(0.012, -0.016)));
    col *= 1.0 - 0.3 * shadow * (1.0 - pad);
    vec3 leaf = uColors[3] * (0.85 + 0.25 * dot(normalize(d + 1e-5), vec2(0.5, 0.7)) * length(d) / r);
    leaf += 0.05 * sin(atan(d.y, d.x) * 14.0) * smoothstep(0.2 * r, r, length(d));
    col = mix(col, leaf, pad);
  }
  return col;
}
`,
};

const windowScene: Scene = {
  id: 'window',
  name: 'Window',
  colors: ['#04070d', '#10233a', '#ffb35c', '#ff5c8a'],
  base: '#070c14',
  speed: 0.6,
  resolution: 0.5,
  fragment: /* glsl */ `
// Rain on a window at night: a city out of focus behind the glass, each
// drop a little lens showing it sharp and upside down.

// The city behind the glass. focus 0: soft bokeh; 1: small sharp lights.
vec3 city(vec2 uv, float focus, float t) {
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.5, 0.5, uv.y));
  col += uColors[2] * 0.12 * exp(-6.0 * abs(uv.y + 0.35));
  for (int i = 0; i < 2; i++) {
    float sc = i == 0 ? 5.0 : 9.0;
    vec2 g = uv * sc + vec2(float(i) * 3.7, 0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell = floor(g) + vec2(x, y);
        float h = hash01(cell + float(i) * 13.0);
        // The city is below: more lights low down, few up in the sky.
        float density = mix(0.12, 0.6, smoothstep(0.45, -0.35, cell.y / sc));
        if (h > density) continue;
        vec2 c = cell + 0.5 + 0.8 * (vec2(hash01(cell + 3.3), hash01(cell + 6.1)) - 0.5);
        float rad = mix(0.48, 0.1, focus) * (0.6 + 0.6 * hash01(cell + 9.9));
        float d = length(g - c);
        float edge = mix(0.12, 0.02, focus);
        float disc = smoothstep(rad, rad - edge, d) * (0.85 + 0.15 * smoothstep(rad, 0.0, d));
        float pick = hash01(cell + 4.4);
        vec3 light = pick < 0.5 ? uColors[2] : pick < 0.75 ? uColors[3] : vec3(0.75, 0.9, 1.0);
        float flicker = 0.8 + 0.2 * sin(t * (0.5 + h * 2.0) + h * 40.0);
        float energy = mix(0.45, 1.4, focus) * (0.4 + 0.9 * hash01(cell + 7.7));
        col += light * disc * energy * flicker * (i == 0 ? 0.6 : 0.45);
      }
    }
  }
  return col;
}

// Small drops that bead up, linger and dry: offset and coverage.
vec3 beads(vec2 uv, float t, float scale) {
  vec2 g = uv * scale;
  vec2 cell = floor(g);
  float h = hash01(cell + 1.7);
  if (hash01(cell + 12.5) > 0.45) return vec3(0.0);
  vec2 c = cell + 0.5 + 0.6 * (vec2(hash01(cell + 2.9), hash01(cell + 7.3)) - 0.5);
  float life = fract(t * 0.05 + h);
  float r = 0.32 * (0.4 + 0.6 * hash01(cell + 5.5)) * smoothstep(0.0, 0.05, life) * smoothstep(1.0, 0.6, life);
  vec2 q = (g - c) / max(r, 1e-3);
  float inside = smoothstep(1.0, 0.8, length(q)) * step(0.02, r);
  return vec3(q * inside, inside);
}

vec3 scene(vec2 uv, float t) {
  vec2 offset = vec2(0.0);
  float wet = 0.0;

  // Running drops: one per column, sliding in fits and starts.
  float cols = 7.0;
  vec2 g = uv * vec2(cols, 1.0);
  float column = floor(g.x);
  float h = hash01(vec2(column, 3.0));
  float speed = 0.08 + 0.06 * h;
  float phase = t * speed + h * 10.0;
  // Stick and slip: mostly still, then a quick slide.
  float slide = floor(phase) + smoothstep(0.55, 1.0, fract(phase));
  float y = 0.65 - fract(slide * 0.23 + h) * 1.4;
  float x = column + 0.5 + 0.25 * sin(3.0 * (uv.y - y) + h * 6.0) * 0.4 + (h - 0.5) * 0.4;
  vec2 d = vec2((g.x - x) / cols, uv.y - y);
  float size = 0.024 + 0.014 * h;
  // A drop is round below and drawn out above.
  vec2 dq = d / vec2(size, size * (d.y > 0.0 ? 1.6 : 1.0));
  float drop = smoothstep(1.0, 0.75, length(dq));
  offset += dq * drop * 0.09;
  wet = max(wet, drop);
  // Its trail: a wiped strip with tiny drops left behind.
  float above = uv.y - y;
  float trail = step(0.0, above) * smoothstep(0.5, 0.0, above) * smoothstep(size * 0.9, 0.0, abs(d.x));
  vec2 tg = vec2(d.x / size * 1.2, fract(above * 28.0) - 0.5);
  float bit = smoothstep(0.35, 0.2, length(tg)) * trail * step(0.03, above);
  offset += tg * bit * 0.02;
  wet = max(wet, bit);

  // Beads everywhere except where a drop just wiped the glass.
  vec3 b1 = beads(uv, t, 34.0) * (1.0 - trail);
  vec3 b2 = beads(uv + 0.37, t * 1.3, 61.0) * (1.0 - trail);
  offset += b1.xy * 0.06 + b2.xy * 0.035;
  wet = max(wet, max(b1.z, b2.z));

  // Through a drop the city is sharper, shrunk and flipped (a lens);
  // elsewhere it's a blur.
  vec2 look = uv - offset;
  vec3 col = city(look, 0.25 * wet, t);
  // The wiped trails are a touch clearer.
  col *= 1.0 + 0.12 * trail * (1.0 - wet);
  // Drops gather light: a soft highlight up top, a darker rim below.
  vec2 n = offset / 0.09;
  col += vec3(0.75, 0.82, 0.9) * 0.18 * wet * smoothstep(0.3, 0.9, n.y);
  col *= 1.0 - 0.35 * wet * smoothstep(0.55, 1.0, length(n));
  // Small drops catch the room's light too.
  col += uColors[1] * 0.25 * max(b1.z, b2.z);
  return col;
}
`,
};

const fireflies: Scene = {
  id: 'fireflies',
  name: 'Fireflies',
  colors: ['#02060a', '#0d2a33', '#3f7f86', '#e8f58a'],
  base: '#06141a',
  speed: 0.35,
  resolution: 0.5,
  fragment: /* glsl */ `
// A lake at night: moonlight on still water, pines on the far shore, reeds
// in front, and fireflies drifting over it all, mirrored in the lake.

// Height of a row of pines at x: narrow, jagged triangles.
float pines(float x, float y, float scale, float seed, float base, float tall) {
  float g = x * scale;
  float inside = 0.0;
  for (int i = -1; i <= 1; i++) {
    float cell = floor(g) + float(i);
    float h = hash01(vec2(cell, seed));
    if (hash01(vec2(cell, seed + 2.0)) > 0.85) continue;
    float c = cell + 0.5 + 0.6 * (hash01(vec2(cell, seed + 4.0)) - 0.5);
    float height = tall * (0.3 + 0.7 * h);
    float s = (y - base) / height;
    if (s < 0.0 || s > 1.0) continue;
    // Tiers of branches: the outline steps in and out on the way up.
    float tier = fract(s * (5.0 + 3.0 * h));
    float w = (0.42 + 0.25 * h) * (1.0 - s) * (0.75 + 0.35 * tier) + 0.03;
    inside = max(inside, smoothstep(w, w - 0.06, abs(g - c)));
  }
  return inside;
}

vec3 fireflies(vec2 uv, float t, float scale, float seed, float size) {
  vec2 g = uv * scale;
  vec3 glow = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = floor(g) + vec2(x, y);
      float density = mix(0.05, 0.45, smoothstep(0.15, -0.35, cell.y / scale));
      float h = hash01(cell + seed);
      if (h > density) continue;
      float h2 = hash01(cell + seed + 3.7);
      float h3 = hash01(cell + seed + 8.1);
      vec2 c = cell + 0.5 + 0.38 * vec2(sin(t * (0.3 + 0.3 * h2) + 6.28 * h3), sin(t * (0.23 + 0.2 * h3) + 6.28 * h2));
      float d = length(g - c);
      float blink = pow(0.5 + 0.5 * sin(t * (0.6 + 0.8 * h2) + 6.28 * h), 3.0);
      glow += uColors[3] * (smoothstep(size, 0.0, d) + 0.5 * exp(-d * d / (size * size * 20.0))) * blink;
    }
  }
  return glow;
}

// Everything above the water line.
vec3 world(vec2 uv, float t, float shore) {
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.1, 0.55, uv.y));
  vec2 moon = vec2(-0.28, 0.3);
  float md = length(uv - moon);
  col += uColors[2] * 0.5 * exp(-4.0 * md);
  col = mix(col, vec3(0.9, 0.97, 1.0), smoothstep(0.05, 0.044, md) * 0.92);
  // Thin clouds catching the moonlight.
  float cl = smoothstep(0.1, 0.5, fbmFast(uv * vec2(1.5, 8.0) + vec2(0.01 * t, 2.0))) * smoothstep(0.05, 0.25, uv.y);
  col = mix(col, uColors[2] * 0.8, cl * 0.35 * (0.4 + exp(-3.0 * md)));
  vec2 sg = uv * 120.0;
  col += 0.45 * step(0.996, hash01(floor(sg))) * smoothstep(0.3, 0.0, length(fract(sg) - 0.5)) * smoothstep(0.0, 0.4, uv.y) * (1.0 - cl);
  // Two rows of pines on the far shore, the nearer darker.
  float back = max(pines(uv.x, uv.y, 40.0, 1.0, shore, 0.11), smoothstep(shore + 0.012, shore + 0.008, uv.y));
  col = mix(col, mix(uColors[1], uColors[2], 0.25), back);
  // Mist along the shore, between the rows.
  float mist = exp(-pow((uv.y - shore - 0.02) / 0.04, 2.0)) * (0.5 + 0.5 * fbmFast(vec2(uv.x * 3.0 + 0.02 * t, 4.0)));
  col += uColors[2] * 0.25 * mist;
  float front = pines(uv.x, uv.y, 22.0, 5.0, shore - 0.005, 0.17);
  col = mix(col, mix(uColors[0], uColors[1], 0.3), front);
  return col;
}

vec3 scene(vec2 uv, float t) {
  float shore = -0.12;
  vec3 col;
  if (uv.y > shore) {
    col = world(uv, t, shore);
    col += fireflies(uv, t, 12.0, 2.0, 0.03) * 0.6;
  } else {
    // The lake mirrors the shore, broken by slow ripples.
    float depth = shore - uv.y;
    vec2 ripple = vec2(0.006 * noiseFast(vec2(uv.x * 4.0, depth * 60.0 - 0.3 * t)), 0.0);
    vec2 m = vec2(uv.x, shore + depth * 1.0) + ripple * (0.5 + 4.0 * depth);
    col = world(m, t, shore) * 0.6 + uColors[0] * 0.1;
    // The moon's path, glittering.
    float path = exp(-pow((uv.x + 0.28) / (0.03 + 0.25 * depth), 2.0));
    float glint = smoothstep(0.35, 0.7, noiseFast(vec2(uv.x * 30.0, depth * 140.0 - 0.6 * t)));
    col += vec3(0.8, 0.92, 1.0) * path * glint * 0.9;
    col += uColors[2] * path * 0.08;
    col += fireflies(m, t, 12.0, 2.0, 0.03) * 0.3;
    col += fireflies(m, t, 6.0, 9.0, 0.035) * 0.4;
  }

  // Reeds in front, tall at the sides, swaying.
  float reeds = 0.0;
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 70.0 : 40.0;
    float g = uv.x * sc;
    for (int i = -1; i <= 1; i++) {
      float cell = floor(g) + float(i);
      float h = hash01(vec2(cell, 21.0 + float(k)));
      float side = smoothstep(0.25, 0.85, abs((cell + 0.5) / sc));
      float height = (0.05 + 0.28 * h * h) * (0.35 + 0.9 * side) * (k == 0 ? 0.8 : 1.0);
      float base = -0.52;
      float s = clamp((uv.y - base) / height, 0.0, 1.0);
      float bend = (h - 0.5) * 1.6 + 0.25 * sin(0.4 * t + h * 6.0);
      float cx = cell + 0.5 + bend * s * s * sc * height * 0.4;
      float w = 0.22 * (1.0 - s);
      reeds = max(reeds, step(uv.y, base + height) * smoothstep(w, w * 0.4, abs(g - cx)));
    }
  }
  col = mix(col, uColors[0] * 0.5, reeds);

  col += fireflies(uv, t, 6.0, 9.0, 0.035) * 0.9;
  col += fireflies(uv + 1.3, t * 0.8, 3.0, 17.0, 0.03);
  return col;
}
`,
};

const lumen: Scene = {
  id: 'lumen',
  name: 'Lumen',
  colors: ['#030509', '#0c1622', '#ffd9a1', '#7fb8c9'],
  base: '#05080d',
  speed: 0.25,
  resolution: 0.5,
  fragment: /* glsl */ `
// Light through haze: shafts falling from high on the left into a dark
// room, slowly shifting, with dust drifting through them.

vec3 scene(vec2 uv, float t) {
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.6, 0.5, uv.y + 0.3 * uv.x));

  vec2 src = vec2(-0.38, 0.78);
  vec2 rel = uv - src;
  float dist = length(rel);
  float ang = atan(rel.x, -rel.y);
  // Shafts: a few broad bands of angle, drifting and breathing.
  float shafts = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float center = -0.05 + 0.24 * fi + 0.04 * sin(0.07 * t + fi * 1.7);
    float width = 0.035 + 0.02 * sin(0.05 * t + fi * 2.3) + 0.015 * fi;
    shafts += exp(-pow((ang - center) / width, 2.0)) * (0.7 + 0.3 * sin(0.09 * t + fi));
  }
  // Fine streaks within, like light through leaves.
  float streak = 0.6 + 0.4 * noiseFast(vec2(ang * 40.0, 0.03 * t));
  // Haze: the light shows where the air is thick.
  vec2 hq = uv * 2.2 + vec2(0.02 * t, -0.015 * t);
  float haze = smoothstep(-0.45, 0.5, fbmFast(hq + 0.4 * fbmFast(hq * 1.7 - 0.01 * t))) * 0.8 + 0.2;
  float fall = exp(-dist * 0.75);
  float light = shafts * streak * haze * fall;
  vec3 beam = mix(uColors[3], uColors[2], smoothstep(0.2, 1.0, shafts));
  col += beam * light * 1.5;
  // A soft bloom near the opening.
  col += uColors[2] * 0.5 * exp(-dist * 3.5) + vec3(1.0, 0.95, 0.85) * 0.5 * exp(-dist * 14.0);

  // Dust: specks that glint only inside the light.
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 45.0 : 22.0;
    vec2 g = uv * sc + vec2(0.06 * t * (k == 0 ? 1.0 : -0.7), 0.04 * t);
    vec2 cell = floor(g);
    float h = hash01(cell + float(k) * 9.0);
    if (h < 0.35) {
      vec2 c = cell + 0.5 + 0.35 * vec2(sin(t * 0.3 + h * 20.0), cos(t * 0.27 + h * 13.0));
      float d = length(g - c);
      float size = k == 0 ? 0.08 : 0.12;
      float speck = smoothstep(size, 0.0, d) * (0.5 + 0.5 * sin(t * 0.8 + h * 30.0));
      col += uColors[2] * speck * light * (k == 0 ? 1.6 : 2.2);
    }
  }
  // A faint floor catching the light far below.
  col += uColors[2] * 0.06 * smoothstep(-0.2, -0.5, uv.y) * shafts * haze;
  return col;
}
`,
};

const contour: Scene = {
  id: 'contour',
  name: 'Contour',
  colors: ['#f4f1ea', '#dfe7ec', '#3d5468', '#e9b99c'],
  base: '#f1eee7',
  speed: 0.12,
  resolution: 0.75,
  fragment: /* glsl */ `
// A topographic map whose land slowly reshapes: contour lines flow, merge
// and part; every fifth line is drawn bolder, as on a real map.

float terrain(vec2 p, float t) {
  vec2 a = p * 1.1 + vec2(0.05 * t, -0.03 * t);
  vec2 b = p * 1.4 + vec2(-0.04 * t, 0.025 * t) + 7.0;
  // Smooth land: three octaves, the finest gentle, and a slow warp.
  // Exact noise: thin lines show every kink of the faster texture.
  a += 0.4 * vec2(noise(b), noise(b + 3.0));
  return 0.7 * noise(a) + 0.32 * noise(a * 2.1 + 1.7) + 0.1 * noise(a * 4.3 + 5.1);
}

vec3 scene(vec2 uv, float t) {
  float h = terrain(uv, t);
  // Paper, tinted cool in the valleys and warm on the heights.
  vec3 col = uColors[0];
  col = mix(col, uColors[1], 0.55 * smoothstep(0.0, -0.4, h));
  col = mix(col, uColors[3], 0.35 * smoothstep(0.05, 0.45, h));

  float f = h * 15.0;
  float w = fwidth(f);
  float line = 1.0 - smoothstep(0.0, w * 1.2, abs(fract(f + 0.5) - 0.5) - w * 0.25);
  // Index lines: every fifth, bolder.
  float g = f / 5.0;
  float gw = fwidth(g);
  float index = 1.0 - smoothstep(0.0, gw * 1.2, abs(fract(g + 0.5) - 0.5) - gw * 0.9);
  float ink = max(line * 0.32, index * 0.7);
  col = mix(col, uColors[2], ink);
  // A little paper grain.
  col *= 0.985 + 0.03 * noiseFast(uv * 180.0);
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
  sora,
  sakura,
  comet,
  koi,
  windowScene,
  fireflies,
  lumen,
  contour,
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
