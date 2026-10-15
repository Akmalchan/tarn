/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
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
  contrast: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2v16a8 8 0 0 0 0-16z"/>`,
  sliders: svg`<rect x="3" y="5.2" width="18" height="1.8" rx=".9"/><rect x="3" y="11.1" width="18" height="1.8" rx=".9"/><rect x="3" y="17" width="18" height="1.8" rx=".9"/><circle cx="8" cy="6.1" r="2.7"/><circle cx="15.5" cy="12" r="2.7"/><circle cx="10" cy="17.9" r="2.7"/>`,
  tab: svg`<path d="M2 8.5A3.5 3.5 0 0 1 5.5 5h4.2c.9 0 1.7.4 2.2 1.1L13 7.5h5.5A3.5 3.5 0 0 1 22 11v6.5a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5z"/>`,
  keyboard: svg`<path fill-rule="evenodd" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM5 8v2h2V8zm4 0v2h2V8zm4 0v2h2V8zm4 0v2h2V8zM5 12v2h2v-2zm12 0v2h2v-2zm-9 3.3v1.7h8v-1.7z"/>`,
  share: svg`<path d="M12 2l4.6 4.6-1.4 1.4L13 5.8V14h-2V5.8L8.8 8 7.4 6.6z"/><path d="M5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1z"/>`,
  tray: svg`<path d="M11 3h2v9.2l2.2-2.2 1.4 1.4L12 16l-4.6-4.6 1.4-1.4 2.2 2.2z"/><path d="M3 14h2v5h14v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>`,
  doc: svg`<path fill-rule="evenodd" d="M6 2h8.2L20 7.8V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 5.2v1.6h5V7.2zm0 4v1.6h8v-1.6zm0 4v1.6h8v-1.6z"/>`,
  info: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 8.2V17h2v-6.8zm1-4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/>`,
  reset: svg`<path fill-rule="evenodd" d="M12 3a9 9 0 1 1-8.5 12l2-.7A6.9 6.9 0 1 0 6.7 7.3L9 9.6H2.6V3.2l2.6 2.6A8.9 8.9 0 0 1 12 3z"/>`,
  bookmark: svg`<path d="M6.5 2.5h11A1.5 1.5 0 0 1 19 4v17.2l-7-4.4-7 4.4V4a1.5 1.5 0 0 1 1.5-1.5z"/>`,
  star: svg`<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>`,
  bubble: svg`<path d="M5 3.5h14A2.5 2.5 0 0 1 21.5 6v9a2.5 2.5 0 0 1-2.5 2.5h-7.2L7 21.2v-3.7H5A2.5 2.5 0 0 1 2.5 15V6A2.5 2.5 0 0 1 5 3.5z"/>`,
  seal: svg`<path fill-rule="evenodd" d="M12 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/><path d="M8 16.6L6.5 22l5.5-2 5.5 2-1.5-5.4a8.6 8.6 0 0 1-8 0z"/>`,
  note: svg`<path fill-rule="evenodd" d="M5 3h10.2L20 7.8V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 7v1.6h10V10zm0 4v1.6h7V14z"/>`,
  checklist: svg`<path d="M3.3 6.2l1.4-1.4 1.6 1.6 3.4-3.4 1.4 1.4-4.8 4.8zM3.3 15.2l1.4-1.4 1.6 1.6 3.4-3.4 1.4 1.4-4.8 4.8z"/><rect x="13" y="5" width="8" height="2.2" rx="1.1"/><rect x="13" y="14" width="8" height="2.2" rx="1.1"/>`,
  weather: svg`<circle cx="8.5" cy="8.5" r="4.2"/><path d="M8.5 1.5v1.8M1.5 8.5h1.8M3.6 3.6l1.3 1.3M13.4 3.6l-1.3 1.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 21a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 20 13.6 3.8 3.8 0 0 1 19.2 21z"/>`,
  thermometer: svg`<path fill-rule="evenodd" d="M12 2a3.5 3.5 0 0 1 3.5 3.5v8.1a5.5 5.5 0 1 1-7 0V5.5A3.5 3.5 0 0 1 12 2zm-1 6v7.2a2.6 2.6 0 1 0 2 0V8z"/>`,
  key: svg`<path fill-rule="evenodd" d="M8 6.5a5.5 5.5 0 0 1 5.2 7.3L21 21.6V23h-3.5v-2h-2v-2h-2l-1.6-1.6A5.5 5.5 0 1 1 8 6.5zM6.5 9.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>`,
  calendar: svg`<path fill-rule="evenodd" d="M7 2h2v2h6V2h2v2h1.5A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4H7zM5 9v9.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V9zm2 2.5h3v3H7z"/>`,
  timer: svg`<path fill-rule="evenodd" d="M9.5 1.5h5v2h-5zM12 4.5a8.75 8.75 0 1 1 0 17.5 8.75 8.75 0 0 1 0-17.5zM11 8v6h2V8z"/>`,
  plus: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v4H7v2h4v4h2v-4h4v-2h-4V7z"/>`,
  minus: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM7 11v2h10v-2z"/>`,
  up: svg`<path d="M12 7.6l6.2 6.2-1.5 1.5L12 10.6l-4.7 4.7-1.5-1.5z"/>`,
  down: svg`<path d="M12 16.4l-6.2-6.2 1.5-1.5 4.7 4.7 4.7-4.7 1.5 1.5z"/>`,
  chevron: svg`<path d="M9 5.6l6.4 6.4L9 18.4l-1.5-1.5 4.9-4.9-4.9-4.9z"/>`,
  back: svg`<path d="M15 5.6L8.6 12l6.4 6.4 1.5-1.5-4.9-4.9 4.9-4.9z"/>`,
  grid: svg`<rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2"/><rect x="3" y="13" width="8" height="8" rx="2.2"/><rect x="13" y="13" width="8" height="8" rx="2.2"/>`,
  close: svg`<path d="M6.3 4.9L12 10.6l5.7-5.7 1.4 1.4-5.7 5.7 5.7 5.7-1.4 1.4-5.7-5.7-5.7 5.7-1.4-1.4 5.7-5.7-5.7-5.7z"/>`,
  globe: svg`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.6 2.3A8 8 0 0 0 4.1 11h3.4c.1-2.5.9-4.9 2.9-6.7zm3.2 0c2 1.8 2.8 4.2 2.9 6.7h3.4a8 8 0 0 0-6.3-6.7zM9.5 11h5c-.1-2.2-.9-4.2-2.5-5.8C10.4 6.8 9.6 8.8 9.5 11zm-5.4 2a8 8 0 0 0 6.3 6.7c-2-1.8-2.8-4.2-2.9-6.7zm5.4 0c.1 2.2.9 4.2 2.5 5.8 1.6-1.6 2.4-3.6 2.5-5.8zm7 0c-.1 2.5-.9 4.9-2.9 6.7a8 8 0 0 0 6.3-6.7z"/>`,
  check: svg`<path d="M9.2 16.6L4.6 12l-1.5 1.5 6.1 6.1L21 7.8l-1.5-1.5z"/>`,
  mic: svg`<path d="M12 2.5a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-7 0V6A3.5 3.5 0 0 1 12 2.5z"/><path d="M5 11h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z"/>`,
  lens: svg`<path d="M4 4h4.5v2.2H6.2v2.3H4zm11.5 0H20v4.5h-2.2V6.2h-2.3zM4 15.5h2.2v2.3h2.3V20H4zm13.8 0H20V20h-4.5v-2.2h2.3z"/><circle cx="12" cy="12" r="3.6"/>`,
  code: svg`<path d="M8.3 6.3l1.4 1.4L5.4 12l4.3 4.3-1.4 1.4L2.6 12zM15.7 6.3l5.7 5.7-5.7 5.7-1.4-1.4 4.3-4.3-4.3-4.3z"/><path d="M13.1 4.2l1.9.6-4.1 15-1.9-.6z"/>`,
  sparkle: svg`<path d="M12 2.5l2.3 6.2 6.2 2.3-6.2 2.3L12 19.5l-2.3-6.2L3.5 11l6.2-2.3z"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>`,
  search: svg`<path fill-rule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 6 12l4.8 4.7-1.6 1.6-4.7-4.8A7.5 7.5 0 1 1 10.5 3zm0 2.2a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 0 0 0-10.6z"/>`,
} satisfies Record<string, SVGTemplateResult>;

export type GlyphName = keyof typeof GLYPHS;
