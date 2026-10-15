/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {BLANK_CODE} from './examples';
import {CODE_LIMIT} from './source';

/**
 * What "Copy instructions for an AI" puts on the clipboard: everything a
 * chat assistant needs to write a custom widget, for the user to paste with
 * their idea. In English on purpose (it's for the assistant, which answers
 * in the user's language); keep it in step with source.ts and
 * docs/widgets.md ("Custom").
 */
export function aiInstructions(): string {
  const example = BLANK_CODE.trim();
  return `You are writing a custom widget for Tarn, a new tab page. A custom widget is a GLSL ES 3.00 fragment shader that fills one rounded tile on the page.

Write exactly this function:

vec4 widget(vec2 uv, float t)

- It runs for every pixel of the tile, about 30 times a second.
- uv is the pixel's position: (0, 0) is the middle of the tile, y goes from -0.5 (bottom) to 0.5 (top), and x is scaled the same way, so on a wide tile it goes further than 0.5.
- t is time in seconds.
- Return premultiplied color and alpha: vec4(color * a, a). Alpha 0 shows the frosted glass tile behind, so leave empty space transparent rather than painting a background.

Tarn already declares these; use them, don't declare them again:

uniform vec2 uResolution;  // the tile's size in pixels
uniform float uTime;       // the same as t
uniform vec4 uMouse;       // x, y in pixels from the bottom left; z is 1 while the mouse is over the tile; w is 1 while pressed
uniform vec4 uDate;        // year, month (0-11), day, seconds since midnight (local time)
uniform vec3 uInk;         // the page's text color: light on dark wallpapers, dark on light ones
uniform vec3 uColors[4];   // the current wallpaper's four colors; use them so the widget matches any wallpaper
float hash01(vec2 p);      // random number 0..1 for a cell
float noise(vec2 p);       // smooth value noise, 0..1
float fbm(vec2 p);         // five octaves of noise, about 0..1

Tile sizes: small 136 x 136, medium 296 x 136, large 296 x 296, extra large 616 x 296 (CSS pixels). Make it look right at any of them.

Rules:
- Don't write #version, precision, uniforms, main() or an out variable: Tarn adds them.
- No textures, no other buffers, nothing from the internet: only math.
- Keep it light: no loops over more than about 64 steps, no ray marching with hundreds of steps. A heavy widget is paused.
- Calm and beautiful beats busy: soft motion, a few colors, transparent background.
- At most ${CODE_LIMIT} characters.
- Code with void mainImage(out vec4 fragColor, in vec2 fragCoord) from Shadertoy also works, but it fills the tile without transparency, so prefer widget().

A complete example:

${example}

Reply with the whole code in one code block, then one sentence on what it does. The user will paste it into Tarn's settings (Widgets > Custom widgets). Talk to the user in their own language.

The user's idea:
`;
}
