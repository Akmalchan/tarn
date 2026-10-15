/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
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
  speed: 0.18,
  resolution: 0.35,
  fragment: /* glsl */ `
// Tarn: light moving through still water. Triple domain warp over the
// baked noise texture: 3 octaves for the two warp fields (smooth, slow
// currents), 4 for the surface. 16 texture fetches, no per-pixel hashing,
// so it stays cheap on GPUs with weak integer math.
float fbm3(vec2 p) {
  float s = 0.5 * noiseFast(p);
  p = OCTAVE * p;
  s += 0.25 * noiseFast(p);
  p = OCTAVE * p;
  return s + 0.125 * noiseFast(p);
}

vec3 scene(vec2 uv, float t) {
  vec2 p = uv * 1.7;
  vec2 q = vec2(fbm3(p + vec2(0.0, 0.3 * t)),
                fbm3(p + vec2(5.2, 1.3) - 0.25 * t));
  vec2 w = p + 2.8 * q;
  vec2 r = vec2(fbm3(w + vec2(1.7, 9.2) + 0.4 * t),
                fbm3(w + vec2(8.3, 2.8) - 0.3 * t));
  float f = fbmFast(p + 2.6 * r);

  float v = clamp(f * 1.7 + 0.5, 0.0, 1.0);
  vec3 col = mix(uColors[0], uColors[1], smoothstep(0.15, 0.85, v));
  col = mix(col, uColors[2], smoothstep(0.25, 0.75, length(q) * 1.8));
  // Pale light only on the crests, and never at full strength: tempered.
  col = mix(col, uColors[3],
            0.55 * smoothstep(0.66, 1.0, v) * smoothstep(-0.1, 0.55, r.y));

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
// Film grain hash: float math only (no integer ops), white and uncorrelated
// for pixel coordinates and frame numbers in the few-thousands range.
float grainHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

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

  // A new grain field every rendered frame, whatever the pace: t advances
  // at least 0.012 per frame (calm, 20 fps), so t * 120 always moves on.
  // Kept below 4096 so the hash stays precise on long-lived tabs.
  float frame = mod(floor(t * 120.0), 4096.0);
  float a = grainHash(vec3(gl_FragCoord.xy, frame));
  float b = grainHash(vec3(gl_FragCoord.xy, frame + 4096.0));
  // a + b: a soft, film-like (triangular) spread instead of flat digital
  // noise; a - b is independent of it and adds a faint warm/cool dye tint.
  float amp = mix(0.04, 0.12, shape);
  col += amp * (0.707 * (a + b - 1.0) + 0.16 * (a - b) * vec3(1.0, -0.3, -1.0));
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
  resolution: 0.2,
  fragment: /* glsl */ `
// Bloom: soft pastel mesh. Three noise octaves per field instead of four
// (6 texture fetches instead of 8); the fourth was finer than the eye
// keeps at this softness.
float fbm3(vec2 q) {
  float n = 0.5 * noiseFast(q);
  q = OCTAVE * q;
  n += 0.25 * noiseFast(q);
  return n + 0.1875 * noiseFast(OCTAVE * q);
}

