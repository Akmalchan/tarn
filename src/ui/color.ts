/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// `#rrggbb` colors, shared by the background, the wallpaper store, the
// clock and custom widgets. Imports nothing, so workers can use it too.

/** `#rrggbb` as RGB, each 0 to 1; black if it doesn't parse. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1, 7), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Relative luminance (sRGB, as WCAG defines it), 0 to 1. */
export function relativeLuminance(hex: string): number {
  const channel = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Whether a color reads as light or dark: one rule for scenes and photos. */
export function toneOfHex(hex: string): 'light' | 'dark' {
  return relativeLuminance(hex) > 0.35 ? 'light' : 'dark';
}

/** The mean color of RGBA pixels (alpha ignored), as `#rrggbb`. */
export function averageHex(pixels: ArrayLike<number>): string {
  let r = 0;
  let g = 0;
  let b = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i]!;
    g += pixels[i + 1]!;
    b += pixels[i + 2]!;
  }
  const hex = (v: number) =>
    Math.round(v / count)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
