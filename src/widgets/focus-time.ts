/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

// The focus timer's times: how they're shown and what typing one accepts.

export const DEFAULT_MS = 25 * 60_000;
export const MIN_MS = 10_000;
export const MAX_MS = 9 * 60 * 60_000;
/** Longest text the time field takes: "9:00:00", or "540:00". */
const MAX_LENGTH = 8;

/** "25:00", or "1:30:00" past an hour. */
export function format(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * What the user typed as a length: "45" is minutes, "12:30" minutes and
 * seconds, "1:30:00" hours too; leading zeros are fine ("0009" is 9
 * minutes). Longer than 9 hours becomes 9 hours, shorter than 10 seconds
 * becomes 10 seconds. Null if it isn't a time, or is zero.
 */
export function parseDuration(text: string): number | null {
  // A colon left at the end ("25:") is just unfinished typing.
  const parts = text.trim().replace(/:+$/, '').split(':');
  if (parts.length > 3 || parts.some(p => !/^\d{1,8}$/.test(p))) return null;
  const [a, b, c] = parts.map(Number) as [number, number?, number?];
  const ms =
    parts.length === 1
      ? a * 60_000
      : parts.length === 2
        ? a * 60_000 + b! * 1000
        : a * 3_600_000 + b! * 60_000 + c! * 1000;
  if (ms <= 0) return null;
  return Math.min(Math.max(ms, MIN_MS), MAX_MS);
}

/**
 * Keeps only what a length can contain while typing: digits and colons
 * (a dot, comma or space counts as a colon), at most three parts.
 */
export function cleanDuration(text: string): string {
  const parts = text
    .replace(/[.,\s]/g, ':')
    .replace(/[^\d:]/g, '')
    .replace(/:{2,}/g, ':')
    .split(':');
  return parts.slice(0, 3).join(':').slice(0, MAX_LENGTH);
}
