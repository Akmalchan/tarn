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
const sakura: Scene = {
  id: 'sakura',
  name: 'Sakura',
  colors: ['#dfeaf6', '#fbe3ea', '#f2a7bc', '#fff6f2'],
  base: '#f4e4ea',
  speed: 0.5,
  resolution: 1,
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


// One cherry blossom at q (relative to its center), radius r: coverage
// and color. Five petals with notched tips, a deep pink heart, stamens.
vec4 blossom(vec2 q, float r, float turn) {
  float a = atan(q.y, q.x) + turn;
  float lobe = cos(5.0 * a);
  float edge = r * (0.74 + 0.26 * lobe) - r * 0.12 * smoothstep(0.93, 1.0, lobe);
  float d = length(q);
  float aa = 1.2 / uResolution.y;
  float cover = smoothstep(edge + aa, edge - aa, d);
  vec3 petalCol = mix(uColors[2], vec3(1.0, 0.96, 0.97), smoothstep(0.15, 0.85, d / r));
  // Faint veins and a soft crease between petals.
  petalCol *= 0.975 + 0.025 * cos(a * 25.0) * smoothstep(0.2, 0.6, d / r);
  petalCol *= 0.9 + 0.1 * smoothstep(-0.6, 0.2, lobe);
  vec3 col = mix(petalCol, uColors[2] * 0.75, smoothstep(0.35, 0.1, d / r));
  float stamens = smoothstep(0.06, 0.0, abs(d / r - 0.32)) * step(0.6, cos(a * 11.0));
  col = mix(col, vec3(0.98, 0.82, 0.45), stamens);
  return vec4(col, cover);
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


  // Soft rays of sun through the canopy.
  vec2 sr = uv - vec2(-0.6, 0.7);
  float ray = pow(max(sin(atan(sr.x, -sr.y) * 7.0 + 0.05 * t), 0.0), 3.0);
  col += uColors[3] * 0.04 * ray * exp(-length(sr) * 1.5);

  // A branch in focus reaching in from the top right, swaying a little,
  // with blossoms and buds along it.
  float sway = 0.012 * sin(0.35 * t) + 0.006 * sin(0.9 * t + 1.0);
  vec2 bp = uv - vec2(0.9, 0.6);
  bp = mat2(cos(sway), -sin(sway), sin(sway), cos(sway)) * bp + vec2(0.9, 0.6);
  float bs = clamp((0.9 - bp.x) / 0.56, 0.0, 1.0);
  float by = 0.54 - 0.22 * bs + 0.05 * sin(3.2 * bs + 0.5) - 0.06 * bs * bs;
  float thick = 0.016 * (1.0 - 0.7 * bs);
  float px = 1.2 / uResolution.y;
  float wood = smoothstep(thick + px, thick - px, abs(bp.y - by)) * step(bp.x, 0.95) * step(0.34, bp.x);
  // A twig off it, angling down.
  float ts = clamp((0.68 - bp.x) / 0.2, 0.0, 1.0);
  float ty = (0.54 - 0.22 * 0.39 + 0.05 * sin(3.2 * 0.39 + 0.5) - 0.06 * 0.39 * 0.39) - 0.1 * ts;
  wood = max(wood, smoothstep(0.005 + px, 0.005 - px, abs(bp.y - ty)) * step(0.48, bp.x) * step(bp.x, 0.68));
  vec3 bark = mix(vec3(0.24, 0.17, 0.17), vec3(0.42, 0.32, 0.3), smoothstep(-thick, thick, bp.y - by));
  col = mix(col, bark, wood);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float s0 = 0.05 + 0.08 * fi + 0.03 * (hash01(vec2(fi, 70.0)) - 0.5);
    float side = hash01(vec2(fi, 71.0)) < 0.5 ? -1.0 : 1.0;
    vec2 at = vec2(0.9 - 0.56 * s0, 0.54 - 0.22 * s0 + 0.05 * sin(3.2 * s0 + 0.5) - 0.06 * s0 * s0);
    at += vec2(0.015 * (hash01(vec2(fi, 72.0)) - 0.5), side * (0.018 + 0.02 * hash01(vec2(fi, 73.0))));
    float r = (0.04 + 0.024 * hash01(vec2(fi, 74.0))) * (1.0 - 0.25 * s0);
    vec2 q = bp - at;
    if (hash01(vec2(fi, 75.0)) < 0.25) {
      // A bud: a small, deep pink oval.
      float bud = smoothstep(1.0, 0.85, length(q / vec2(r * 0.35, r * 0.5)));
      col = mix(col, uColors[2] * 0.85, bud);
      continue;
    }
    vec4 f = blossom(q, r, 6.28 * hash01(vec2(fi, 76.0)));
    col = mix(col, f.rgb, f.a);
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
  resolution: 1,
  fragment: /* glsl */ `
// Anime twilight: a comet over a mountain town, stars coming out.

float stars(vec2 uv, float scale, float density, float t) {
  vec2 g = uv * scale;
  vec2 cell = floor(g);
  float r = hash01(cell + 3.1);
  if (r < 1.0 - density) return 0.0;
  vec2 c = vec2(hash01(cell + 7.7), hash01(cell + 1.9)) * 0.6 + 0.2;
  float d = length(fract(g) - c);
  float twinkle = 0.5 + 0.5 * sin(t * (2.0 + 4.0 * r) + 40.0 * r);
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
  float period = 9.0;
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

  // A plane crossing, high up, its light blinking.
  float flight = fract(t / 70.0);
  vec2 plane = vec2(-1.0 + 2.2 * flight, 0.38 - 0.08 * flight);
  float blink = step(0.85, fract(t * 1.2));
  col += vec3(1.0, 0.45, 0.4) * blink * smoothstep(0.004, 0.0, length(uv - plane));
  col += vec3(1.0) * 0.6 * smoothstep(0.0025, 0.0, length(uv - plane - vec2(0.006, 0.0)));

  // Thin clouds, dark violet with undersides lit by the afterglow.
  vec2 cq = uv * vec2(1.3, 11.0) + vec2(0.035 * t, 0.0);
  float shape = fbmFast(cq + 5.0) + 0.3 * fbmFast(cq * 2.7);
  float cl = smoothstep(0.02, 0.3, shape) * exp(-pow((y + 0.17) / 0.13, 2.0));
  // Lit from below: the lower edge of each streak glows.
  float above = fbmFast(cq + 5.0 + vec2(0.0, 0.35)) + 0.3 * fbmFast((cq + vec2(0.0, 0.35)) * 2.7);
  float underside = clamp((shape - above) * 4.0, 0.0, 1.0);
  vec3 cloudCol = mix(mix(uColors[1], uColors[0], 0.4), uColors[2] * 1.15, underside);
  col = mix(col, cloudCol, cl * 0.9);

  // Mountains: a far range, faded and rim-lit by the afterglow, then a
  // nearer, darker one.
  float px = 1.5 / uResolution.y;
  float ridge = -0.33 + 0.07 * fbmFast(vec2(uv.x * 2.2, 1.0)) + 0.018 * fbmFast(vec2(uv.x * 11.0, 4.0));
  vec3 far = mix(uColors[1] * 0.55, uColors[0], 0.35);
  float farMask = smoothstep(px, -px, y - ridge);
  col = mix(col, far, farMask);
  col += uColors[2] * 0.4 * farMask * smoothstep(0.006, 0.0, ridge - y);
  float near = -0.4 + 0.045 * fbmFast(vec2(uv.x * 3.5 + 8.0, 2.0));
  col = mix(col, mix(uColors[0], uColors[1], 0.35), smoothstep(px, -px, y - near));

  // A small town on the hillside: houses with pitched roofs, their windows
  // lighting up and going dark through the evening.
  float hs = 38.0;
  float hx = uv.x * hs;
  float hc = floor(hx);
  float hf = fract(hx);
  float hh = hash01(vec2(hc, 50.0));
  float ground = -0.455 + 0.012 * fbmFast(vec2(uv.x * 4.0, 9.0));
  float kind = hash01(vec2(hc, 51.0));
  float w0 = 0.04 + 0.12 * hash01(vec2(hc, 52.0));
  float w1 = 0.96 - 0.12 * hash01(vec2(hc, 53.0));
  float tall = kind < 0.12 ? 0.045 : 0.0;
  float wall = ground + (0.012 + 0.02 * hh) + tall;
  float roof = wall + 0.014 * (1.0 - abs((hf - w0) / (w1 - w0) - 0.5) * 2.0) * step(0.3, hh) * step(0.12, kind);
  float house = step(w0, hf) * step(hf, w1) * step(kind, 0.78);
  // Trees in the gaps: round crowns.
  float tree = step(0.78, kind) * smoothstep(0.42, 0.38, length(vec2(hf - 0.5, (y - ground - 0.011 * (0.9 + 0.6 * hh)) * hs * 0.9)));
  float top = mix(ground, roof, house);
  vec3 dark = uColors[0] * 0.45;
  col = mix(col, dark, max(smoothstep(px, -px, y - top), tree));
  // Windows: a few small warm squares per house.
  vec2 wq = vec2(hf * 4.0, (y - ground) / 0.008);
  vec2 wc = floor(wq);
  float on = step(0.6, hash01(vec2(hc * 7.0 + wc.x, wc.y + floor(t * 0.04 + hash01(vec2(hc, wc.x)) * 7.0))));
  float pane = step(abs(fract(wq.x) - 0.5), 0.22) * step(abs(fract(wq.y) - 0.5), 0.25)
    * step(0.6, wq.y) * step(y, wall - 0.003) * house * step(0.25, hf) * step(hf, 0.75);
  col += vec3(1.0, 0.74, 0.4) * pane * on * 0.95;
  col += vec3(1.0, 0.6, 0.3) * 0.05 * smoothstep(0.06, 0.0, abs(y - ground - 0.015)) * (0.5 + 0.5 * fbmFast(vec2(uv.x * 6.0, 2.0)));

  // Power lines on poles, sagging between them across the sky.
  float span = 0.42;
  float u = fract((uv.x + 0.9) / span);
  float poleTop = -0.3;
  float pole = smoothstep(0.0025, 0.0015, abs(u - 0.0) * span) * step(ground, y) * step(y, poleTop + 0.01);
  pole = max(pole, smoothstep(0.0025, 0.0015, abs(u - 1.0) * span) * step(ground, y) * step(y, poleTop + 0.01));
  float lines = 0.0;
  for (int i = 0; i < 3; i++) {
    float lift = float(i) * 0.012;
    float sag = poleTop - lift - 0.035 * 4.0 * u * (1.0 - u);
    lines = max(lines, smoothstep(px * 1.2, 0.0, abs(y - sag)));
  }
  col = mix(col, dark * 0.8, max(pole, lines * 0.85));
  return col;
}
`,
};

const koi: Scene = {
  id: 'koi',
  name: 'Koi',
  colors: ['#0b2b2b', '#1e4a44', '#e8542a', '#4f8a3c'],
  base: '#0f302f',
  speed: 0.5,
  resolution: 1,
  fragment: /* glsl */ `
// A koi pond from above: stones on the floor, koi gliding at different
// depths with their shadows below, ripples now and then, lily pads and a
// lotus on the surface, and sunlight shimmering through the water.

vec2 koiPath(float i, float t) {
  float s = 0.045 + 0.025 * hash01(vec2(i, 2.0));
  float ph = 6.28 * hash01(vec2(i, 3.0)) + i * 1.3;
  float dirn = hash01(vec2(i, 4.0)) < 0.5 ? 1.0 : -1.0;
  vec2 home = (vec2(hash01(vec2(i, 6.0)), hash01(vec2(i, 8.0))) - 0.5) * vec2(0.5, 0.3);
  return home + vec2(0.55 * sin(dirn * t * s + ph), 0.3 * sin(t * s * 1.6 + ph * 1.3));
}

// A koi at p. x: body, y: fins (translucent), z: 0 head .. 1 tail,
// w: across the body (-1 .. 1).
vec4 koi(vec2 p, float i, float t, float len) {
  vec2 c = koiPath(i, t);
  vec2 dir = normalize(koiPath(i, t + 0.4) - c + 1e-5);
  vec2 rel = p - c;
  float back = len * 0.4 - dot(rel, dir);
  float side = dot(rel, vec2(-dir.y, dir.x));
  float s = back / len;
  if (s < -0.1 || s > 1.5 || abs(side) > len * 0.5) return vec4(0.0);
  // The body sways in a wave that grows toward the tail.
  side -= 0.07 * len * sin(t * 3.0 - s * 5.0 + i) * s * s;
  float ss = clamp(s, 0.0, 1.0);
  float width = 0.2 * len * pow(sin(3.14159 * ss), 0.6) * (1.0 - 0.75 * smoothstep(0.35, 1.0, ss));
  // One and a half pixels of soft edge (no derivatives: this function
  // returns early, which leaves them undefined).
  float aa = 1.5 / uResolution.y;
  float body = smoothstep(width + aa, width - aa, abs(side)) * step(0.0, s) * step(s, 1.0);
  // Tail: a forked fan with fine rays.
  float ts = s - 0.92;
  float spread = 0.012 * len + 0.8 * max(ts, 0.0) * len;
  float fork = 1.0 - 0.45 * smoothstep(0.25, 0.42, ts) * smoothstep(0.35 * spread, 0.0, abs(side));
  float tail = step(0.0, ts) * smoothstep(0.45, 0.3, ts) * smoothstep(spread + aa, spread - aa, abs(side)) * fork;
  float rays = 0.85 + 0.15 * sin(clamp(side / max(spread, 1e-3), -1.0, 1.0) * 14.0);
  // Pectoral fins: swept-back fans beside the chest, gently paddling.
  float flap = 0.75 + 0.25 * sin(t * 2.0 + i * 3.0);
  vec2 f = vec2(back - 0.3 * len, abs(side) - 0.17 * len);
  f = mat2(0.8, 0.6, -0.6, 0.8) * f;
  float fin = smoothstep(1.0, 0.85, length(f / vec2(0.11 * len, 0.05 * len * flap)));
  float finRays = 0.85 + 0.15 * sin(f.y / (0.05 * len) * 6.0);
  float fins = max(tail * rays, fin * finRays * (1.0 - body));
  return vec4(body, fins, ss, clamp(side / max(width, 1e-4), -1.0, 1.0));
}

vec3 koiColor(float i, vec4 k, vec2 p) {
  float kind = hash01(vec2(i, 7.0));
  vec2 local = vec2(k.z * 4.0, k.w * 0.6) + i * 3.0;
  float spots = smoothstep(-0.03, 0.03, noise(local * 1.7));
  float ink = smoothstep(0.32, 0.36, noise(local * 3.1 + 9.0));
  vec3 white = vec3(0.97, 0.95, 0.91);
  vec3 red = uColors[2];
  vec3 col;
  if (kind < 0.4) col = mix(white, red, spots);                         // kohaku
  else if (kind < 0.65) col = mix(mix(white, red, spots), vec3(0.06), ink); // sanke
  else if (kind < 0.85) col = mix(vec3(1.0, 0.78, 0.36), vec3(1.0, 0.9, 0.6), 0.5 + 0.5 * k.w); // ogon
  else col = mix(mix(vec3(0.08), red, spots), white, smoothstep(0.1, 0.3, noise(local * 2.0 + 4.0))); // showa
  // Its head is a little cleaner and paler.
  col = mix(col, mix(col, white, 0.25), smoothstep(0.15, 0.0, k.z));
  return col;
}

vec3 scene(vec2 uv, float t) {
  // Ripples now and then: rings that bend everything below the surface.
  vec2 bend = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    float period = 9.0 + 4.0 * float(k);
    float n = floor(t / period + float(k) * 0.5);
    float age = fract(t / period + float(k) * 0.5) * period;
    vec2 at = (vec2(hash01(vec2(n, 31.0 + float(k))), hash01(vec2(n, 37.0))) - 0.5) * vec2(1.4, 0.8);
    vec2 d = uv - at;
    float r = length(d);
    float front = age * 0.06;
    float ring = sin((r - front) * 90.0) * exp(-pow((r - front) / 0.035, 2.0)) * exp(-age * 0.35);
    bend += d / max(r, 1e-3) * ring * 0.004;
  }
  vec2 p = uv + bend;

  // The floor: dim, rounded stones deep down.
  vec2 g = p * 7.0 + 0.35 * vec2(noiseFast(p * 3.0), noiseFast(p * 3.0 + 4.0));
  vec2 cell = floor(g);
  float near = 9.0;
  float second = 9.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = cell + vec2(x, y);
      vec2 c = o + 0.5 + 0.4 * (vec2(hash01(o), hash01(o + 5.3)) - 0.5);
      float d = length(g - c);
      if (d < near) { second = near; near = d; } else if (d < second) second = d;
    }
  }
  float stone = smoothstep(0.0, 0.35, second - near) * (1.0 - 0.6 * near);
  float silt = 0.5 + 0.5 * fbmFast(p * 2.5 + 3.0);
  vec3 col = mix(uColors[0] * 0.75, uColors[1] * 0.85, (0.35 + 0.4 * stone * (0.5 + 0.5 * hash01(cell))) * (0.6 + 0.4 * silt));
  // Deeper toward the edges.
  col = mix(col, uColors[0] * 0.8, smoothstep(0.3, 1.0, length(uv * vec2(0.75, 1.15))));

  // Sunlight shimmering on the floor.
  vec2 q = p * 5.0;
  float caustic = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 w = q * (1.0 + float(k) * 0.6) + vec2(0.1 * t, -0.07 * t) * (k == 0 ? 1.0 : -1.0);
    float n = noiseFast(w + 0.6 * vec2(noiseFast(w * 0.7 + 0.05 * t), noiseFast(w * 0.7 - 0.04 * t)));
    caustic += pow(max(1.0 - abs(n) * 2.2, 0.0), 6.0);
  }
  col += vec3(0.55, 0.8, 0.7) * 0.09 * caustic;

  // Koi: shadows on the floor first, then the fish, deep ones bluer.
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float len = 0.17 + 0.06 * hash01(vec2(fi, 5.0));
    float depth = hash01(vec2(fi, 9.0));
    vec2 off = vec2(0.02, -0.028) * (1.2 - depth);
    vec4 sh = koi(p - off, fi, t, len);
    col *= 1.0 - (0.3 + 0.15 * depth) * max(sh.x, sh.y * 0.5);
  }
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float len = 0.17 + 0.06 * hash01(vec2(fi, 5.0));
    float depth = hash01(vec2(fi, 9.0));
    vec4 k = koi(p, fi, t, len);
    if (k.x + k.y <= 0.0) continue;
    vec3 base = koiColor(fi, k, p);
    // Rounded and wet: darker along the flanks, a sheen along the spine.
    float round = sqrt(max(1.0 - k.w * k.w, 0.0));
    vec3 fish = base * (0.62 + 0.38 * round) + 0.18 * pow(round, 10.0) * (1.0 - k.z);
    // Eyes.
    float eye = smoothstep(0.09, 0.06, length(vec2((k.z - 0.08) * 4.0, abs(k.w) - 0.62)));
    fish = mix(fish, vec3(0.05), eye * k.x);
    vec3 fin = mix(base, vec3(1.0), 0.35);
    vec3 water = mix(uColors[1], uColors[0], 0.3);
    fish = mix(fish, water, 0.45 * depth);
    fin = mix(fin, water, 0.45 * depth);
    col = mix(col, fin, k.y * 0.55 * (1.0 - k.x));
    col = mix(col, fish, k.x);
  }

  // The surface: a little sky reflected, drifting sheen.
  float sheen = smoothstep(0.2, 0.8, fbmFast(uv * vec2(1.2, 3.5) + vec2(0.03 * t, 0.01 * t)));
  col += vec3(0.7, 0.85, 0.9) * (0.035 * sheen + 0.04 * smoothstep(0.2, 0.9, uv.y - uv.x * 0.3));

  // Lily pads floating above it all (one with a lotus).
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(hash01(vec2(fi, 11.0)) - 0.5, hash01(vec2(fi, 12.0)) - 0.5) * vec2(1.7, 1.0);
    c *= 1.0 + 0.6 * smoothstep(0.4, 0.0, length(c));
    c += 0.015 * vec2(sin(0.1 * t + fi), cos(0.08 * t + fi));
    float r = 0.06 + 0.05 * hash01(vec2(fi, 13.0));
    vec2 d = uv - c;
    float len = length(d);
    float shadow = smoothstep(r, r - 0.025, length(d - vec2(0.012, -0.016)));
    float a = atan(d.y, d.x) + 6.28 * hash01(vec2(fi, 14.0)) + 0.03 * sin(0.2 * t + fi);
    float notch = step(0.16, abs(mod(a + 3.14159, 6.28318) - 3.14159));
    float aa = 1.5 / uResolution.y;
    float pad = smoothstep(r + aa, r - aa, len) * notch;
    col *= 1.0 - 0.3 * shadow * (1.0 - pad);
    // The lotus sits on its pad, over the notch too.
    if (pad <= 0.0 && !(i == 2 && len < r * 0.66)) continue;
    float x = len / r;
    vec3 leaf = uColors[3] * (0.72 + 0.2 * hash01(vec2(fi, 15.0)));
    // Mottled, with fine veins from the middle, a yellowed, darker rim and
    // a gloss toward the light.
    leaf *= 0.85 + 0.25 * fbmFast(d / r * 3.0 + fi * 7.0);
    leaf *= 1.0 - 0.07 * smoothstep(0.9, 1.0, abs(sin(a * 11.0 + 0.3 * sin(x * 6.0)))) * smoothstep(0.1, 0.3, x);
    leaf = mix(leaf, vec3(0.62, 0.6, 0.25), 0.35 * smoothstep(0.85, 1.0, x));
    leaf *= 1.0 - 0.2 * smoothstep(0.9, 1.0, x);
    leaf += vec3(0.85, 1.0, 0.8) * 0.18 * exp(-pow(length(d / r - vec2(-0.35, 0.35)) / 0.35, 2.0));
    col = mix(col, leaf, pad);
    if (i == 2) {
      col = mix(col, vec3(0.0), 0.25 * smoothstep(r * 0.7, r * 0.5, length(d - vec2(0.006, -0.008))));
      // The lotus: two rings of pink petals, pale at the tips.
      float pa = atan(d.y, d.x);
      float outer = r * 0.62 * (0.55 + 0.45 * pow(abs(cos(4.0 * pa)), 0.5));
      float inner = r * 0.38 * (0.55 + 0.45 * pow(abs(cos(4.0 * pa + 0.785)), 0.5));
      vec3 pink = vec3(0.96, 0.62, 0.72);
      col = mix(col, mix(pink * 0.85, vec3(1.0, 0.93, 0.95), len / (r * 0.62)), smoothstep(outer + aa, outer - aa, len));
      col = mix(col, mix(pink, vec3(1.0, 0.95, 0.96), len / (r * 0.38)), smoothstep(inner + aa, inner - aa, len));
      col = mix(col, vec3(1.0, 0.85, 0.35), smoothstep(r * 0.1, r * 0.07, len));
    }
  }
  return col;
}
`,
};

const windowScene: Scene = {
  id: 'window',
  name: 'Window',
  colors: ['#04060c', '#141c33', '#ffae5c', '#ff4f6a'],
  base: '#070c14',
  speed: 0.6,
  resolution: 1,
  fragment: /* glsl */ `
// Rain on a window at night. Behind the glass, a city out of focus:
// buildings with lit windows, street lamps, cars passing below. On the
// glass, beads and running drops; each drop is a little lens showing the
// city sharp and upside down, and running drops wipe clear trails.

// The city at p, seen through the glass. focus 0: lights melt into big
// soft discs; 1: they shrink to small bright points (as through a drop).
vec3 city(vec2 p, float focus, float t) {
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.25, 0.55, p.y));
  // The city's glow: warm low down, a cooler haze above, slowly shifting.
  float glow = 0.5 + 0.5 * fbmFast(p * vec2(1.4, 2.2) + vec2(0.01 * t, 0.0));
  col += mix(uColors[3] * 0.35, uColors[2], smoothstep(0.1, -0.4, p.y)) * 0.16 * glow * smoothstep(0.5, -0.2, p.y);

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sc = fi == 0.0 ? 4.0 : fi == 1.0 ? 7.0 : 12.0;
    // Each layer drifts very slowly, the nearest fastest, for depth.
    vec2 g = p * sc + vec2(fi * 3.7 + t * 0.012 * (3.0 - fi), fi * 1.3);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell = floor(g) + vec2(x, y);
        float h = hash01(cell + fi * 13.0);
        float lowness = smoothstep(0.45, -0.4, (cell.y + 0.5) / sc - fi * 1.3 / sc);
        if (h > mix(0.08, 0.55, lowness)) continue;
        vec2 c = cell + 0.5 + 0.7 * (vec2(hash01(cell + 3.3), hash01(cell + 6.1)) - 0.5);
        float size = (0.25 + 0.35 * hash01(cell + 9.9)) * mix(1.0, 0.18, focus);
        float d = length(g - c);
        float soft = size * mix(0.2, 0.5, focus);
        float disc = smoothstep(size, size - soft, d);
        // A slightly brighter rim, as real out-of-focus lights have.
        disc *= 0.8 + 0.25 * smoothstep(size * 0.55, size * 0.95, d);
        float pick = hash01(cell + 4.4);
        vec3 light = pick < 0.45 ? uColors[2] : pick < 0.65 ? vec3(1.0, 0.92, 0.8) : pick < 0.85 ? uColors[3] : vec3(0.55, 0.8, 0.95);
        float flicker = 0.85 + 0.15 * sin(t * (0.3 + h) + h * 40.0);
        // Smaller (in-focus) lights are brighter: the same light, gathered.
        float energy = (0.18 + 0.25 * hash01(cell + 7.7)) * mix(1.0, 3.0, focus);
        col += light * disc * energy * flicker * (fi == 0.0 ? 1.0 : fi == 1.0 ? 0.8 : 0.6);
      }
    }
  }
  return col;
}

// Beads on the glass: lens direction (xy) and coverage (z).
vec3 beads(vec2 uv, float t, float scale, float seed) {
  vec2 g = uv * scale;
  vec2 cell = floor(g);
  if (hash01(cell + seed) > 0.3) return vec3(0.0);
  vec2 c = cell + 0.5 + 0.5 * (vec2(hash01(cell + seed + 2.9), hash01(cell + seed + 7.3)) - 0.5);
  float life = fract(t * 0.03 + hash01(cell + seed + 1.7));
  float r = 0.36 * (0.35 + 0.65 * hash01(cell + seed + 5.5)) * smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.75, life);
  vec2 q = (g - c) / max(r, 1e-3);
  q.y *= 1.08;
  float l = length(q);
  float cover = smoothstep(1.0, 0.85, l) * step(0.04, r);
  return vec3(q * cover, cover);
}

vec3 scene(vec2 uv, float t) {
  vec2 lens = vec2(0.0);
  float wet = 0.0;
  float rim = 0.0;
  float size = 0.0;

  // Running drops: one per column, sliding in fits and starts.
  float cols = 9.0;
  float column = floor(uv.x * cols);
  float h = hash01(vec2(column, 3.0));
  float phase = t * (0.07 + 0.05 * h) + h * 10.0;
  float slide = floor(phase) + smoothstep(0.55, 1.0, fract(phase));
  float y = 0.65 - fract(slide * 0.21 + h) * 1.4;
  float x = (column + 0.5 + (h - 0.5) * 0.5) / cols + 0.006 * sin(18.0 * (uv.y - y) + h * 6.0);
  vec2 d = uv - vec2(x, y);
  float rd = 0.016 + 0.01 * h;
  vec2 dq = d / vec2(rd, rd * (d.y > 0.0 ? 1.45 : 1.0));
  float drop = smoothstep(1.0, 0.85, length(dq));
  lens += dq * drop;
  wet = max(wet, drop);
  rim = max(rim, drop * smoothstep(0.6, 1.0, length(dq)));
  size = max(size, drop * rd);
  // Its trail: the glass wiped clear, with tiny drops left behind.
  float above = uv.y - y;
  float trail = step(0.0, above) * smoothstep(0.3, 0.02, above) * smoothstep(rd * 0.7, rd * 0.35, abs(d.x));
  vec2 tg = vec2(d.x / (rd * 0.35), (fract(above * 30.0 + h) - 0.5) * 3.0);
  float bit = smoothstep(1.0, 0.8, length(tg)) * trail * step(0.03, above) * step(0.4, hash01(vec2(column, floor(above * 30.0 + h))));
  lens += tg * bit;
  wet = max(wet, bit);
  size = max(size, bit * rd * 0.3);

  // Beads everywhere else, in three sizes.
  vec3 b1 = beads(uv, t, 22.0, 0.0) * (1.0 - trail);
  vec3 b2 = beads(uv, t * 1.2, 40.0, 7.0) * (1.0 - trail);
  vec3 b3 = beads(uv, t * 1.4, 70.0, 13.0) * (1.0 - trail) * 0.0;
  lens += b1.xy + b2.xy + b3.xy;
  wet = max(wet, max(b1.z, max(b2.z, b3.z)));
  rim = max(rim, max(b1.z * smoothstep(0.6, 1.0, length(b1.xy)), b2.z * smoothstep(0.6, 1.0, length(b2.xy))));
  size = max(size, max(b1.z * 0.016, max(b2.z * 0.009, b3.z * 0.005)));

  // Through a drop the city is sharp, flipped and shrunk; elsewhere the
  // fogged glass blurs it, less where a drop has wiped it.
  vec2 look = uv - lens * size * 14.0;
  vec3 col = city(mix(uv, look, wet), max(wet * 0.4, trail * 0.3), t);
  // Drops gather the sky's light; condensation lightens the glass a
  // little, less on the wiped trails.
  col += uColors[1] * 0.3 * wet * (1.0 - rim);
  // Light gathered along a drop's lower edge.
  col += vec3(1.0, 0.9, 0.8) * 0.12 * wet * smoothstep(0.5, 0.95, -lens.y) * smoothstep(1.0, 0.7, length(lens));
  col = mix(col, col * 0.88 + uColors[1] * 0.15, (1.0 - wet) * (1.0 - 0.5 * trail) * 0.3);
  // A drop's edge is darker; a tiny highlight sits near its top.
  col *= 1.0 - 0.18 * rim;
  vec2 n = lens;
  col += vec3(0.9, 0.95, 1.0) * 0.35 * wet * smoothstep(0.35, 0.0, length(n - vec2(-0.3, 0.45)));
  return col;
}
`,
};

const lumen: Scene = {
  id: 'lumen',
  name: 'Lumen',
  colors: ['#030509', '#0c1622', '#ffd9a1', '#7fb8c9'],
  base: '#05080d',
  speed: 0.4,
  resolution: 0.5,
  fragment: /* glsl */ `
// Light through haze: shafts falling from an opening above into a dark
// room. They sway and breathe as if leaves moved across the opening, the
// haze rolls through them, and dust drifts and glints in the light.

vec3 scene(vec2 uv, float t) {
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.6, 0.5, uv.y + 0.3 * uv.x));

  vec2 src = vec2(-0.38 + 0.03 * sin(0.11 * t), 0.78);
  vec2 rel = uv - src;
  float dist = length(rel);
  float ang = atan(rel.x, -rel.y);
  // Shafts: broad bands of angle that sway, widen and dim on their own.
  float shafts = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float sway = 0.08 * sin(0.21 * t + fi * 1.7) + 0.04 * sin(0.47 * t + fi * 4.1);
    float center = -0.05 + 0.24 * fi + sway;
    float width = 0.04 + 0.022 * sin(0.17 * t + fi * 2.3) + 0.012 * fi;
    float strength = 0.35 + 0.65 * smoothstep(-0.35, 0.4, noiseFast(vec2(fi * 3.7, 0.35 * t)));
    shafts += exp(-pow((ang - center) / width, 2.0)) * strength;
  }
  // Fine streaks within, like light through leaves, shimmering.
  float streak = 0.55 + 0.45 * noiseFast(vec2(ang * 40.0 + 0.4 * sin(0.3 * t), 0.5 * t));
  // Haze rolling through: thicker patches drift down and across.
  vec2 hq = uv * 2.2 + vec2(0.07 * t, 0.05 * t);
  float haze = smoothstep(-0.45, 0.5, fbmFast(hq + 0.5 * fbmFast(hq * 1.7 - 0.04 * t))) * 0.8 + 0.2;
  // Pulses of brighter air travelling down each shaft.
  float flow = 0.8 + 0.2 * noiseFast(vec2(ang * 6.0, dist * 4.0 - 0.6 * t));
  float fall = exp(-dist * 0.75);
  float light = shafts * streak * haze * flow * fall;
  vec3 beam = mix(uColors[3], uColors[2], smoothstep(0.2, 1.0, shafts));
  col += beam * light * 1.6;
  // A soft bloom near the opening, breathing with the light.
  float breathe = 0.85 + 0.15 * sin(0.33 * t);
  col += (uColors[2] * 0.5 * exp(-dist * 3.5) + vec3(1.0, 0.95, 0.85) * 0.5 * exp(-dist * 14.0)) * breathe;

  // Dust in three depths: specks that wander, turn and glint in the light.
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float sc = fk == 0.0 ? 60.0 : fk == 1.0 ? 32.0 : 16.0;
    vec2 g = uv * sc + vec2(0.18 * t * (0.6 + 0.4 * fk) * (k == 1 ? -1.0 : 1.0), -0.12 * t * (0.5 + 0.3 * fk));
    for (int y = 0; y <= 1; y++) {
      vec2 cell = floor(g) + vec2(0.0, float(y) - 0.5 + step(0.5, fract(g.y)) - 0.5);
      cell = floor(g) + vec2(0.0, float(y) * (fract(g.y) < 0.5 ? -1.0 : 1.0));
      float h = hash01(cell + fk * 9.0);
      if (h > 0.4) continue;
      vec2 c = cell + 0.5 + 0.4 * vec2(sin(t * (0.5 + h) + h * 20.0), cos(t * (0.45 + h) + h * 13.0));
      float d = length(g - c);
      float size = fk == 0.0 ? 0.07 : fk == 1.0 ? 0.1 : 0.16;
      float soft = fk == 2.0 ? 0.6 : 0.0;
      float speck = smoothstep(size, size * soft, d) * (0.4 + 0.6 * pow(0.5 + 0.5 * sin(t * (1.2 + h) + h * 30.0), 2.0));
      col += uColors[2] * speck * light * (fk == 0.0 ? 1.6 : fk == 1.0 ? 2.2 : 1.4);
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
  // Hairlines need every pixel the screen has (like a photo).
  resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
  fragment: /* glsl */ `
// A topographic map whose land slowly reshapes: contour lines flow, merge
// and part; every fifth line is drawn bolder, as on a real map. Drawn at
// the screen's full pixel density, so the lines are true hairlines.

float terrain(vec2 p, float t) {
  vec2 a = p * 1.1 + vec2(0.05 * t, -0.03 * t);
  vec2 b = p * 1.4 + vec2(-0.04 * t, 0.025 * t) + 7.0;
  // Exact noise: thin lines show every kink of the faster texture.
  a += 0.4 * vec2(noise(b), noise(b + 3.0));
  return 0.7 * noise(a) + 0.32 * noise(a * 2.1 + 1.7) + 0.1 * noise(a * 4.3 + 5.1);
}

// A line of the given width in pixels along the integer values of f.
float isoline(float f, float px) {
  float w = fwidth(f);
  float d = abs(fract(f + 0.5) - 0.5) / max(w, 1e-5);
  return 1.0 - smoothstep(px * 0.5 - 0.5, px * 0.5 + 0.5, d);
}

vec3 scene(vec2 uv, float t) {
  float h = terrain(uv, t);
  // Paper, tinted cool in the valleys and warm on the heights.
  vec3 col = uColors[0];
  col = mix(col, uColors[1], 0.55 * smoothstep(0.0, -0.4, h));
  col = mix(col, uColors[3], 0.35 * smoothstep(0.05, 0.45, h));
  // Relief: slopes facing the light from the upper left a touch lighter,
  // the far side a touch darker, as on a well-made survey map.
  vec2 slope = vec2(dFdx(h), dFdy(h)) * uResolution.y;
  float relief = clamp(dot(slope, vec2(0.6, -0.8)) * 0.06, -0.06, 0.06);
  col *= 1.0 - relief;

  // Pixel widths scale with density, so lines look the same on any screen.
  float px = max(uResolution.y / 900.0, 1.0);
  float f = h * 15.0;
  float minor = isoline(f, 1.0 * px);
  float index = isoline(f / 5.0, 2.2 * px);
  float ink = max(minor * 0.42, index * 0.78);
  col = mix(col, uColors[2], ink);
  // A little paper grain.
  col *= 0.985 + 0.03 * noiseFast(uv * 260.0);
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
  sakura,
  comet,
  koi,
  windowScene,
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