vec3 scene(vec2 uv, float t) {
  vec2 p = uv * 1.2;
  float n = fbm3(p + vec2(0.35 * t, -0.2 * t));
  float m = fbm3(p * 1.6 - vec2(0.15 * t, 0.3 * t) + 4.0);

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
  colors: ['#030a1f', '#123a85', '#4f8dff', '#d6e7ff'],
  base: '#06102b',
  speed: 0.35,
  resolution: 0.75,
  fragment: /* glsl */ `
// Wave: three ribbons of light at different depths, each twisting as it
// drifts over a softly lit swell in deep blue, with sparkles and a few
// out-of-focus motes. Rows a ribbon can't reach skip it.

// One ribbon: a band around a wavy center line whose width swings through
// zero, so it seems to twist in depth. A lit translucent sheet, strands
// inside, bright rims, a soft halo, light sweeping along it.
// px = blur in uv units.
float ribbon(vec2 uv, float t, float y0, float amp, float k, float w,
             float ph, float halfW, float strands, float px) {
  float x = uv.x;
  float c = y0 + amp * sin(k * x + w * t + ph)
          + amp * 0.4 * sin(2.1 * k * x - 0.6 * w * t + ph * 2.3);
  float h = halfW * sin(2.3 * x + 0.5 * w * t + ph * 3.1);
  float ah = abs(h);
  float d = uv.y - c;
  float ad = abs(d);
  float inside = smoothstep(ah + px, ah - px, ad);
  float edgeOn = 1.0 - ah / halfW;
  float sweep = 0.65 + 0.35 * sin(1.4 * x - 0.8 * w * t + ph * 1.7);
  // Across the sheet: lit toward one edge, as if curved.
  float s = clamp(d / (ah + px) * sign(h), -1.0, 1.0);
  float lit = 0.5 + 0.5 * s;
  float shade = 0.2 + 0.8 * lit * lit;
  float fill = inside * (0.26 + 0.7 * edgeOn * edgeOn) * shade;
  // Strands fan in and out as the ribbon flows; light runs along each.
  float sp = 2.0 * ah / strands;
  float u = (d + ah) / (sp + 1e-5);
  u += 0.18 * strands * sin(3.1 * x - w * t + ph) * (1.0 - s * s);
  float q = abs(fract(u + 0.5) - 0.5) * sp;
  float line = smoothstep(1.4 * px, 0.0, q) * clamp(sp / px * 0.3 - 1.0, 0.0, 1.0);
  line *= 0.55 + 0.45 * sin(5.0 * x - 1.6 * w * t + floor(u + 0.5) * 1.9);
  float de = abs(ad - ah) / px;
  float rim = 1.0 / (1.0 + de * de);
  float hz = max(ad - ah, 0.0) * 30.0;
  float halo = 0.12 / (1.0 + hz * hz);
  return (fill + line * inside * 0.6 * shade + rim * 0.75 + halo) * sweep;
}

vec3 scene(vec2 uv, float t) {
  float px = 1.0 / uResolution.y;
  // Deep blue, darker at the top.
  vec3 col = mix(uColors[0], uColors[1], smoothstep(0.6, -0.55, uv.y) * 0.75);
  // A broad swell below the ribbons, its crest catching light.
  float swell = -0.27 + 0.06 * sin(uv.x * 1.1 + t * 0.4) + 0.025 * sin(uv.x * 2.9 - t * 0.55);
  float under = uv.y - swell;
  float crest = under < 0.0 ? exp(under * 5.0) : exp(-under * under * 60.0);
  col += uColors[2] * 0.16 * crest * (0.75 + 0.25 * sin(uv.x * 1.7 - t * 0.35));

  vec3 lite = mix(uColors[2], uColors[3], 0.55);
  if (abs(uv.y + 0.04) < 0.2) {
    col += uColors[2] * 0.28 * ribbon(uv, t, -0.04, 0.05, 1.7, 0.55, 0.0, 0.045, 8.0, 2.5 * px);
  }
  if (abs(uv.y + 0.22) < 0.32) {
    col += lite * 0.7 * ribbon(uv, t, -0.22, 0.08, 1.8, 0.7, 2.1, 0.1, 14.0, px);
  }
  if (uv.y < -0.1) {
    col += mix(uColors[2], lite, 0.4) * 0.55 * ribbon(uv, t, -0.43, 0.1, 1.2, 0.5, 4.3, 0.16, 10.0, 9.0 * px);
  }

  // Sparkles drifting with the flow, gathering near the ribbons.
  vec2 p = uv * 26.0 + vec2(t * 0.6, t * 0.12);
  float h = hash01(p);
  vec2 o = vec2(fract(h * 13.7), fract(h * 71.3)) * 0.6 + 0.2;
  float dd = length(fract(p) - o);
  float tw = 0.5 + 0.5 * sin(t * (1.5 + 2.0 * fract(h * 7.1)) + h * 40.0);
  float r = 0.045 + 0.05 * fract(h * 3.3);
  float spark = step(0.78, h) * tw * smoothstep(r, 0.0, dd);
  // Out-of-focus motes, close to the eye.
  vec2 b = uv * 5.0 + vec2(t * 0.25, -t * 0.05);
  float bh = hash01(b + 57.0);
  vec2 bo = vec2(fract(bh * 13.7), fract(bh * 71.3)) * 0.5 + 0.25;
  float bd = length(fract(b) - bo);
  float bokeh = step(0.6, bh) * smoothstep(0.17, 0.09, bd) * (0.4 + 0.6 * fract(bh * 5.1));
  float band = 0.15 + 0.85 * exp(-under * under * 10.0);
  col += (uColors[3] * spark * 0.6 + uColors[2] * bokeh * 0.09) * band;

  col *= 1.0 - 0.3 * dot(uv * vec2(0.55, 1.0), uv * vec2(0.55, 1.0));
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
  resolution: 0.4,
  fragment: /* glsl */ `
// Sine-like waves from two parabolas (cheaper than sin on weak GPUs);
// p is in turns. wave1 is about sin(2*pi*p), wave2 adds the cosine.
float wave1(float p) {
  float q = fract(p) * 2.0 - 1.0;
  return 4.0 * q * (abs(q) - 1.0);
}

vec2 wave2(float p) {
  vec2 q = fract(vec2(p, p + 0.25)) * 2.0 - 1.0;
  return 4.0 * q * (abs(q) - 1.0);
}

// A curtain of light seen from below: a ribbon that folds back and forth.
// Where a fold turns edge-on there is more ribbon over the same stretch of
// sky, so the light is brighter and its rays, which belong to the ribbon,
// bunch together. wave bends the lower edge, lit is how bright this
// stretch is, fine > 0 adds thin streaks from a second lookup (otherwise
// cheaper streaks from a wave). Returns (glow, lower border).
vec2 curtain(vec2 uv, float t, float seed, float height, float wave,
             float lit, float fine) {
  float x = uv.x + seed;
  vec2 f = wave2(0.414 * x - 0.019 * t + 0.16 * seed + 0.48 * wave);
  float s = x - 0.19 * f.x;        // position along the ribbon
  float fold = 1.0 - 0.5 * f.y;    // how much ribbon lies over this x
  float d = uv.y - (height + 0.17 * wave + 0.045 * f.x);
  if (d < -0.16 || lit < 0.002) return vec2(0.0);
  float n = noiseFast(vec2(8.0 * s + 0.3 * t, 0.5 * d + seed - 0.12 * t));
  float rays;
  if (fine > 0.0) {
    float m = noiseFast(vec2(27.0 * s - 0.2 * t, 0.12 * d + seed + 0.05 * t));
    rays = smoothstep(-0.2, 0.45, n)
      * (1.0 - fine + fine * 1.5 * smoothstep(-0.35, 0.35, m));
  } else {
    rays = smoothstep(-0.1, 0.45, n)
      * (0.55 + 0.45 * wave1(3.1 * s + 1.6 * n - 0.02 * t));
  }
  // One exp serves both sides: a slow fade above the edge, a sharp one below.
  float e = exp(d > 0.0 ? -3.0 * d : 34.0 * d);
  float e3 = d > 0.0 ? e : 1.0;
  float e12 = e3 * e3;
  e12 *= e12;
  float k = (d > 0.0 ? 1.0 : e) * (0.08 + 0.92 * rays) * lit * fold;
  return vec2((0.55 * e12 + 0.45 * e3) * k, k * e12 * e12 * e12);
}

vec3 scene(vec2 uv, float t) {
  // Night sky, with a faint teal haze low down.
  vec3 col = mix(uColors[1] + 0.03 * uColors[2], uColors[0],
                 smoothstep(-0.7, 0.1, uv.y));

  // The band crosses the sky at a slight angle, rising to the right.
  const float C = 0.98006658, S = 0.19866933; // cos, sin of 0.2
  vec2 r = vec2(C * uv.x - S * uv.y, S * uv.x + C * uv.y);
  // The arcs run roughly parallel, both bent by one slow wave, and mostly
  // take turns being lit.
  float wave = noiseFast(vec2(1.1 * r.x + 0.05 * t, -0.03 * t));
  float lit = noiseFast(vec2(0.9 * r.x - 0.05 * t, 3.7));
  float la = clamp(0.55 + 1.4 * lit, 0.12, 1.0);
  float lb = clamp(0.6 - 1.1 * lit, 0.12, 1.0);
  vec2 a = curtain(r, t, 0.0, -0.1, wave, la, 0.5);
  vec2 b = curtain(r * vec2(0.75, 1.0), t * 0.8, 7.3, 0.06, -0.3 - 0.8 * wave, lb, 0.0);

  // Teal low, violet high; where the arc rises the violet starts higher.
  float high = smoothstep(0.0, 0.55, r.y + 0.12 - 0.15 * wave);
  float glow = a.x + 0.55 * b.x;
  // Bright folds saturate softly instead of clipping.
  col += mix(uColors[2], uColors[3], high) * glow * (1.8 / (1.0 + 0.35 * glow));
  // The lower border is a little whiter where it is brightest.
  col += (uColors[2] + 0.3) * (a.y + 0.55 * b.y) * 0.12;

  if (uv.y > -0.1 && glow < 1.0) {
    // Stars: a soft round point in a few cells, twinkling slowly.
    vec2 grid = uv * 150.0;
    uvec2 c = uvec2(ivec2(floor(grid)) + 4096);
    uint h = c.x * 0x27d4eb2du ^ c.y * 0x165667b1u;
    h ^= h >> 15u;
    h *= 0x2c1b3c6du;
    h ^= h >> 13u;
    if (h > 4279000000u) {
      vec2 o = fract(grid) - 0.5;
      float star = smoothstep(0.16, 0.0, dot(o, o))
        * min(uv.y * 2.0 + 0.2, 1.0)
        * (0.7 + 0.3 * wave1(0.14 * t + float(h & 1023u) / 1024.0));
      col += star * 0.3 * (1.0 - glow);
    }
  }

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
  resolution: 0.33,
  fragment: /* glsl */ `
// Silk: a warped sine height field. The slope is analytic: the sines'
// derivatives are exact cosines, and the warp's own (gentle, low-frequency)
// slope comes from screen-space derivatives of the two noise fetches, so
// one evaluation replaces three.
vec3 scene(vec2 uv, float t) {
  vec2 p = uv * 2.1;
  vec2 q = 0.6 * p;
  vec2 nz = vec2(noiseFast(q + vec2(0.0, 0.1 * t)),
                 noiseFast(q + vec2(4.3, -0.08 * t)));
  vec2 w = p + 0.38 * nz;
  // d(w)/d(p) = I + 0.38 * d(nz)/d(p); p moves 2.1 / height per pixel.
  float px = 2.1 / uResolution.y;
  vec2 nzx = dFdx(nz) / px, nzy = dFdy(nz) / px;
  mat2 J = mat2(1.0 + 0.38 * nzx.x, 0.38 * nzx.y,
                0.38 * nzy.x, 1.0 + 0.38 * nzy.y);

  const vec2 K1 = vec2(2.4, 1.6), K2 = vec2(-1.0, 2.2), K3 = vec2(4.4, 2.6);
  float a1 = dot(K1, w) + 0.3 * t;
  float a2 = dot(K2, w) - 0.22 * t;
  float a3 = dot(K3, w) + 0.17 * t;
  // Gradient with respect to w, then through the warp to p.
  vec2 gw = 0.7 * cos(a1) * K1 + 0.22 * cos(a2) * K2 + 0.08 * cos(a3) * K3;
  vec2 slope = vec2(dot(gw, J[0]), dot(gw, J[1]));

  vec3 n = normalize(vec3(-0.8 * slope, 1.0));
  const vec3 sun = vec3(-0.55, 0.5, 0.55) * 1.0814761;
  const vec3 halfv = vec3(-0.3331, 0.3028, 0.8930);

  float diffuse = clamp(dot(n, sun), 0.0, 1.0);
  float s = clamp(dot(n, halfv), 0.0, 1.0);
  s *= s; s *= s; s *= s;               // ^8
  float sheen = s * s * s;              // ^24

  vec3 col = mix(uColors[0], uColors[1], smoothstep(0.05, 0.72, diffuse));
  col = mix(col, uColors[2], smoothstep(0.6, 0.95, diffuse));
  col = mix(col, uColors[3], 0.42 * smoothstep(0.35, 0.9, diffuse) * smoothstep(-0.7, 0.7, uv.x - uv.y));
  col += 0.12 * sheen;
  vec2 v = uv * vec2(0.6, 1.0);
  col *= 1.0 - 0.12 * dot(v, v);
  return col;
}
`,
};

/**
 * Mist: layered hills at dawn, each fainter with distance, with fog
 * drifting slowly between them.
 */
const comet: Scene = {
  id: 'comet',
  name: 'Comet',
  colors: ['#070b26', '#3a2a6e', '#f09a78', '#bfe6ff'],
  base: '#0b0f2c',
  speed: 0.2,
  resolution: 1,
  fragment: /* glsl */ `
// Twilight by a mountain lake: a comet over the ranges, stars coming out,
// the whole sky mirrored in still water with a few lights on the far shore.

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

vec3 sky(vec2 uv, float t) {
  float y = uv.y;
  // Indigo overhead, violet, then the warm afterglow at the horizon.
  vec3 col = mix(uColors[1], uColors[0], smoothstep(-0.2, 0.5, y));
  col = mix(col, uColors[2], smoothstep(0.05, -0.3, y) * 0.85);
  col += vec3(0.25, 0.12, 0.05) * exp(-12.0 * abs(y + 0.26)) * 0.6;

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

  return col;
}

// Ridged noise: sharp crests, like eroded mountains.
float ridged(float x, float seed) {
  float sum = 0.0;
  float amp = 0.55;
  float f = 1.0;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(noise(vec2(x * f, seed + float(i) * 7.3)) * 1.6);
    sum += amp * n * n;
    f *= 2.1;
    amp *= 0.45;
  }
  return sum;
}

// Lights scattered along the far shore: positions in cells along x.
vec3 shoreLight(float cell, float shore) {
  // Lights gather in a few small villages along the shore.
  float village = smoothstep(-0.05, 0.2, noise(vec2(cell * 0.13, 3.0)));
  float on = step(hash01(vec2(cell, 80.0)), 0.7 * village);
  vec2 at = vec2((cell + 0.2 + 0.6 * hash01(vec2(cell, 81.0))) / 28.0, shore + 0.004 + 0.008 * hash01(vec2(cell, 82.0)));
  return vec3(at, on);
}

// The land above the shore at p over the sky color: two ranges fading
// into the haze, rim-lit by the afterglow, then the dark forested shore.
vec3 land(vec3 col, vec2 p, float t, float shore, float px) {
  // Big peaks and low saddles, not a row of equal bumps.
  float massif = 0.45 + 0.75 * smoothstep(-0.45, 0.45, noise(vec2(p.x * 0.9 + 2.0, 3.0)));
  float far = shore + 0.04 + 0.15 * massif * ridged(p.x * 1.4 + 3.0, 1.0);
  float farMask = smoothstep(px, -px, p.y - far);
  // Lit warm along the crests by the afterglow, cooler and darker below.
  float below = smoothstep(shore + 0.17, shore + 0.01, p.y);
  vec3 haze = mix(mix(uColors[1], uColors[2], 0.45) * 0.7, mix(uColors[1], uColors[0], 0.5) * 0.55, below);
  col = mix(col, haze, farMask);
  col += uColors[2] * 0.3 * farMask * smoothstep(0.006, 0.0, far - p.y);
  // Faint ridgelines in the far range.
  col *= 1.0 - 0.08 * farMask * smoothstep(0.4, 0.9, ridged(p.x * 6.0 + p.y * 3.0, 9.0));
  float mid = shore + 0.025 + 0.08 * ridged(p.x * 2.4 + 11.0, 4.0);
  float midMask = smoothstep(px, -px, p.y - mid);
  col = mix(col, mix(uColors[1] * 0.42, uColors[0], 0.4), midMask);
  col += uColors[2] * 0.12 * midMask * smoothstep(0.005, 0.0, mid - p.y);
  // The near shore: a ragged line of treetops.
  float trees = shore + 0.012 + 0.012 * fbmFast(vec2(p.x * 9.0, 2.0))
    + 0.006 * abs(noise(vec2(p.x * 140.0, 5.0))) + 0.004 * abs(noise(vec2(p.x * 300.0, 8.0)));
  col = mix(col, uColors[0] * 0.55, smoothstep(px, -px, p.y - trees));
  // Lights on the far shore, among the trees.
  for (int i = -1; i <= 1; i++) {
    vec3 l = shoreLight(floor(p.x * 28.0) + float(i), shore);
    float d = length(p - l.xy);
    float glow = exp(-d * d / (0.0013 * 0.0013)) + 0.18 * exp(-d * 55.0);
    col += vec3(1.0, 0.75, 0.45) * glow * l.z * (0.85 + 0.15 * sin(t * 1.1 + l.x * 90.0));
  }
  return col;
}

vec3 scene(vec2 uv, float t) {
  float shore = -0.27;
  float px = 1.5 / uResolution.y;
  if (uv.y > shore) return land(sky(uv, t), uv, t, shore, px);

  // The lake: the land and sky mirrored, broken by slow ripples that
  // stretch the reflection more the nearer the water.
  float depth = shore - uv.y;
  float ripple = noiseFast(vec2(uv.x * 5.0 + 0.02 * t, depth * 90.0 / (0.3 + depth * 3.0) - 0.35 * t));
  vec2 m = vec2(uv.x + 0.004 * ripple * (0.2 + 4.0 * depth), shore + depth * 0.9 + 0.003 * ripple);
  vec3 col = land(sky(m, t), m, t, shore, px);
  // Water is darker than what it mirrors, more so close by.
  col *= mix(0.72, 0.42, smoothstep(0.0, 0.22, depth));
  col = mix(col, uColors[0] * 0.5, 0.15);
  // Fine, bright ripple lines catching the afterglow.
  float lines = smoothstep(0.55, 0.9, noiseFast(vec2(uv.x * 2.0, depth * 400.0 / (0.4 + depth * 6.0) - 0.5 * t)));
  col += uColors[2] * 0.08 * lines * smoothstep(0.3, 0.0, depth);
  // The shore lights' reflections: long shimmering streaks below each.
  for (int i = -1; i <= 1; i++) {
    vec3 l = shoreLight(floor(uv.x * 28.0) + float(i), shore);
    float dx = uv.x - l.x;
    float streak = exp(-dx * dx / (0.0018 * 0.0018 * (1.0 + 40.0 * depth))) * exp(-depth * 7.0);
    float shimmer = smoothstep(-0.2, 0.6, noiseFast(vec2(l.x * 50.0, depth * 160.0 - 0.8 * t)));
    col += vec3(1.0, 0.72, 0.42) * streak * shimmer * l.z * 0.7;
  }
  // A thin dark line where water meets land.
  col *= 1.0 - 0.4 * smoothstep(0.004, 0.0, depth);
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
  // Hairlines need more pixels than the soft scenes: the screen's
  // density, capped at 1.5 (at 2 the lines look the same and the frame
  // costs ~75 MB more graphics memory on a 2x screen).
  resolution: Math.min(globalThis.devicePixelRatio || 1, 1.5),
  fragment: /* glsl */ `
// A topographic map whose land slowly reshapes: contour lines flow, merge
// and part; every fifth line is drawn bolder, as on a real map. Drawn at
// the screen's pixel density, so the lines are true hairlines.
//
// Cost: thin lines need land that is smooth to the second derivative
// (a kink in the slope shows as a kink in every line), so the large shapes
// use exact gradient noise. Its lattice hash is float-only (no integer
// multiplies, no trig), all four corners at once. The finest octave is
// small enough on screen to come from the prelude's noise texture, read
// with a cubic B-spline (still smooth; the filter's sub-texel steps are
// far below a pixel at that scale).

// One random number in [0, 1) for each corner of the cell at i.
vec4 corners(vec2 i) {
  vec2 a = fract((i.x + vec2(0.0, 1.0)) * 0.1031);
  vec2 b = fract((i.y + vec2(0.0, 1.0)) * 0.1137);
  vec4 c = (a * 17.31 + 5.0).xyxy + b.xxyy * (a * 31.1 + 13.73).xyxy;
  return fract(c * c * 1.371);
}

// Blends the corners' ramps; gradients (gx, gy) lie in -0.5..0.5.
float blend(vec2 f, vec4 gx, vec4 gy) {
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec4 d = gx * (f.x - vec4(0.0, 1.0, 0.0, 1.0)) + gy * (f.y - vec4(0.0, 0.0, 1.0, 1.0));
  vec2 m = mix(d.xz, d.yw, u.x);
  return mix(m.x, m.y, u.y);
}

// Gradient noise, scaled to the spread of the prelude's (about +-0.7).
float landNoise(vec2 p) {
  vec2 i = floor(p);
  vec4 s = corners(i);
  return 2.35 * blend(p - i, s - 0.5, fract(s * 91.7) - 0.5);
}

// Two independent noises from one set of corner hashes, for the warp.
vec2 landNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec4 s = corners(i);
  return 2.35 * vec2(blend(f, s - 0.5, fract(s * 91.7) - 0.5),
                     blend(f, fract(s * 53.3) - 0.5, fract(s * 17.9) - 0.5));
}

// The prelude's noise texture (16 texels per cell, 512 texels, origin 16
// cells) read with a cubic B-spline from four bilinear fetches.
float textureNoiseSmooth(vec2 p) {
  vec2 x = (p + 16.0) * 16.0 - 0.5;
  vec2 i = floor(x);
  vec2 f = x - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1;
  vec2 g1 = 1.0 - g0;
  vec2 c0 = (i - 0.5 + w1 / g0) * (1.0 / 512.0);
  vec2 c1 = (i + 1.5 + w3 / g1) * (1.0 / 512.0);
  return g0.y * (g0.x * texture(uNoise, c0).r + g1.x * texture(uNoise, vec2(c1.x, c0.y)).r)
       + g1.y * (g0.x * texture(uNoise, vec2(c0.x, c1.y)).r + g1.x * texture(uNoise, c1).r);
}

float terrain(vec2 p, float t) {
  vec2 a = p * 1.1 + vec2(0.05 * t, -0.03 * t);
  vec2 b = p * 1.4 + vec2(-0.04 * t, 0.025 * t) + 7.0;
  a += 0.4 * landNoise2(b);
  return 0.7 * landNoise(a) + 0.32 * landNoise(a * 2.1 + 1.7)
       + 0.1 * textureNoiseSmooth(a * 4.3 + 5.1);
}

vec3 scene(vec2 uv, float t) {
  float h = terrain(uv, t);
  // Paper, tinted cool in the valleys and warm on the heights.
  vec3 col = uColors[0];
  col = mix(col, uColors[1], 0.55 * smoothstep(0.0, -0.4, h));
  col = mix(col, uColors[3], 0.35 * smoothstep(0.05, 0.45, h));
  // Relief: slopes facing the light from the upper left a touch lighter,
  // the far side a touch darker, as on a well-made survey map.
  vec2 dh = vec2(dFdx(h), dFdy(h));
  float relief = clamp(dot(dh * uResolution.y, vec2(0.6, -0.8)) * 0.06, -0.06, 0.06);
  col *= 1.0 - relief;

  // Lines along whole values of f, sized in pixels (scaled with density so
  // they look the same on any screen); one derivative serves both kinds.
  float px = max(uResolution.y / 900.0, 1.0);
  float f = h * 15.0;
  float w = max(15.0 * (abs(dh.x) + abs(dh.y)), 1e-5);
  float dMinor = abs(fract(f + 0.5) - 0.5) / w;
  float dIndex = abs(fract(f * 0.2 + 0.5) - 0.5) * 5.0 / w;
  float minor = 1.0 - smoothstep(0.5 * px - 0.5, 0.5 * px + 0.5, dMinor);
  float index = 1.0 - smoothstep(1.1 * px - 0.5, 1.1 * px + 0.5, dIndex);
  float ink = max(minor * 0.42, index * 0.78);
  col = mix(col, uColors[2], ink);
  // A little paper grain.
  col *= 0.985 + 0.03 * noiseFast(uv * 260.0);
  return col;
}
`,
};

const clouds: Scene = {
  id: 'clouds',
  name: 'Clouds',
  colors: ['#08507a', '#8fc0da', '#7685b0', '#e2e6ef'],
  base: '#b9c2d6',
  speed: 0.35,
  resolution: 0.33,
  fragment: /* glsl */ `
// Clouds: skimming over a sea of soft cumulus under a clear sky.
// The deck is a stack of camera-facing slices (volumetric billboards)
// that drift toward the viewer and recycle at the back. Each slice is a
// 2D noise field minus a height ramp, so its iso-contour makes round,
// bumpy puff tops; near slices are big and blurry, far ones small and
// crisp. Light falls from above: a slice is bright where it thins out
// just above (one extra fetch), and lower and thinner parts show the
// periwinkle shade. Composited front to back with an early exit.

const float HZ = 0.19;    // horizon height on screen
const int N = 9;          // slices
const float DZ = 0.42;    // slice spacing (world units)
const float FREQ = 2.4;   // noise cells per world unit
const float WRAP = 32.0;  // noise texture period, in cells

vec3 scene(vec2 uv, float t) {
  float ry = uv.y - HZ;
  vec3 haze = mix(uColors[3], uColors[1], 0.12);

  float g = clamp(ry / 0.33, 0.0, 1.0);
  vec3 bg = ry > 0.0
    ? mix(uColors[1], uColors[0], pow(g, 0.6))
    : mix(haze, uColors[2], clamp(-ry * 1.6, 0.0, 1.0));
  float camZ = 0.25 * t / DZ;               // in slices
  if (ry > 0.0) {
    // Faint high wisps: a soft layer far above, seen in perspective.
    vec2 w = vec2(uv.x, 1.0) / (ry + 0.3);
    w.y += mod(camZ * 0.15, WRAP);
    float m = noiseFast(w * 1.4 + vec2(5.0, 0.0))
      + 0.5 * noiseFast(w * 3.1 + vec2(mod(0.03 * t, WRAP), 9.0));
    bg = mix(bg, haze, smoothstep(0.05, 0.65, m) * 0.18 * smoothstep(0.02, 0.15, ry));
    // The distant deck's bumpy edge, where no slice reaches.
    if (ry < 0.03) {
      float edge = 0.014 * (noiseFast(vec2(uv.x * 9.0 + mod(0.009 * t, WRAP), 17.0)) + 0.55);
      bg = mix(bg, mix(haze, uColors[2], 0.15), smoothstep(edge + 0.004, edge - 0.004, ry));
    }
  }
  bg = mix(bg, haze, exp(-abs(ry) * 45.0) * 0.55);

  float base = floor(camZ);
  float frac = camZ - base;
  float camX = mod(0.09 * t, WRAP);         // in noise cells
  vec2 evolve = mod(vec2(0.05, 0.07) * t, WRAP);
  float far = float(N) * DZ;

  vec3 col = vec3(0.0);
  float T = 1.0;
  for (int k = 0; k < N; k++) {
    float fk = float(k);
    float z = (fk + 1.0 - frac) * DZ;
    float wy = ry * z;                       // world height (camera at 0)
    float ramp = (-0.03 - wy) * 2.2 - max(wy, 0.0) * (2.0 + 3.0 / z);
    if (ramp < -1.1) continue;               // no cloud this high
    float idx = mod(base + fk + 1.0, 64.0);
    vec2 q = vec2(uv.x * z, wy) * FREQ + vec2(camX, 0.0) + idx * vec2(7.31, 3.77);
    float n = noiseFast(q) + 0.5 * noiseFast(q * 2.1 + vec2(0.0, evolve.x));
    if (n + ramp < -0.3) continue;           // the fine octave can't reach
    n += (0.14 + 0.14 * smoothstep(1.2, 3.0, z)) * noiseFast(q * 4.3 - vec2(evolve.y, 0.0));
    float D = n + ramp;
    if (D <= 0.0) continue;
    float fade = smoothstep(0.0, 0.5, z) * smoothstep(far, far - 1.2, z);
    float a = (1.0 - exp(-D * 4.0)) * fade;
    float up = noiseFast(q + vec2(0.0, 0.25));
    float sun = clamp((n - up) * 1.8 + 0.5, 0.0, 1.0);
    float lit = sun * (0.15 + 0.85 * smoothstep(-0.5, 0.0, wy)) * smoothstep(-0.45, 0.35, n);
    vec3 c = mix(uColors[2], uColors[3], 0.12 + 0.88 * lit);
    c = mix(c, haze, (1.0 - exp(-z * 0.35)) * 0.7);
    col += T * a * c;
    T *= 1.0 - a;
    if (T < 0.02) break;
  }
  return col + T * bg;
}
`,
};

const topology: Scene = {
  id: 'topology',
  name: 'Topology',
  colors: ['#002222', '#89964e', '#c9d48a', '#5c7a4c'],
  base: '#002222',
  speed: 0.15,
  resolution: 1,
  fragment: /* glsl */ `
// Topology: fine silk threads streaming along a slowly drifting flow.
// Threads are level lines of a smooth stream function, so they follow the
// flow and never cross within a layer. A monotonic warp across the flow
// bunches them into bright bundles with dark gaps between. Two layers at
// slightly different angles read as loose fibres laid over each other.

float stream(vec2 p, float t) {
  vec2 q = p * vec2(0.38, 0.9);
  float w = 1.3 * noise(q * 0.6 + vec2(0.04 * t, 3.7));
  float n1 = noise(q + vec2(-0.1 * t, 0.02 * t) + w);
  return p.y + 0.42 * n1;
}

// The prelude's gradient noise with its analytic gradient: (value, d/dx, d/dy).
vec3 noiseGrad(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = gradient(i);
  vec2 gb = gradient(i + ivec2(1, 0));
  vec2 gc = gradient(i + ivec2(0, 1));
  vec2 gd = gradient(i + ivec2(1, 1));
  float a = dot(ga, f);
  float b = dot(gb, f - vec2(1.0, 0.0));
  float c = dot(gc, f - vec2(0.0, 1.0));
  float d = dot(gd, f - vec2(1.0, 1.0));
  float k3 = a - b - c + d;
  vec2 g = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
         + du * vec2(b - a + k3 * u.y, c - a + k3 * u.x);
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k3 * u.x * u.y, g);
}

