/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {svg, type SVGTemplateResult} from 'lit';

/**
 * Solid 24×24 glyphs for settings rows, drawn for Tarn. Each is a filled
 * shape with its details cut out (even-odd), so it reads at 15px inside a
 * 24px icon tile, the way system settings icons do.
 */
export const GLYPHS = {
  photo: svg`<path fill-rule="evenodd" d="M4 4.5h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM8 7.3a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM4.5 17h15l-4.6-5.6-3.3 3.9-2.2-2.3z"/>`,
  clock: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM11 6v6.6l4.4 2.6 1-1.7-3.4-2V6z"/>`,
  widgets: svg`<rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2"/><rect x="3" y="13" width="18" height="8" rx="2.2"/>`,
  sliders: svg`<rect x="3" y="5.2" width="18" height="1.8" rx=".9"/><rect x="3" y="11.1" width="18" height="1.8" rx=".9"/><rect x="3" y="17" width="18" height="1.8" rx=".9"/><circle cx="8" cy="6.1" r="2.7"/><circle cx="15.5" cy="12" r="2.7"/><circle cx="10" cy="17.9" r="2.7"/>`,
  tab: svg`<path d="M2 8.5A3.5 3.5 0 0 1 5.5 5h4.2c.9 0 1.7.4 2.2 1.1L13 7.5h5.5A3.5 3.5 0 0 1 22 11v6.5a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5z"/>`,
  keyboard: svg`<path fill-rule="evenodd" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM5 8v2h2V8zm4 0v2h2V8zm4 0v2h2V8zm4 0v2h2V8zM5 12v2h2v-2zm12 0v2h2v-2zm-9 3.3v1.7h8v-1.7z"/>`,
  share: svg`<path d="M12 2l4.6 4.6-1.4 1.4L13 5.8V14h-2V5.8L8.8 8 7.4 6.6z"/><path d="M5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1z"/>`,
  tray: svg`<path d="M11 3h2v9.2l2.2-2.2 1.4 1.4L12 16l-4.6-4.6 1.4-1.4 2.2 2.2z"/><path d="M3 14h2v5h14v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>`,
  doc: svg`<path fill-rule="evenodd" d="M6 2h8.2L20 7.8V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 5.2v1.6h5V7.2zm0 4v1.6h8v-1.6zm0 4v1.6h8v-1.6z"/>`,
  info: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 8.2V17h2v-6.8zm1-4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/>`,
  reset: svg`<path fill-rule="evenodd" d="M12 3a9 9 0 1 1-8.5 12l2-.7A6.9 6.9 0 1 0 6.7 7.3L9 9.6H2.6V3.2l2.6 2.6A8.9 8.9 0 0 1 12 3z"/>`,
  star: svg`<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>`,
  note: svg`<path fill-rule="evenodd" d="M5 3h10.2L20 7.8V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 7v1.6h10V10zm0 4v1.6h7V14z"/>`,
  timer: svg`<path fill-rule="evenodd" d="M9.5 1.5h5v2h-5zM12 4.5a8.75 8.75 0 1 1 0 17.5 8.75 8.75 0 0 1 0-17.5zM11 8v6h2V8z"/>`,
  plus: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v4H7v2h4v4h2v-4h4v-2h-4V7z"/>`,
  minus: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM7 11v2h10v-2z"/>`,
  up: svg`<path d="M12 7.6l6.2 6.2-1.5 1.5L12 10.6l-4.7 4.7-1.5-1.5z"/>`,
  down: svg`<path d="M12 16.4l-6.2-6.2 1.5-1.5 4.7 4.7 4.7-4.7 1.5 1.5z"/>`,
  chevron: svg`<path d="M9 5.6l6.4 6.4L9 18.4l-1.5-1.5 4.9-4.9-4.9-4.9z"/>`,
  back: svg`<path d="M15 5.6L8.6 12l6.4 6.4 1.5-1.5-4.9-4.9 4.9-4.9z"/>`,
  grid: svg`<rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2"/><rect x="3" y="13" width="8" height="8" rx="2.2"/><rect x="13" y="13" width="8" height="8" rx="2.2"/>`,
  search: svg`<path fill-rule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 6 12l4.8 4.7-1.6 1.6-4.7-4.8A7.5 7.5 0 1 1 10.5 3zm0 2.2a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 0 0 0-10.6z"/>`,
} satisfies Record<string, SVGTemplateResult>;

export type GlyphName = keyof typeof GLYPHS;
