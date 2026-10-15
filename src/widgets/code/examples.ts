/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {MessageKey} from '../../i18n';
import type {WidgetSize} from '../../layout/bands';

/**
 * Custom widgets to start from, in the panel's Custom widgets section.
 * Original code (AGENTS.md, "Ownership"), short on purpose: each one
 * teaches one idea and reads in a minute.
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
    id: 'waves',
    name: 'code.example.waves',
    size: 'm',
    code: `// Four thin waves, each a little faster than the last.
vec4 widget(vec2 uv, float t) {
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    float k = float(i);
    float y = 0.12 * sin(uv.x * (3.0 + k) + t * (0.8 + 0.3 * k) + k * 1.3);
    a += 0.55 * smoothstep(0.012, 0.0, abs(uv.y - y + 0.1 * k - 0.15));
  }
  vec3 color = mix(uColors[2], uInk, 0.35);
  return vec4(color * a, a);
}
`,
  },
  {
    id: 'orbits',
    name: 'code.example.orbits',
    size: 's',
    code: `// Six moons on faint rings around the middle.
vec4 widget(vec2 uv, float t) {
  float a = 0.0;
  for (int i = 0; i < 6; i++) {
    float k = float(i);
    float r = 0.12 + 0.045 * k;
    float s = t * (0.9 - 0.1 * k) + k;
    vec2 moon = r * vec2(cos(s), sin(s));
    a += 0.006 / length(uv - moon);
    a += 0.1 * smoothstep(0.002, 0.0, abs(length(uv) - r));
  }
  a = clamp(a, 0.0, 1.0);
  return vec4(mix(uColors[1], uInk, a) * a, a);
}
`,
  },
  {
    id: 'lava',
    name: 'code.example.lava',
    size: 's',
    code: `// Blobs that melt into each other: add up their fields,
// then keep what's above a level.
vec4 widget(vec2 uv, float t) {
  float field = 0.0;
  for (int i = 0; i < 5; i++) {
    float k = float(i);
    vec2 p = 0.28 * vec2(sin(t * 0.5 + k * 2.1), cos(t * 0.37 + k * 1.3));
    field += 0.018 / dot(uv - p, uv - p);
  }
  float a = smoothstep(0.9, 1.1, field) * 0.9;
  vec3 color = mix(uColors[3], uColors[0], uv.y + 0.5);
  return vec4(color * a, a);
}
`,
  },
  {
    id: 'seconds',
    name: 'code.example.seconds',
    size: 's',
    code: `// A ring that fills once a minute, from the real clock.
vec4 widget(vec2 uv, float t) {
  float minute = fract(uDate.w / 60.0);
  float turn = fract(atan(uv.x, uv.y) / 6.28318);
  float ring = smoothstep(0.012, 0.0, abs(length(uv) - 0.38));
  vec2 tip = 0.38 * vec2(sin(minute * 6.28318), cos(minute * 6.28318));
  float hand = smoothstep(0.03, 0.02, length(uv - tip));
  float a = max(ring * (turn < minute ? 0.9 : 0.15), hand);
  return vec4(mix(uColors[1], uInk, 0.3) * a, a);
}
`,
  },
  {
    id: 'equalizer',
    name: 'code.example.equalizer',
    size: 'l',
    code: `// Bars that dance to music only they can hear.
vec4 widget(vec2 uv, float t) {
  float width = uResolution.x / uResolution.y;
  float x = (uv.x / width + 0.45) / 0.9; // 0..1 across, with a margin
  float bars = 20.0;
  float i = floor(x * bars);
  float f = fract(x * bars);
  float h = 0.1 + 0.5 * noise(vec2(i * 1.7, t * 2.2)) * (1.0 - abs(i / bars - 0.5));
  float y = uv.y + 0.4;
  float inBar = step(0.2, f) * step(f, 0.8) * step(0.0, x) * step(x, 1.0);
  float bar = inBar * step(0.0, y) * smoothstep(h + 0.005, h, y);
  float cap = inBar * smoothstep(0.012, 0.0, abs(y - h - 0.03));
  float a = clamp(bar * 0.85 + cap, 0.0, 1.0);
  vec3 color = mix(uColors[0], uColors[1], clamp(y / 0.7, 0.0, 1.0));
  return vec4(mix(color, uInk, cap) * a, a);
}
`,
  },
  {
    id: 'ripples',
    name: 'code.example.ripples',
    size: 'm',
    code: `// Rings spreading from the mouse (uMouse is in pixels;
// uMouse.z is 1 while it is over the tile).
vec4 widget(vec2 uv, float t) {
  vec2 center = vec2(0.0);
  if (uMouse.z > 0.5) {
    center = (uMouse.xy - 0.5 * uResolution) / uResolution.y;
  }
  float d = length(uv - center);
  float rings = 0.5 + 0.5 * sin(d * 40.0 - t * 4.0);
  float a = pow(rings, 6.0) * smoothstep(0.6, 0.0, d) * 0.8;
  return vec4(mix(uColors[2], uInk, 0.4) * a, a);
}
`,
  },
  {
    id: 'blank',
    name: 'code.example.blank',
    size: 'm',
    code: `// Runs for every pixel of the tile, many times a second.
// uv: where the pixel is. (0, 0) is the middle; y goes from -0.5 to 0.5.
// t: time in seconds.
// Return a color and how solid it is (0 shows the frosted tile).
vec4 widget(vec2 uv, float t) {
  float glow = 0.5 + 0.5 * sin(t + uv.x * 4.0);
  vec3 color = mix(uColors[0], uColors[1], glow);
  float a = 0.6;
  return vec4(color * a, a);
}
`,
  },
];

/** What a custom widget shows before anything is stored. */
export const DEFAULT_CODE = CODE_EXAMPLES[0]!.code;