// Threads crowd where this warp is steep and part where it is flat. The
// noise is sampled rotated against its lattice, so bundles are unevenly
// spaced, and drifts along the flow. Returns (warped s, crowding).
vec2 bunch(float s, float k, float x, float t, float o) {
  float u = s * k + o;
  vec3 n = noiseGrad(vec2(0.8 * u + 0.2 * x - 0.05 * t, 0.6 * u - 0.25 * x + 0.04 * t));
  return vec2(s + (0.7 / k) * n.x, 1.0 + 0.7 * dot(n.yz, vec2(0.8, 0.6)));
}

// Hairlines on the integers of b.x * n. Each thread has its own brightness,
// which shimmers slowly along it; crowded threads glow more, and threads
// closer than ~2 px fade to their mean to avoid moire.
float strands(vec2 b, float n, float gs, float px, float x, float t, float seed) {
  float f = b.x * n;
  float crowd = max(b.y, 0.05);
  float w = gs * n * crowd;  // threads per pixel across the flow
  float id = floor(f + 0.5);
  float h = fract(id * 0.6180339 + seed);
  float h2 = fract(id * 0.7548777 + seed);
  float level = (0.25 + 0.75 * h) * crowd * crowd;
  level *= 0.65 + 0.35 * sin(x * (1.5 + 3.0 * h2) - t * (0.4 + 0.4 * h) + 6.2832 * h2);
  float d = abs(f - id) / w;
  float line = clamp(px * 0.55 + 0.5 - d, 0.0, 1.0);
  return mix(line, 0.7 * px * w, smoothstep(0.3, 0.6, w)) * level;
}

