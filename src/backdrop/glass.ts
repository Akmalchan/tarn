/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Frosted glass behind widgets, drawn by the background itself.
//
// CSS backdrop-filter re-blurs the moving scene every frame (measured: the
// compositor goes from ~2% to ~8% busy). Tarn owns the scene, so it draws
// the frost instead: the frame is rendered into a texture, the GPU builds
// its mipmaps (each level a cheaper, softer copy), and a final pass shows
// the soft copy inside the widgets' rounded rectangles. With no widgets the
// renderer skips all of this and draws straight to the screen.

/** Most tiles the shader handles; the layout never shows more than this. */
export const MAX_TILES = 24;

/** How soft the frost is, in CSS pixels. */
const BLUR_CSS_PX = 26;

export const GLASS_VERTEX = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const GLASS_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uFrame;
uniform vec2 uResolution;   // canvas pixels
uniform float uScale;       // canvas pixels per CSS pixel
uniform vec4 uTiles[${MAX_TILES}]; // x, y, width, height in CSS pixels
uniform int uTileCount;
uniform float uRadius;      // corner radius, CSS pixels
uniform float uStrength;    // 0..1, follows the widgets' fade
uniform float uFrost;       // how much white is mixed in

out vec4 outColor;

float roundedBox(vec2 p, vec4 box, float radius) {
  vec2 center = box.xy + 0.5 * box.zw;
  vec2 q = abs(p - center) - 0.5 * box.zw + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 sharp = texture(uFrame, uv).rgb;
  vec2 css = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uScale;

  float d = 1e6;
  for (int i = 0; i < ${MAX_TILES}; i++) {
    if (i >= uTileCount) break;
    d = min(d, roundedBox(css, uTiles[i], uRadius));
  }
  // Anti-aliased edge, one canvas pixel wide.
  float inside = uStrength * (1.0 - smoothstep(-0.5, 0.5, d * uScale));
  if (inside <= 0.0) {
    outColor = vec4(sharp, 1.0);
    return;
  }

  // A soft copy: nine taps on a coarse mip level, a tent filter that hides
  // the level's blockiness.
  float blurPx = ${BLUR_CSS_PX.toFixed(1)} * uScale;
  float lod = max(log2(blurPx) - 1.0, 0.0);
  vec2 texel = exp2(lod) / uResolution;
  vec3 soft = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float w = (2.0 - abs(float(x))) * (2.0 - abs(float(y)));
      soft += w * textureLod(uFrame, uv + vec2(x, y) * texel * 1.5, lod).rgb;
    }
  }
  soft /= 16.0;
  vec3 frosted = mix(soft, vec3(1.0), uFrost);
  outColor = vec4(mix(sharp, frosted, inside), 1.0);
}
`;
