/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// A custom widget's content and the shader built from it. Pure, so the
// rules people code against are pinned by tests (source.test.ts).

/** The most code a custom widget keeps. */
export const CODE_LIMIT = 16_000;

/** What a custom widget stores (`widget.<id>` in storage.local). */
export interface CodeContent {
  /**
   * The language. Only 'glsl' runs today; anything else came from a newer
   * Tarn and is kept as stored, with a calm note in the tile.
   */
  readonly lang: string;
  readonly code: string;
}

/**
 * Anything stored, as content. A widget with nothing stored yet shows
 * `fallback` (the panel always saves code when it adds one).
 */
export function normalizeCode(raw: unknown, fallback = ''): CodeContent {
  if (typeof raw === 'string') {
    return {lang: 'glsl', code: raw.slice(0, CODE_LIMIT)};
  }
  if (raw && typeof raw === 'object') {
    const {lang, code} = raw as Record<string, unknown>;
    if (typeof code === 'string') {
      return {
        lang: typeof lang === 'string' && lang ? lang : 'glsl',
        code: code.slice(0, CODE_LIMIT),
      };
    }
  }
  return {lang: 'glsl', code: fallback};
}

/** Code written for Shadertoy: `mainImage(out vec4, in vec2)`. */
export function isShadertoy(code: string): boolean {
  return /\bvoid\s+mainImage\s*\(/.test(stripComments(code));
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Everything a widget can use, before its own code. Kept short and
 * documented in docs/widgets.md ("Custom") and in the AI instructions
 * (ai-prompt.ts): change all three together.
 */
const PRELUDE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;
uniform vec4 uMouse;
uniform vec4 uDate;
uniform vec3 uInk;
uniform vec3 uColors[4];

out vec4 tarnColor;

float hash01(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash01(i), hash01(i + vec2(1.0, 0.0)), u.x),
    mix(hash01(i + vec2(0.0, 1.0)), hash01(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    amp *= 0.5;
  }
  return sum;
}
`;

/** Shadertoy's names, for code pasted from there. */
const SHADERTOY = /* glsl */ `
#define iResolution vec3(uResolution, 1.0)
#define iTime uTime
#define iTimeDelta (1.0 / 30.0)
#define iFrame int(uTime * 30.0)
#define iMouse vec4(uMouse.xy, uMouse.w > 0.5 ? uMouse.xy : vec2(0.0))
#define iDate uDate
`;

const WIDGET_MAIN = /* glsl */ `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  vec4 color = widget(uv, uTime);
  tarnColor = vec4(clamp(color.rgb, 0.0, 1.0), clamp(color.a, 0.0, 1.0));
}
`;

const SHADERTOY_MAIN = /* glsl */ `
void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  tarnColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
}
`;

/**
 * The fragment shader for a widget's code. `#line 1` makes the driver's
 * error lines count from the user's first line.
 */
export function fragmentFor(code: string): string {
  const shadertoy = isShadertoy(code);
  return (
    PRELUDE +
    (shadertoy ? SHADERTOY : '') +
    '#line 1\n' +
    code +
    '\n' +
    (shadertoy ? SHADERTOY_MAIN : WIDGET_MAIN)
  );
}

/** One problem in a widget's code, as people read it. */
export interface CodeError {
  /** 1-based line in the user's code, or null when it isn't about one. */
  readonly line: number | null;
  readonly message: string;
}

/**
 * The driver's compile log, cleaned up: `ERROR: 0:4: 'colr' : undeclared
 * identifier` becomes line 4, "'colr' : undeclared identifier". Lines past
 * the user's code (the wrapper) lose their number; a missing `widget`
 * function gets a plain message from the caller instead.
 */
export function parseErrors(log: string, code: string): CodeError[] {
  const lines = code.split('\n').length;
  const errors: CodeError[] = [];
  for (const raw of log.split('\n')) {
    const text = raw.trim().replace(/\0/g, '');
    if (!text) continue;
    const match = /^(?:ERROR|WARNING):\s*\d+:(\d+):\s*(.*)$/.exec(text);
    if (/compilation terminated/i.test(text)) continue;
    if (match) {
      if (text.startsWith('WARNING')) continue;
      const line = Number(match[1]);
      errors.push({
        line: line >= 1 && line <= lines ? line : null,
        message: match[2]!.trim(),
      });
    } else {
      errors.push({line: null, message: text.replace(/^ERROR:\s*/, '')});
    }
  }
  return errors;
}

/** Whether the code defines what Tarn calls: `widget` or `mainImage`. */
export function hasEntry(code: string): boolean {
  const bare = stripComments(code);
  return isShadertoy(bare) || /\bvec4\s+widget\s*\(/.test(bare);
}