vec3 scene(vec2 uv, float t) {
  float s = stream(uv, t);
  float gs = length(vec2(dFdx(s), dFdy(s)));  // smooth: varies over many pixels
  float px = max(uResolution.y / 900.0, 1.0);
  float a = strands(bunch(s, 14.0, uv.x, t, 0.0), 220.0, gs, px, uv.x, t, 0.0);
  float b = strands(bunch(s + 0.013, 9.0, uv.x, t, 17.0), 150.0, gs, px, uv.x, t, 0.37);
  // The far layer in a cooler, dimmer thread; where both crowd, a pale glow.
  vec3 col = mix(uColors[0], uColors[3], clamp(b, 0.0, 1.0));
  col = mix(col, uColors[1], clamp(a, 0.0, 1.0));
  col += uColors[2] * max(a + 0.6 * b - 0.9, 0.0) * 0.4;
  // A touch darker behind the clock and widgets.
  col *= 1.0 - 0.14 * exp(-dot(uv * vec2(1.4, 2.6), uv * vec2(1.4, 2.6)));
  return col;
}
`,
};

const canopy: Scene = {
  id: 'canopy',
  name: 'Canopy',
  colors: ['#141618', '#4b7059', '#72b866', '#e6f682'],
  base: '#141618',
  speed: 1,
  resolution: 1,
  fragment: /* glsl */ `
