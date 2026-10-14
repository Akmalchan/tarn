/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {css, html, svg} from 'lit';
import {locale} from '../i18n';
import type {ClockStyle} from '../settings/schema';

/**
 * How each clock face draws the time, shared by the clock on the tab and
 * the face thumbnails in settings, so a thumbnail is a true small copy.
 * Sizes come from the caller's CSS; nothing here loads a font.
 */
export function clockTime(face: ClockStyle, time: string, now?: Date) {
  if (face === 'pixel') return pixelTime(time);
  if (face === 'analog') return analogTime(time, now);
  if (face === 'stacked') {
    const [hours, minutes] = splitTime(time);
    return html`<span class="hh">${hours}</span
      ><span class="mm">${minutes}</span>`;
  }
  if (face === 'duo') {
    const [hours, minutes] = time.split(/(\D+)/);
    const separator = time.slice(
      hours!.length,
      time.length - (minutes ?? '').length,
    );
    const rest = time.slice(hours!.length + separator.length);
    return html`<span class="hh">${hours}</span
      ><span class="sep">${separator}</span><span class="mm">${rest}</span>`;
  }
  return time;
}

/**
 * The analog face: a quiet dial, hour ticks heavier at the quarters,
 * minute ticks faint, two rounded hands. It reads the time from `now`
 * (or the text, for thumbnails), and moves once a minute like the rest.
 */
export function analogTime(time: string, now?: Date) {
  const [h = '0', m = '0'] = time.split(/\D+/);
  const hours = now ? now.getHours() : Number(h);
  const minutes = now ? now.getMinutes() : Number(m);
  const [hourAngle, minuteAngle] = handAngles(hours, minutes);
  return html`<svg
    class="analog"
    viewBox="0 0 200 200"
    role="img"
    aria-label=${time}
  >
    ${TICKS}
    ${svg`<line x1="100" y1="100" x2="100" y2="54" stroke-width="7"
      transform="rotate(${hourAngle} 100 100)" />
    <line x1="100" y1="112" x2="100" y2="30" stroke-width="3.2"
      transform="rotate(${minuteAngle} 100 100)" />
    <circle cx="100" cy="100" r="5.5" fill="currentColor" stroke="none" />`}
  </svg>`;
}

/** Degrees clockwise from 12 for the hour and minute hands. */
export function handAngles(hours: number, minutes: number): [number, number] {
  return [((hours % 12) + minutes / 60) * 30, minutes * 6];
}

const TICKS = (() => {
  const lines = [];
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30;
    const quarter = i % 15 === 0;
    const hour = i % 5 === 0;
    const inner = quarter ? 70 : hour ? 74 : 79;
    const x = (r: number) => (100 + r * Math.sin(a)).toFixed(2);
    const y = (r: number) => (100 - r * Math.cos(a)).toFixed(2);
    lines.push(
      svg`<line x1=${x(inner)} y1=${y(inner)} x2=${x(83)} y2=${y(83)}
        stroke-width=${quarter ? 3.2 : hour ? 2.2 : 0.9}
        opacity=${hour ? 1 : 0.45} />`,
    );
  }
  return lines;
})();

/**
 * SVG filters some faces draw through, defined once per shadow root that
 * shows a clock. Sizes are fractions of the text's box, so the same filter
 * fits the big clock and a settings thumbnail.
 *  - outline: a ring around the filled digits, so the font's overlapping
 *    contours (which text-stroke draws, as stray lines in 2, 6 and 9) vanish;
 *  - round: corners melted soft, for a rounded face from the same font;
 *  - glass: translucent digits with a lit bevel and a soft shadow, and a
 *    variant with a darker edge for light wallpapers.
 */
