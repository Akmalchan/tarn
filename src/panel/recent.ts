/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

/**
 * What the settings home shows on its Wallpaper and Clock cards: the
 * user's most recent picks, on this computer (localStorage; photos are per
 * computer anyway). Picking one already on the card changes nothing, so
 * tiles never jump under the pointer; a pick from "Show All" goes first.
 */

const KEYS = {scenes: 'tarn.recent.scenes', faces: 'tarn.recent.faces'};
const KEEP = 8;

export type RecentList = keyof typeof KEYS;

/**
 * The recent list after picking `id`, given what the card shows now. A pick
 * already on the card keeps the card as it is; any other goes first.
 */
export function bump(
  card: readonly string[],
  recent: readonly string[],
  id: string,
): string[] {
  const front = card.includes(id) ? card : [id, ...card];
  const rest = recent.filter(item => !front.includes(item));
  return [...front, ...rest].slice(0, KEEP);
}

/**
 * The card's `count` entries: recent picks that still exist, then
 * `defaults`, always including `current` (it takes the last place).
 */
export function picks(
  recent: readonly string[],
  defaults: readonly string[],
  count: number,
  current: string,
  exists: (id: string) => boolean,
): string[] {
  const shown: string[] = [];
  for (const id of [...recent, ...defaults]) {
    if (shown.length === count) break;
    if (exists(id) && !shown.includes(id)) shown.push(id);
  }
  if (!exists(current) || shown.includes(current)) return shown;
  return [...shown.slice(0, count - 1), current];
}

export function readRecent(list: RecentList): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS[list]) ?? '[]') as unknown;
    return Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === 'string').slice(0, KEEP)
      : [];
  } catch {
    return [];
  }
}

export function writeRecent(list: RecentList, ids: readonly string[]): void {
  try {
    localStorage.setItem(KEYS[list], JSON.stringify(ids));
  } catch {
    // Blocked storage: the cards show the defaults.
  }
}