// Canopy: a conifer canopy drawn as a lattice of lit points, seen from a
// slow glide above it. Points sit on fixed screen columns (so a crown is
// always a few points wide) and on world depth rows that drift towards the
// viewer. Per pixel: a short march on the hills finds where the view ray
// meets the canopy; then the depth rows from there are tested front to
// back, one point each.

const float CAM_Y = 1.0;      // camera height above the ground
const float HORIZON = 0.2;    // horizon height in uv
const float DZ = 0.03;        // depth spacing of lattice rows
const float DOT_GAP = 0.0095; // screen spacing of point columns (uv)
const float ROW_GAP = 0.019;  // target screen spacing of rows (uv)
const float CROWN_H = 0.03;   // crown height scale
const float CROWN_W = 4.5;    // crown width in columns
const float SHELL = 0.015;    // how far below the surface the ray may see
const float STACK_DY = 0.011; // world spacing of points in a near stack

float hills(vec2 p) {
  return 0.15 + 0.14 * noiseFast(p * vec2(0.45, 0.35) + vec2(3.1, 7.7));
}

// Crowns live in lattice space: a crown is always a few columns wide on
// screen and about as tall as a row gap, near or far.
float crownAmp(float zc) {
  return CROWN_H * pow(zc, 0.75);
}

vec3 scene(vec2 uv, float t) {
  vec3 bg = uColors[0];
  float px = 1.0 / uResolution.y;
  float d = HORIZON - uv.y;
  vec3 sky = bg * (1.0 + 0.2 * exp(-abs(d) * 9.0));
  if (d < 0.004) return sky;

  // Points live on fixed screen columns.
  float sx = (floor(uv.x / DOT_GAP) + 0.5) * DOT_GAP;
  float ex = uv.x - sx;
  float rMax = DOT_GAP * 0.3;
  if (abs(ex) > 1.2 * rMax + px) return sky;

  float camZ = t * 0.07;
  float camX = sin(t * 0.021) * 1.6;
  float camRow = camZ / DZ;

  // March on the hills alone (plus the crowns' headroom) to bracket where
  // the ray enters the canopy: three coarse steps, then four halvings.
  float zA = (CAM_Y - 0.4) / d;
  float zB = min(CAM_Y / d, 60.0);
  float span = (zB - zA) / 3.0;
  float zs = zA;
  float hLo = hills(vec2(sx * zA + camX, zA + camZ));
  float hHi = hLo;
  for (int i = 0; i < 3; i++) {
    float zn = zs + span;
    hHi = hills(vec2(sx * zn + camX, zn + camZ));
    if (CAM_Y - d * zn < hHi + 0.6 * crownAmp(zn)) break;
    zs = zn;
    hLo = hHi;
  }
  for (int i = 0; i < 4; i++) {
    span *= 0.5;
    float zn = zs + span;
    float hn = hills(vec2(sx * zn + camX, zn + camZ));
    if (CAM_Y - d * zn >= hn + 0.6 * crownAmp(zn)) {
      zs = zn;
      hLo = hn;
    } else {
      hHi = hn;
    }
  }
  // The hills change slowly: over the few rows walked below, a straight
  // line through the bracket is close enough and saves a fetch per row.
  float hSlope = (hHi - hLo) / span;

  // Light coming through: slow drifting patches over the canopy, looked up
  // once per pixel at a depth set by the screen height (smooth, so a point
  // is lit evenly). The middle, behind the clock, stays calmer.
  float zl = (CAM_Y - 0.2) / d;
  vec2 pl = vec2(sx * zl + camX, zl + camZ);
  float light = noiseFast(pl * vec2(1.3, 0.9) + vec2(t * 0.06, -t * 0.035));
  light = smoothstep(0.0, 0.42, light);
  light *= 0.3 + 0.7 * smoothstep(0.05, 0.45, length(uv * vec2(0.75, 1.6)));
  light *= 0.6 + 0.4 * smoothstep(1.3, 2.6, zl);  // patches at the camera are huge
  // Distant points cool slightly towards blue-grey.
  vec3 dim = mix(uColors[1], uColors[1].rbg, 0.5 * smoothstep(3.0, 14.0, zl));
  vec3 tint = mix(dim, uColors[2], smoothstep(0.0, 0.5, light));
  tint = mix(tint, uColors[3], smoothstep(0.4, 1.0, light));
  tint *= 0.8 + 0.5 * light;
  float rLight = 0.85 + 0.35 * light;

  // Row stride keeps rows about one row gap apart on screen; rows about to
  // be dropped fade out first. It depends on the screen height only, so it
  // is continuous across the picture.
  float zm = (CAM_Y - 0.15) / d;
  float lod = log2(max(ROW_GAP * zm * zm / (CAM_Y * DZ), 1.0));
  float stride = exp2(floor(lod));
  float fadeOdd = 1.0 - fract(lod);
  // Rows are counted in floats: an int row counter stepped in the loop
  // header made this loop several times slower under ANGLE.
  float j0 = ceil((zs / DZ + camRow) / stride) - 1.0;

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  // One row of lag: a row is drawn once the next row's height is known,
  // so points on slopes seen edge-on (rows crowding together on screen)
  // fade instead of piling up into bars.
  float prevSy = -1.0, prevZ = 1.0, prevW = 0.0;
  for (int n = 0; n < 12; n++) {
    float jj = j0 + float(n);  // row index in units of the stride
    float zc = (jj * stride - camRow) * DZ;
    float cx = (sx + camX / zc) / (DOT_GAP * CROWN_W);
    float crown = crownAmp(zc) * noiseFast(vec2(cx, jj * stride * DZ * 4.0) + vec2(11.0, 2.0));
    float h = hLo + hSlope * (zc - zs) + crown;
    float sy = HORIZON - (CAM_Y - h) / zc;
    bool hidden = CAM_Y - d * zc < h - SHELL || zc > zB;
    if (n > 0) {
      float gap = hidden ? ROW_GAP : sy - prevSy;
      // Near rows hang a short stack of points under each crown top.
      float stackY = STACK_DY / prevZ;
      float nLev = 1.0 + floor(2.0 * (1.0 - smoothstep(1.6, 3.2, prevZ)) + 0.5);
      float k = clamp(floor((prevSy - uv.y) / stackY + 0.5), 0.0, nLev - 1.0);
      float dist = length(vec2(ex, uv.y - (prevSy - k * stackY)));
      float r = rMax * clamp(pow(1.4 / prevZ, 0.4), 0.35, 1.0) * rLight * (1.0 - 0.18 * k);
      float rr = max(r, 0.7 * px);
      float cover = smoothstep(rr + 0.6 * px, rr - 0.6 * px, dist);
      cover *= (r * r) / (rr * rr) * prevW * smoothstep(0.9, 2.1, gap / r);
      vec3 c = mix(bg, tint * (1.0 - 0.25 * k), exp(-prevZ * 0.05));
      col += (1.0 - alpha) * cover * c;
      alpha += (1.0 - alpha) * cover;
    }
    if (hidden) break;
    prevSy = sy;
    prevZ = zc;
    prevW = fract(jj * 0.5) > 0.25 ? fadeOdd : 1.0;
  }
  return sky * (1.0 - alpha) + col;
}
`,
};

const convergence: Scene = {
  id: 'convergence',
  name: 'Convergence',
  colors: ['#020104', '#2030ff', '#d070ff', '#d43408'],
  base: '#050309',
  speed: 1.4,
  resolution: 0.35,
  fragment: /* glsl */ `
