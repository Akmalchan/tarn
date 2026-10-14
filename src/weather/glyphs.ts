/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {svg, type SVGTemplateResult} from 'lit';
import type {Condition} from './types';

// Tarn's own weather glyphs: thin line drawings on a 24-unit grid, in the
// text color. Precipitation hangs under a cloud raised to make room.

const SUN_RAYS = svg`<path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"/>`;
const SUN = svg`<circle cx="12" cy="12" r="4.2"/>${SUN_RAYS}`;
const MOON = svg`<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/>`;
const CLOUD = svg`<path d="M7.2 18.5h9.9a4 4 0 0 0 .5-7.97 5.6 5.6 0 0 0-10.8 1.2 3.4 3.4 0 0 0 .4 6.77z"/>`;
/** A cloud raised to leave room underneath. */
const HIGH_CLOUD = svg`<path d="M7.2 14.2h9.9a3.7 3.7 0 0 0 .5-7.37 5.2 5.2 0 0 0-10 1.1 3.15 3.15 0 0 0-.4 6.27z"/>`;
const SMALL_SUN = svg`<circle cx="8.3" cy="8.6" r="2.9"/><path d="M8.3 3.2v1.2M3 8.6h1.2M4.6 4.9l.85.85M12 4.9l-.85.85M4.6 12.3l.85-.85"/>`;
const SMALL_MOON = svg`<path d="M12.3 10.6A5 5 0 1 1 6.4 4.4a3.9 3.9 0 0 0 5.9 6.2z"/>`;
const LOW_CLOUD = svg`<path d="M10 19.4h7.6a3.4 3.4 0 0 0 .3-6.8 4.6 4.6 0 0 0-8.8 1.4 2.75 2.75 0 0 0 .9 5.4z"/>`;

function glyph(condition: Condition, day: boolean): SVGTemplateResult {
  switch (condition) {
    case 'clear':
      return day ? SUN : MOON;
    case 'partly':
      return svg`${day ? SMALL_SUN : SMALL_MOON}${LOW_CLOUD}`;
    case 'cloudy':
      return CLOUD;
    case 'fog':
      return svg`<path d="M4 8.5h16M6.5 12.5h11M4 16.5h16"/>`;
    case 'drizzle':
      return svg`${HIGH_CLOUD}<path class="dot" d="M8.5 17.6v.01M12 19.4v.01M15.5 17.6v.01"/>`;
    case 'rain':
      return svg`${HIGH_CLOUD}<path d="M8.6 16.6l-1 3.2M12.1 16.6l-1 3.2M15.6 16.6l-1 3.2"/>`;
    case 'sleet':
      return svg`${HIGH_CLOUD}<path d="M9.3 16.6l-1 3.2M14.6 16.6l-1 3.2"/><path class="dot" d="M11.8 19.4v.01"/>`;
    case 'snow':
      return svg`${HIGH_CLOUD}<path class="dot" d="M8.3 17.3v.01M12 18.4v.01M15.7 17.3v.01M10.1 20.6v.01M13.9 20.6v.01"/>`;
    case 'storm':
      return svg`${HIGH_CLOUD}<path d="M12.9 14.4l-2.4 3.7h3l-2.1 3.5"/>`;
    case 'wind':
      return svg`<path d="M3.5 9.2h10.6a2.6 2.6 0 1 0-2.6-2.6M3.5 13h14.3a2.6 2.6 0 1 1-2.6 2.6M3.5 16.8h7"/>`;
  }
}

/** The glyph for a condition, by day or night. */
export function weatherGlyph(
  condition: Condition,
  day = true,
): SVGTemplateResult {
  return svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">${glyph(condition, day)}</svg>`;
}