export const faceFilters = html`<svg class="face-filters" aria-hidden="true">
  ${svg`<filter id="face-outline" x="-0.05" y="-0.1" width="1.1" height="1.2" primitiveUnits="objectBoundingBox">
    <feMorphology in="SourceAlpha" operator="dilate" radius="0.005 0.015" result="fat" />
    <feComposite in="fat" in2="SourceAlpha" operator="out" result="ring" />
    <feFlood class="ink" /><feComposite in2="ring" operator="in" />
  </filter>
  <filter id="face-round" x="-0.05" y="-0.1" width="1.1" height="1.2" primitiveUnits="objectBoundingBox">
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.012 0.036" result="blur" />
    <feComponentTransfer in="blur" result="round"><feFuncA type="linear" slope="16" intercept="-7" /></feComponentTransfer>
    <feFlood class="ink" /><feComposite in2="round" operator="in" />
  </filter>
  <filter id="face-glass" x="-0.1" y="-0.2" width="1.2" height="1.5" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.008 0.024" result="soft" />
    <feSpecularLighting in="soft" surfaceScale="3" specularConstant="1.2" specularExponent="22" lighting-color="#fff" result="spec">
      <feDistantLight azimuth="235" elevation="48" />
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="lit" />
    <feMorphology in="SourceAlpha" operator="erode" radius="0.0047 0.0136" result="inner" />
    <feComposite in="SourceAlpha" in2="inner" operator="out" result="rim" />
    <feFlood flood-color="#fff" flood-opacity="0.6" /><feComposite in2="rim" operator="in" result="rimLit" />
    <feFlood flood-color="#fff" flood-opacity="0.16" /><feComposite in2="SourceAlpha" operator="in" result="body" />
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.033 0.097" result="blurred" />
    <feOffset in="blurred" dy="0.078" result="dropped" />
    <feFlood flood-color="#000" flood-opacity="0.2" /><feComposite in2="dropped" operator="in" result="shadow" />
    <feMerge><feMergeNode in="shadow" /><feMergeNode in="body" /><feMergeNode in="lit" /><feMergeNode in="rimLit" /></feMerge>
  </filter>
  <filter id="face-glass-light" x="-0.1" y="-0.2" width="1.2" height="1.5" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.008 0.024" result="soft" />
    <feSpecularLighting in="soft" surfaceScale="3" specularConstant="1.3" specularExponent="22" lighting-color="#fff" result="spec">
      <feDistantLight azimuth="235" elevation="48" />
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="lit" />
    <feMorphology in="SourceAlpha" operator="erode" radius="0.0047 0.0136" result="inner" />
    <feComposite in="SourceAlpha" in2="inner" operator="out" result="rim" />
    <feOffset in="rim" dx="0.0027" dy="0.0117" result="rimLow" />
    <feFlood flood-color="#16192a" flood-opacity="0.35" /><feComposite in2="rimLow" operator="in" result="rimDark" />
    <feFlood flood-color="#fff" flood-opacity="0.85" /><feComposite in2="rim" operator="in" result="rimLit" />
    <feFlood flood-color="#3a3f5c" flood-opacity="0.1" /><feComposite in2="SourceAlpha" operator="in" result="body" />
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.03 0.087" result="blurred" />
    <feOffset in="blurred" dy="0.068" result="dropped" />
    <feFlood flood-color="#1a1d30" flood-opacity="0.18" /><feComposite in2="dropped" operator="in" result="shadow" />
    <feMerge><feMergeNode in="shadow" /><feMergeNode in="body" /><feMergeNode in="rimDark" /><feMergeNode in="lit" /><feMergeNode in="rimLit" /></feMerge>
  </filter>`}
</svg>`;

/**
 * How each face looks, for any element with classes "t <face>" (the clock
 * and the settings thumbnails); sizes stay with each. A light wallpaper is
 * marked by a "light" ancestor class or the app's tone attribute.
 */