// Convergence: three soft streams of light cross the screen in a rotated,
// slowly flowing field. Each stream is split like light through a prism
// edge: blue leading, magenta where they overlap, ember trailing.
vec3 scene(vec2 uv, float t) {
  // Rotate so streams climb from bottom-left to top-right (~33 deg).
  const vec2 R = vec2(0.839, 0.545);
  vec2 p = vec2(R.x * uv.x + R.y * uv.y, R.x * uv.y - R.y * uv.x);

  // Wave field: one main S-curve plus a slower swell that also depends on
  // p.y, so each stream bends a little differently and the field breathes.
  const float k = 5.6;
  float ph = k * p.x + 0.21 * t;
  float a1 = 0.085 + 0.018 * sin(0.09 * t + 1.6 * p.y);
  float ph2 = 2.3 * p.x - 1.7 * p.y - 0.12 * t;
  float w = a1 * sin(ph) + 0.035 * sin(ph2);
  float dw = a1 * k * cos(ph) + 0.08 * cos(ph2);

  // Signed distance across the nearest stream, in screen units. The
  // streams drift downward; whole steps of the drift are kept apart so v
  // stays small and exact on long-lived tabs.
  const float S = 0.52; // spacing between streams
  float drift = 0.03 / S * t;
  float steps = floor(drift);
  float v = p.y - w + (drift - steps) * S;
  float cell = floor(v / S + 0.5);
  float d = (v - cell * S) * inversesqrt(1.0 + dw * dw);
  cell += steps; // stable id per stream, for its brightness

  // Prism split: the same soft-shouldered stream, shifted up for the blue
  // copy and down for the ember copy; they overlap as magenta in the core.
  vec2 e = vec2(d - 0.022, d + 0.02) * 17.0;
  e *= e;
  vec2 lobe = exp(-e * e); // flat-topped: x = blue, y = ember
  float halo = exp(-d * d * 60.0);

  // Brightness drifts along each stream; the centre stays calmer for the
  // clock.
  float along = 0.72 + 0.28 * sin(1.2 * p.x - 0.15 * t + 2.3 * cell);
  float calm = 0.62 + 0.38 * smoothstep(0.05, 0.5, length(uv * vec2(0.75, 1.0)));
  float g = along * calm;

  vec3 col = uColors[0] + uColors[1] * halo * 0.06 * calm;
  // Where the copies overlap the light runs hot, towards pink-white.
  float hot = lobe.x * lobe.y;
  col += (uColors[1] * lobe.x + uColors[3] * lobe.y + uColors[2] * hot * 0.15) * g;
  return col;
}
`,
};

const ribbons: Scene = {
  id: 'ribbons',
  name: 'Ribbons',
  colors: ['#0b1622', '#24588f', '#3aae9f', '#e9876b'],
  base: '#0b1622',
  speed: 0.25,
  resolution: 0.75,
  fragment: /* glsl */ `
// Ribbons: flat translucent vector ribbons that twist and drift across a
// deep field, over a bundle of fine dashed strands. Analytic curves (sums
// of sines with exact slopes), edges anti-aliased in pixels. No noise, no
// textures.

const int RIBBONS = 7;

vec3 scene(vec2 uv, float t) {
  float px = 1.0 / uResolution.y;
  // Field: the base, lifted toward a soft glow left of centre, darker edges.
  vec2 q = uv - vec2(-0.15, -0.05);
  float glow = exp(-2.2 * dot(q, q));
  vec3 col = uColors[0] * (0.75 + 0.45 * glow) + uColors[1] * 0.07 * glow;

  // Strand bundle: parallel hairlines around one curve whose spacing swells
  // and pinches along x; one curve evaluation draws every line.
  {
    float x = uv.x;
    float a = 0.33 * t;
    float g = -0.23 + 0.2 * x + 0.07 * sin(2.1 * x + a) + 0.03 * sin(4.7 * x - 1.4 * a + 1.7);
    float sp = 0.011 * (1.0 + 0.5 * sin(2.9 * x + 0.8 * a + 0.6));
    float v = (uv.y - g) / sp;
    if (abs(v) < 12.0) {
      float dg = 0.2 + 0.147 * cos(2.1 * x + a) + 0.141 * cos(4.7 * x - 1.4 * a + 1.7);
      float idx = floor(v + 0.5);
      float d = abs(v - idx) * sp * inversesqrt(1.0 + dg * dg);
      float line = 1.0 - smoothstep(0.3 * px, 1.3 * px, d);
      float env = 1.0 - smoothstep(3.0, 10.0, abs(idx + 2.0 * sin(1.3 * x + 0.5 * a)));
      float h = fract(idx * 0.618 + 0.3);
      // Dashes slide along; a third of the strands are solid.
      // Dash length and gap vary per strand: long dashes to fine dots.
      float h2 = fract(idx * 0.381 + 0.17);
      float f = 4.0 + 22.0 * h2 * h2;
      float gap = 0.25 + 0.4 * h2;
      float u = fract(x * f - a * (0.25 + 0.5 * h) + h * 7.0);
      // Anti-aliased dash ends, measured in pixels along x.
      float dash = h < 0.33 ? 1.0
        : clamp((0.5 - 0.5 * gap - abs(u - 0.5 - 0.5 * gap)) / (f * px) + 0.5, 0.0, 1.0);
      vec3 sc = h < 0.33 ? uColors[2] : h < 0.66 ? uColors[1] : uColors[3];
      col = mix(col, sc, line * env * dash * 0.6);
    }
  }

  // Ribbons, back to front.
  for (int i = 0; i < RIBBONS; i++) {
    float fi = float(i);
    float k1 = 1.3 + 0.29 * fi;
    float k2 = 3.1 - 0.23 * fi;
    float a1 = 0.13 + 0.05 * sin(fi * 2.1);
    float a2 = 0.035;
    float tilt = 0.22 * sin(fi * 1.7 + 0.5);
    float c = -0.07 + 0.11 * sin(fi * 2.4 + 0.9);
    // Cheap reject: rows this ribbon can never reach.
    if (abs(uv.y - c - tilt * uv.x) > a1 + a2 + 0.03) continue;
    float p1 = fi * 1.93 + t * (0.21 + 0.035 * fi);
    float p2 = fi * 4.11 - t * (0.15 + 0.03 * mod(fi, 3.0));
    float yc = c + tilt * uv.x + a1 * sin(k1 * uv.x + p1) + a2 * sin(k2 * uv.x + p2);
    float dy = tilt + a1 * k1 * cos(k1 * uv.x + p1) + a2 * k2 * cos(k2 * uv.x + p2);
    float d = abs(uv.y - yc) * inversesqrt(1.0 + dy * dy);
    // Twist: width follows |sin|; the face shown flips at the thin point.
    float tw = sin(2.2 * uv.x + fi * 2.4 + t * (0.19 + 0.02 * fi));
    float hw = (0.002 + 0.015 * abs(tw)) * (0.85 + 0.3 * sin(fi * 3.3));
    float m = 1.0 - smoothstep(hw - 0.6 * px, hw + 0.6 * px, d);
    if (m > 0.0) {
      // Colour flows slowly along each ribbon, blue to teal.
      float flow = 0.5 + 0.5 * sin(1.6 * uv.x - 0.35 * t + fi * 1.7);
      vec3 rc = i == 2 || i == 5 ? uColors[3] * (0.72 + 0.28 * flow)
        : mix(uColors[1], uColors[2], flow * flow);
      rc *= tw > 0.0 ? 1.0 : 0.78;
      col = mix(col, rc, m * 0.55);
    }
  }
  return col;
}
`,
};

const fringe: Scene = {
  id: 'fringe',
  name: 'Fringe',
  colors: ['#0a0a0c', '#ff2a10', '#1aff60', '#1040ff'],
  base: '#0a0a0c',
  speed: 1,
  resolution: 0.4,
  fragment: /* glsl */ `
