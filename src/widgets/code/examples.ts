/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import type {MessageKey} from '../../i18n';
import type {WidgetSize} from '../../layout/bands';

/**
 * Custom widgets to start from, on the panel's Custom widgets page.
 * They share one fixed palette (blue, red, yellow, green, owner
 * 2026-10-14: the wallpaper's colors turned them green and orange), so
 * they look the same on every wallpaper; `uColors` stays for people's own.
 * Original code (AGENTS.md, "Ownership"), short and commented: each one
 * shows off one idea and reads in a minute. Six, the owner's number
 * (2026-10-14); "Start from scratch" is `BLANK_CODE`, not an example.
 */
export interface CodeExample {
  readonly id: string;
  readonly name: MessageKey;
  /** The size it is added at. */
  readonly size: WidgetSize;
  readonly code: string;
}

export const CODE_EXAMPLES: readonly CodeExample[] = [
  {
    id: 'equalizer',
    name: 'code.example.equalizer',
    size: 'm',
    code: `// A spectrum dancing to music only it can hear,
// mirrored on a glassy floor.
const vec3 BLUE = vec3(0.26, 0.52, 0.96);
const vec3 RED = vec3(0.92, 0.26, 0.21);
const vec3 YELLOW = vec3(0.98, 0.74, 0.02);
const vec3 GREEN = vec3(0.2, 0.66, 0.33);
// Blue, red, yellow, green, round and round; x picks a place on the way.
vec3 four(float x) {
  vec3 c[4] = vec3[4](BLUE, RED, YELLOW, GREEN);
  float i = floor(mod(x, 4.0));
  return mix(c[int(i)], c[int(mod(i + 1.0, 4.0))], smoothstep(0.35, 0.65, fract(x)));
}

vec4 widget(vec2 uv, float t) {
  float wide = uResolution.x / uResolution.y;
  float bars = 24.0;
  float x = (uv.x / wide + 0.46) / 0.92;   // 0..1 across, with margins
  float i = floor(x * bars);
  float k = i / bars;
  // Low notes on the left: slower and taller.
  float level = noise(vec2(i * 0.9, t * (1.4 + k * 2.6)));
  float h = 0.06 + 0.42 * level * (1.15 - 0.6 * k);

  float y = uv.y + 0.22;                    // the floor
  float width = 0.92 * wide / bars;
  vec2 p = vec2((fract(x * bars) - 0.5) * width, abs(y));
  float d = length(vec2(p.x, p.y - clamp(p.y, 0.0, h))) - width * 0.26;
  float inside = step(0.0, x) * step(x, 1.0);

  float bar = smoothstep(1.5 / uResolution.y, 0.0, d);
  float glow = 0.004 / max(d, 0.004) * 0.35;
  float mirror = y < 0.0 ? 0.28 * smoothstep(0.22, 0.0, -y) : 1.0;
  float a = clamp((bar + glow) * mirror * inside, 0.0, 1.0);
  vec3 color = four(x * 3.0); // all four colors, left to right
  return vec4(color * a, a);
}
`,
  },
  {
    id: 'aurora',
    name: 'code.example.aurora',
    size: 'l',
    code: `// Northern lights: three curtains swaying over a few stars.
const vec3 BLUE = vec3(0.26, 0.52, 0.96);
const vec3 RED = vec3(0.92, 0.26, 0.21);
const vec3 YELLOW = vec3(0.98, 0.74, 0.02);
const vec3 GREEN = vec3(0.2, 0.66, 0.33);

vec4 widget(vec2 uv, float t) {
  vec3 tints[3] = vec3[3](GREEN, BLUE, RED);
  vec3 color = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    float x = uv.x * (1.2 + 0.3 * k) + k * 3.1;
    // Each curtain hangs from a wavy line and folds as it sways.
    float edge = -0.22 + 0.13 * k
      + 0.07 * sin(x * 2.4 + t * 0.3 + k)
      + 0.06 * (fbm(vec2(x * 1.2, t * 0.1 + k)) - 0.5);
    float d = uv.y - edge;
    // Bright at the lower edge, fading upward in vertical rays.
    float rays = 0.35 + 0.65 * pow(noise(vec2(x * 18.0, t * 0.2 + k * 7.0)), 1.5);
    float c = (d > 0.0 ? exp(-d * (7.0 + 2.0 * k)) : exp(d * 45.0)) * rays;
    c *= 0.7 - 0.12 * k;
    vec3 tint = tints[i];
    color += mix(tint, uInk, exp(-abs(d) * 50.0) * 0.35) * c;
    a += c;
  }
  // Stars that twinkle.
  vec2 cell = floor(uv * 48.0);
  float star = step(0.975, hash01(cell))
    * smoothstep(0.18, 0.0, length(fract(uv * 48.0) - 0.5))
    * (0.5 + 0.5 * sin(t * 2.0 + hash01(cell + 9.0) * 40.0));
  color += uInk * star * 0.8;
  a = clamp(a + star * 0.8, 0.0, 1.0);
  return vec4(min(color, vec3(a)), a);
}
`,
  },
  {
    id: 'synthwave',
    name: 'code.example.synthwave',
    size: 'm',
    code: `// A retro sun setting behind a grid that rolls toward you.
const vec3 BLUE = vec3(0.26, 0.52, 0.96);
const vec3 RED = vec3(0.92, 0.26, 0.21);
const vec3 YELLOW = vec3(0.98, 0.74, 0.02);
const vec3 GREEN = vec3(0.2, 0.66, 0.33);

vec4 widget(vec2 uv, float t) {
  float horizon = -0.1;
  vec4 c = vec4(0.0);

  // The sun, cut by bands that drift down and widen near the bottom.
  vec2 s = uv - vec2(0.0, horizon + 0.06);
  float sun = smoothstep(0.26, 0.255, length(s)) * step(horizon, uv.y);
  float band = fract(s.y * 24.0 + t * 0.5);
  float gap = clamp(0.08 + (0.14 - s.y) * 2.6, 0.0, 0.85);
  sun *= s.y > 0.14 ? 1.0 : step(gap, band);
  vec3 sunColor = mix(RED, YELLOW, clamp(s.y * 2.5 + 0.5, 0.0, 1.0));
  c += vec4(sunColor, 1.0) * sun;

  // The grid: lines in perspective, fading into the haze at the horizon.
  float below = horizon - uv.y;
  if (below > 0.0) {
    float depth = 0.2 / below;
    vec2 g = vec2(uv.x * depth * 5.0, depth + t * 0.9);
    vec2 w = fwidth(g) * 1.5;
    vec2 line = 1.0 - smoothstep(vec2(0.0), w, abs(fract(g + 0.5) - 0.5));
    float fade = smoothstep(0.0, 0.18, below);
    c = mix(c, vec4(BLUE, 1.0), line.x * fade * 0.85);
    c = mix(c, vec4(GREEN, 1.0), line.y * fade * 0.85);
  }
  // A glow along the horizon.
  float glow = exp(-abs(uv.y - horizon) * 45.0) * 0.45;
  c = mix(c, vec4(RED, 1.0), glow * (1.0 - c.a));
  return vec4(c.rgb * c.a, c.a);
}
`,
  },
  {
    id: 'galaxy',
    name: 'code.example.galaxy',
    size: 's',
    code: `// A spiral galaxy, slowly turning: one arm blue, one red,
// stars in all four colors.
const vec3 BLUE = vec3(0.26, 0.52, 0.96);
const vec3 RED = vec3(0.92, 0.26, 0.21);
const vec3 YELLOW = vec3(0.98, 0.74, 0.02);
const vec3 GREEN = vec3(0.2, 0.66, 0.33);

vec4 widget(vec2 uv, float t) {
  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float spin = angle + log(r + 0.02) * 2.6 - t * 0.25;
  float arms = pow(0.5 + 0.5 * cos(2.0 * spin), 3.0);

  // Dust and stars turn with the galaxy.
  float turn = t * 0.12;
  vec2 q = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * uv;
  float dust = fbm(q * 7.0);
  float body = arms * exp(-r * 5.5) * (0.4 + dust) * 1.6;
  float core = exp(-r * 16.0);

  vec2 cell = floor(q * 64.0);
  float pick = hash01(cell + 3.0) * 4.0;
  vec3 starColor = pick < 1.0 ? BLUE : pick < 2.0 ? RED : pick < 3.0 ? YELLOW : GREEN;
  float star = step(0.97, hash01(cell))
    * smoothstep(0.3, 0.0, length(fract(q * 64.0) - 0.5))
    * (0.4 + arms) * exp(-r * 2.5);

  vec3 arm = mix(BLUE, RED, smoothstep(-0.2, 0.2, cos(spin)));
  vec3 color = arm * body + mix(YELLOW, uInk, 0.5) * core
    + mix(starColor, uInk, 0.4) * star;
  float a = clamp(body + core + star, 0.0, 1.0);
  return vec4(min(color, vec3(a)), a);
}
`,
  },
  {
    id: 'clock',
    name: 'code.example.clock',
    size: 's',
    code: `// A quiet analog clock with a sweeping second hand.
// uDate.w is the time of day in seconds.
const vec3 BLUE = vec3(0.26, 0.52, 0.96);
const vec3 RED = vec3(0.92, 0.26, 0.21);
const vec3 YELLOW = vec3(0.98, 0.74, 0.02);
const vec3 GREEN = vec3(0.2, 0.66, 0.33);

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

vec4 hand(vec4 below, vec2 uv, float turns, float len, float width, vec3 color) {
  float angle = turns * 6.28318;
  vec2 dir = vec2(sin(angle), cos(angle));
  float d = segment(uv, -dir * 0.05, dir * len) - width;
  float a = smoothstep(1.5 / uResolution.y, 0.0, d);
  return vec4(color, 1.0) * a + below * (1.0 - a);
}

vec4 widget(vec2 uv, float t) {
  float s = uDate.w;
  float r = length(uv);
  float px = 1.5 / uResolution.y;
  vec4 c = vec4(0.0);

  // Twelve ticks, the quarters longer.
  float hour = atan(uv.x, uv.y) / 6.28318 * 12.0;
  float along = abs(fract(hour + 0.5) - 0.5) * 6.28318 / 12.0 * r;
  float quarter = step(abs(fract(hour / 3.0 + 0.5) - 0.5), 0.02);
  float inner = mix(0.36, 0.32, quarter);
  float tick = smoothstep(px, 0.0, along - 0.005)
    * smoothstep(inner - px, inner, r) * smoothstep(0.4, 0.4 - px, r);
  // The quarters in four colors: 12 blue, 3 red, 6 yellow, 9 green.
  vec3 c4[4] = vec3[4](BLUE, RED, YELLOW, GREEN);
  int q = int(mod(floor(hour + 0.5), 12.0)) / 3;
  vec3 tickColor = quarter > 0.5 ? c4[q] : uInk;
  c = vec4(tickColor, 1.0) * tick * mix(0.6, 1.0, quarter);

  c = hand(c, uv, s / 43200.0, 0.2, 0.011, uInk);
  c = hand(c, uv, s / 3600.0, 0.31, 0.007, uInk);
  c = hand(c, uv, s / 60.0, 0.34, 0.0025, RED);
  float pin = smoothstep(0.016, 0.016 - px, r);
  c = vec4(RED, 1.0) * pin + c * (1.0 - pin);
  return vec4(c.rgb * c.a, c.a);
}
`,
  },
  {
    id: 'liquid',
    name: 'code.example.liquid',
    size: 'l',
    code: `// Glossy drops in four colors that melt into each other.
// Move the mouse over the tile: one more drop follows it.
const vec3 BLUE = vec3(0.26, 0.52, 0.96);
const vec3 RED = vec3(0.92, 0.26, 0.21);
const vec3 YELLOW = vec3(0.98, 0.74, 0.02);
const vec3 GREEN = vec3(0.2, 0.66, 0.33);

vec4 widget(vec2 uv, float t) {
  vec3 colors[4] = vec3[4](BLUE, RED, YELLOW, GREEN);
  vec3 mixed = vec3(0.0);
  float wide = uResolution.x / uResolution.y;
  float field = 0.0;
  vec2 slope = vec2(0.0);
  for (int i = 0; i < 7; i++) {
    float k = float(i);
    vec2 center = vec2(
      0.36 * wide * sin(t * 0.31 + k * 1.7),
      0.28 * sin(t * 0.23 + k * 2.9)
    );
    if (i == 6) {
      if (uMouse.z < 0.5) break;
      center = (uMouse.xy - 0.5 * uResolution) / uResolution.y;
    }
    float size = 0.006 + 0.003 * sin(k * 1.3);
    vec2 d = uv - center;
    float q = dot(d, d) + 0.0001;
    field += size / q;
    slope -= 2.0 * size * d / (q * q);
    mixed += colors[i % 4] * size / q;
  }
  // The surface is where the field reaches 1; light it like a drop of glass.
  float a = smoothstep(0.9, 1.1, field);
  vec3 n = normalize(vec3(-slope / (field * field) * 0.035, 1.0));
  vec3 light = normalize(vec3(-0.5, 0.6, 0.65));
  float diffuse = max(dot(n, light), 0.0);
  float shine = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 30.0);
  vec3 color = mixed / field * (0.35 + 0.8 * diffuse);
  color = min(color + uInk * shine * 0.9, vec3(1.0));
  return vec4(color * a, a);
}
`,
  },
];

/** "Start from scratch": the smallest widget, explained. */
export const BLANK_CODE = `// Runs for every pixel of the tile, many times a second.
// uv: where the pixel is. (0, 0) is the middle; y goes from -0.5 to 0.5.
// t: time in seconds.
// Return a color and how solid it is (0 shows the frosted tile).
vec4 widget(vec2 uv, float t) {
  float glow = 0.5 + 0.5 * sin(t + uv.x * 4.0);
  vec3 color = mix(uColors[0], uColors[1], glow);
  float a = 0.6;
  return vec4(color * a, a);
}
`;

/** What a custom widget shows before anything is stored. */
export const DEFAULT_CODE = BLANK_CODE;