export const faceStyles = css`
  .face-filters {
    position: absolute;
    width: 0;
    height: 0;
  }

  .face-filters .ink {
    flood-color: currentColor;
  }

  .t.bold {
    font-weight: 600;
    letter-spacing: -0.05em;
  }

  .t.serif {
    font-family: ui-serif, 'New York', 'Iowan Old Style', Georgia, serif;
    font-weight: 400;
    letter-spacing: -0.02em;
  }

  .t.stacked {
    display: grid;
    font-weight: 700;
    line-height: 0.84;
    letter-spacing: -0.05em;
  }

  .t.outline {
    font-weight: 500;
    text-shadow: none;
    filter: url(#face-outline);
  }

  .t.glass {
    font-weight: 720;
    font-variation-settings: 'opsz' 144;
    letter-spacing: -0.035em;
    text-shadow: none;
    filter: url(#face-glass);
  }

  :host-context([tone='light']) .t.glass,
  .light .t.glass {
    filter: url(#face-glass-light);
  }

  .t.rounded {
    font-weight: 740;
    letter-spacing: -0.03em;
    filter: url(#face-round);
  }

  /* Too small to melt: a thumbnail just shows the heavy weight. */
  .thumb .t.rounded {
    filter: none;
  }

  .t.duo {
    letter-spacing: -0.03em;
  }

  .t.duo .hh {
    font-weight: 760;
  }

  .t.duo .sep {
    font-weight: 300;
    opacity: 0.5;
  }

  .t.duo .mm {
    font-weight: 150;
  }

  .t.tall {
    display: inline-block;
    font-weight: 330;
    letter-spacing: -0.07em;
    transform: scaleY(1.5);
    margin-block: 0.24em;
  }

  .t .pixel {
    display: block;
    height: 0.6em;
    margin: 0.08em 0 0.1em;
  }

  .t .analog {
    display: block;
    width: 1.55em;
    height: 1.55em;
    stroke: currentColor;
    stroke-linecap: round;
  }
`;

/**
 * Hours and minutes as the language writes them ("9:40", "21:40",
 * "21.40"), without AM/PM wherever the language puts it ("오후 9:40").
 */
export function clockText(now: Date, tag: string = locale()): string {
  const parts = new Intl.DateTimeFormat(tag, {
    hour: 'numeric',
    minute: '2-digit',
  }).formatToParts(now);
  const hour = parts.findIndex(part => part.type === 'hour');
  const minute = parts.findIndex(part => part.type === 'minute');
  if (hour < 0 || minute < 0) return '';
  const between = parts
    .slice(Math.min(hour, minute) + 1, Math.max(hour, minute))
    .map(part => (part.type === 'literal' ? part.value.trim() : ''))
    .join('');
  return `${parts[hour]!.value}${between || ':'}${parts[minute]!.value}`;
}

/** "7:42" -> ["07", "42"]: stacked faces read better with two digits. */
export function splitTime(time: string): [string, string] {
  const [hours = '', minutes = ''] = time.split(/\D+/);
  return [hours.padStart(2, '0'), minutes];
}

/**
 * The 8-bit face: digits from a 5×7 bitmap drawn for Tarn, one SVG path,
 * pixels a touch smaller than their cell, like a low-res screen. The separator
 * (":" or "." depending on the locale) becomes the two-dot colon.
 */
export function pixelTime(time: string) {
  let d = '';
  let x = 0;
  for (const char of time) {
    const rows = DIGITS[char] ?? (/[:.]/.test(char) ? COLON : null);
    if (!rows) continue;
    const width = rows[0]?.length ?? 1;
    rows.forEach((row, y) => {
      for (let col = 0; col < width; col++) {
        if (row[col] === '1') d += `M${x + col} ${y}h.9v.9h-.9z`;
      }
    });
    x += width + 1;
  }
  return html`<svg
    class="pixel"
    viewBox="0 0 ${Math.max(x - 1, 1)} 7"
    role="img"
    aria-label=${time}
  >
    ${svg`<path d=${d} fill="currentColor" />`}
  </svg>`;
}

const COLON = ['0', '0', '1', '0', '1', '0', '0'];

const DIGITS: Record<string, readonly string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};