// One glowing sine band whose colour channels part towards the edges of
// the screen, as a lens does. uColors: 0 background, 1/2/3 the three
// channels (outer-top, middle, outer-bottom); 1+2+3 should sum near white.
vec3 scene(vec2 uv, float t) {
  float x = uv.x;
  float x2 = x * x;
  // The band: a travelling sine on a gentle smile, swinging wider towards
  // the edges so its crests stay below the clock in the middle.
  float a1 = (0.085 + 0.012 * sin(t * 0.21)) * (1.0 + 0.9 * x2);
  float p1 = 2.1 * x + t * 0.23 - 1.57;
  float p2 = 4.3 * x - t * 0.17 + 1.3;
  float s1 = sin(p1), s2 = sin(p2);
  float f = -0.23 + 0.2 * x2 + a1 * s1 + 0.03 * s2;
  float fp = 0.4 * x + a1 * 2.1 * cos(p1) + 0.03 * 4.3 * cos(p2)
           + 0.153 * x * s1;
  float inv = inversesqrt(1.0 + fp * fp);

  // Chromatic aberration: the outer channels slide apart across the band,
  // little in the middle of the screen and more towards its edges, never
  // so far that the middle channel shows on its own.
  float r2 = dot(uv, uv);
  float e = 0.005 + 0.034 * r2 * (0.85 + 0.15 * sin(t * 0.37));
  vec3 d = (uv.y - f) * inv + vec3(-e, 0.0, e);
  vec3 d2 = d * d;

  // Soft core plus a wide halo.
  const float W = 0.03 * 0.03;
  vec3 core = W / (W + d2);
  core *= core;
  vec3 halo = 0.03 / (0.03 + abs(d) * 3.0);
  vec3 I = 2.6 * core + 0.65 * halo;

  vec3 light = I.x * uColors[1] + I.y * uColors[2] + I.z * uColors[3];
  vec3 col = 1.0 - exp(-light);
  vec3 bg = uColors[0] * (1.0 - 0.35 * r2);
  return bg + col * (1.0 - bg);
}
`,
};

const nightSky: Scene = {
  id: 'nightsky',
  name: 'Night Sky',
  colors: ['#070318', '#0a0912', '#58887a', '#8274a8'],
  base: '#08041a',
  speed: 0.25,
  resolution: 1,
  fragment: /* glsl */ `
// Night Sky: a deep sky with a soft, slowly drifting Milky Way, stars in
// four layers that twinkle, and now and then a shooting star.

// Three random numbers in 0..1 for a cell, float math only (weak GPUs are
// slow at integer hashing). Cells stay within a few thousand, where this
// shows no visible pattern.
vec3 rnd3(vec2 c) {
  vec3 p = fract(vec3(c.xyx) * vec3(0.1179, 0.1471, 0.1033));
  p += dot(p, p.yzx + 27.13);
  return fract(vec3(p.x + p.y, p.y + p.z, p.z + p.x) * p.zxy);
}

// Sine-like wave from two parabolas, period 1 (cheaper than sin).
float wave1(float p) {
  float q = fract(p) * 2.0 - 1.0;
  return 4.0 * q * (abs(q) - 1.0);
}

// One layer of stars: a cell of scale per unit of uv holds at most one
// star, a round point well inside the cell, so only the cell under the
// pixel matters. chance may vary across the sky (the Milky Way is
// denser); stars near the threshold fade instead of popping as it drifts.
// px is uv per pixel, size the star's radius in pixels.
float stars(vec2 uv, float scale, float chance, float size, float px,
            float twinkle, float t) {
  vec2 g = uv * scale;
  vec2 cell = floor(g);
  vec3 r = rnd3(cell);
  float there = clamp((chance - r.z) * 16.0, 0.0, 1.0);
  if (there <= 0.0) return 0.0;
  float k = fract(r.z * 71.3);             // 0..1, brightness and phase
  vec2 o = g - cell - 0.2 - 0.6 * r.xy;    // star sits in the middle 60%
  float d = length(o) / (scale * px);      // distance in pixels
  float s = size * (0.6 + 0.6 * k);
  float e = max(1.0 - d * d / (3.0 * s * s), 0.0);  // round, bell-like
  float tw = 1.0 - twinkle
    + twinkle * (0.5 + 0.5 * wave1(t * (0.25 + 0.35 * fract(k * 7.31)) + k * 13.7));
  return e * e * (0.25 + 0.75 * k * k) * tw * there;
}

// A shooting star in one lane: time is cut into slots of period; some
// slots hold a meteor that lives a fraction of it. Away from the centre.
float meteor(vec2 uv, float t, float period, float lane, float px) {
  float slot = floor(t / period);
  vec3 r = rnd3(vec2(slot, lane));
  if (r.z > 0.7) return 0.0;
  float life = 0.1;                        // fraction of the slot
  float age = (fract(t / period) - 0.3 * r.z) / life;
  if (age < 0.0 || age > 1.0) return 0.0;
  // Start in the upper sky or at the sides, heading down and outward.
  vec3 q = rnd3(vec2(lane, slot) + 17.0);
  vec2 start = vec2((q.x - 0.5) * 1.6, 0.05 + 0.4 * q.y);
  if (abs(start.x) < 0.3) start.y = 0.32 + 0.12 * q.y;
  float ang = -0.6 - 1.0 * q.z;             // radians, mostly downward
  vec2 dir = vec2(cos(ang), sin(ang));
  if (start.x < 0.0) dir.x = -dir.x;
  float len = 0.06 + 0.06 * r.x;
  vec2 head = start + dir * (0.2 + 0.15 * r.y) * age;
  vec2 rel = uv - head;
  float along = -dot(rel, dir);             // behind the head is positive
  if (along < -0.01 || along > len) return 0.0;
  float across = abs(dot(rel, vec2(-dir.y, dir.x))) / px;
  float tail = 1.0 - along / len;
  float fade = smoothstep(0.0, 0.15, age) * (1.0 - smoothstep(0.6, 1.0, age));
  return exp(-across * across / 0.7) * tail * tail * fade
    * smoothstep(-0.01, 0.0, along);
}

