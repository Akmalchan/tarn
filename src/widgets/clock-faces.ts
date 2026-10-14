/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {html, svg} from 'lit';
import {locale} from '../i18n';
import type {ClockStyle} from '../settings/schema';

/**
 * How each clock face draws the time, shared by the clock on the tab and
 * the face thumbnails in settings, so a thumbnail is a true small copy.
 * Sizes come from the caller's CSS; nothing here loads a font.
 */
export function clockTime(face: ClockStyle, time: string) {
  if (face === 'pixel') return pixelTime(time);
  if (face === 'stacked') {
    const [hours, minutes] = splitTime(time);
    return html`<span class="hh">${hours}</span
      ><span class="mm">${minutes}</span>`;
  }
  return time;
}

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