vec3 scene(vec2 uv, float t) {
  float px = 1.0 / uResolution.y;
  float tt = t * 4.0;

  // Sky: deep indigo, a touch lighter in the middle, darker at the corners.
  float v = dot(uv, uv);
  vec3 col = uColors[0] * (1.15 - 0.4 * v);

  // The Milky Way: a soft band rising to the right through the middle.
  const float C = 0.876, S = 0.482;        // cos, sin of ~28.8 degrees
  vec2 b = vec2(C * uv.x + S * uv.y, -S * uv.x + C * uv.y + 0.045);
  // A soft glow around the band, so its edges fade into the sky.
  col += uColors[1] * exp(-b.y * b.y * 12.0);
  float dens = 0.0;
  float s = 0.0;
  if (abs(b.y) < 0.62) {
    float w = 0.2 + 0.04 * noiseFast(vec2(b.x * 2.1, 3.1));
    float band = exp(-b.y * b.y / (w * w));
    // Two octaves of drifting cloud give it soft masses.
    vec2 q = vec2(b.x * 2.6 + 0.006 * tt, b.y * 4.5) + 9.0;
    float cloud = 0.62 * noiseFast(q) + 0.3 * noiseFast(OCTAVE * q + 3.7);
    dens = band * clamp(0.8 + 1.5 * cloud, 0.0, 1.4);
    // Violet in the middle of the sky, grey-teal towards the ends.
    float mid = exp(-b.x * b.x * 5.0);
    vec3 tint = mix(uColors[2], uColors[3], smoothstep(0.15, 0.85, mid + 0.25 * cloud));
    col += tint * dens * 0.34;
    // Dust: countless faint stars that only live in the band.
    if (dens > 0.02) s = stars(uv, 420.0, 0.5 * dens, 0.55, px, 0.0, tt) * 0.5 * dens;
  }

  // Stars, from faint to a few bright ones.
  s += stars(uv, 190.0, 0.18 + 0.25 * dens, 0.6, px, 0.5, tt) * 0.55;
  s += stars(uv, 75.0, 0.22, 0.75, px, 0.7, tt) * 0.9;
  s += stars(uv, 26.0, 0.16, 0.95, px, 0.6, tt) * 1.4;
  vec3 starTint = vec3(0.9, 0.93, 1.0);
  col += starTint * s;

  float m = meteor(uv, tt, 7.0, 1.0, px) + meteor(uv, tt + 3.1, 11.0, 2.0, px);
  col += vec3(0.85, 0.9, 1.0) * m;
  return col;
}
`,
};

const matrix: Scene = {
  id: 'matrix',
  name: 'Matrix',
  colors: ['#010805', '#0a4d22', '#2ee86f', '#dcffe8'],
  base: '#020a06',
  speed: 1,
  resolution: 1,
  fragment: /* glsl */ `
// Matrix: digital rain in three depth layers. Each pixel looks up one cell
// per layer: the cell's column decides its falling drops (analytic trails,
// no feedback), and the cell's glyph is drawn from strokes on a 2x3
// lattice chosen by a hash (horizontals, verticals, a few diagonals), so it
// reads as an invented script of katakana-like signs.

uint mixBits(uint x) {
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}

float bitOn(uint m, int i) {
  return float((m >> uint(i)) & 1u);
}

// Distance in pixels from q to the segment a-b.
float segment(vec2 q, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(q - a - ab * h);
}

// Ink of a glyph at g (0..1 inside the glyph box, y down), box size in px.
float glyph(vec2 g, vec2 size, uint h, float halfW) {
  uint h2 = mixBits(h);
  uint h3 = mixBits(h2);
  uint hv = h & (h2 | h3 | mixBits(h ^ h3)); // ~44% of strokes on
  uint hd = h2 & h3 & mixBits(h3); // 12.5% of diagonals on

  vec2 c = clamp(g, 0.0, 1.0);
  vec2 out_ = (g - c) * size; // outside the box, distance grows

  // Nearest horizontal stroke: rows at y = 0, 1/3, 2/3, 1; two halves.
  float r = floor(c.y * 3.0 + 0.5);
  int hc = int(min(floor(c.x * 2.0), 1.0));
  float dH = length(vec2(out_.x, (g.y - r / 3.0) * size.y));
  float onH = bitOn(hv, int(r) * 2 + hc);

  // Nearest vertical stroke: columns at x = 0, 1/2, 1; three spans.
  float k = floor(c.x * 2.0 + 0.5);
  int vs = int(min(floor(c.y * 3.0), 2.0));
  float dV = length(vec2((g.x - k * 0.5) * size.x, out_.y));
  float onV = bitOn(hv, 8 + int(k) * 3 + vs);

  // One diagonal per box, either way.
  int bx = hc;
  int by = vs;
  int bi = bx * 3 + by;
  vec2 box = size / vec2(2.0, 3.0);
  vec2 q = (g - vec2(float(bx) * 0.5, float(by) / 3.0)) * size;
  float flip = bitOn(h3, bi);
  vec2 a = vec2(box.x * flip, 0.0);
  vec2 b = vec2(box.x * (1.0 - flip), box.y);
  float dD = segment(q, a, b);
  float onD = bitOn(hd, 17 + bi);

  float d = min(min(mix(1e3, dH, onH), mix(1e3, dV, onV)), mix(1e3, dD, onD));
  return clamp(halfW + 0.5 - d, 0.0, 1.0);
}

// One layer of rain. n: cells per screen height. Returns its color.
vec3 rain(vec2 uv, float t, float n, float seed, float speedScale, float halfW, uint gap) {
  float cellAspect = 0.62;
  vec2 p = vec2(uv.x / cellAspect, -uv.y) * n + vec2(seed * 37.0, 0.0);
  vec2 cell = floor(p);
  vec2 f = p - cell;
  float px = uResolution.y / n; // cell height in pixels

  uint ch = hash(uvec2(ivec2(int(cell.x), int(seed * 101.0))));
  // Integer speed in eighths of a cell per second, integer track length:
  // the head position is exact at any clock value.
  uint sp = 20u + (ch & 63u); // 2.5..10.4 cells/s, before speedScale
  uint track = gap + ((ch >> 6u) & 127u); // cells between drops
  float trail = 8.0 + float((ch >> 12u) & 31u) * 0.75; // trail length
  float v = float(sp) / 8.0 * speedScale;
  float L = float(track);
  // speedScale is k/8 with k small, so this stays integer.
  uint num = sp * uint(speedScale * 8.0 + 0.5); // speed in 64ths
  uint ti = uint(max(t, 0.0));
  float head = float((ti * num + (ch >> 18u)) % (64u * track)) / 64.0
    + fract(t) * v;

  float row = cell.y + n * 0.5; // 0 at the top of the screen
  float d = mod(head - row, L); // cells behind the head
  // A second, shorter drop half a track behind in some columns.
  float d2 = mod(head - row + L * 0.5, L);
  float b1 = d < trail ? 1.0 - d / trail : 0.0;
  float b2 = ((ch >> 24u) & 1u) == 1u && d2 < trail * 0.6 ? 1.0 - d2 / (trail * 0.6) : 0.0;
  float bright = max(b1, b2);
  float headOn = max(step(d, 1.0) * step(0.0, d), step(d2, 1.0) * (b2 > 0.0 ? 1.0 : 0.0));
  if (bright <= 0.0) return vec3(0.0);

  // Glyph change: most cells hold a sign for seconds, some flicker.
  uint cid = uint(int(cell.x) * 977 + int(cell.y) * 131 + int(seed * 7.0));
  float cr = float(mixBits(cid) & 255u) / 255.0;
  float rate = 0.25 + 3.5 * cr * cr * cr;
  uint gi = uint(floor(t * rate + cr * 13.0));
  uint gh = hash(uvec2(cid, gi));

  vec2 g = (f - vec2(0.17, 0.13)) / vec2(0.66, 0.74);
  vec2 size = vec2(0.66 * cellAspect, 0.74) * px;
  float ink = glyph(g, size, gh, halfW);
  // A faint glow filling the cell, so trails read as light, not print.
  // A soft band along the column (no cell edges), so trails read as light.
  float band = 1.0 - abs(f.x - 0.5) * 2.0;
  float glow = 0.09 * band * band;
  // Trails run from bright green at the head to deep green at the tail.
  // The few cells right behind the head are still hot, toward white.
  vec3 trailCol = mix(uColors[1], uColors[2], bright) * (bright * bright)
    + uColors[3] * (0.3 * smoothstep(0.82, 1.0, bright));
  vec3 c = trailCol * (ink + glow);
  vec3 h = uColors[3] * ink * 1.1 + uColors[2] * glow * 3.0;
  return mix(c, h, headOn);
}

vec3 scene(vec2 uv, float t) {
  vec3 col = uColors[0] * (1.0 - 0.4 * dot(uv, uv));

  // Calm the middle a little, behind the clock and widgets.
  float centre = 1.0 - 0.5 * exp(-(uv.x * uv.x * 2.2 + uv.y * uv.y * 5.0));

  vec3 far = rain(uv, t, 78.0, 3.0, 0.5, 0.45, 60u);
  vec3 mid = rain(uv, t, 52.0, 1.0, 0.75, 0.6, 40u);
  vec3 near = rain(uv, t, 34.0, 2.0, 1.0, 0.8, 30u);
  col += (far * 0.45 + mid * 0.7 + near) * centre;
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
  comet,
  lumen,
  contour,
  clouds,
  topology,
  canopy,
  convergence,
  ribbons,
  fringe,
  nightSky,
  matrix,
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
