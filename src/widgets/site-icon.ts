/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Site icons from Chrome's own icon cache (the favicon permission): no
// network request. When Chrome has no icon for a page it returns a generic
// globe; Tarn recognizes that globe and shows a letter tile instead.

const iconUrl = (pageUrl: string) =>
  `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=64`;

/**
 * What each site's lookup found last time, read synchronously so a page can
 * show icons in its first frame; refreshed in the background.
 */
const KNOWN_KEY = 'tarn.icons';
type KnownIcons = Record<string, string | null>;
let lastFound: KnownIcons | null = null;

function knownIcons(): KnownIcons {
  if (lastFound) return lastFound;
  let icons: KnownIcons = {};
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWN_KEY) ?? '{}') as unknown;
    if (typeof raw === 'object' && raw !== null) icons = raw as KnownIcons;
  } catch {
    // Unreadable: start fresh.
  }
  lastFound = icons;
  return icons;
}

/**
 * The icon found last time: a URL, null for a letter tile, or undefined if
 * this site was never looked up.
 */
export function lastSiteIcon(pageUrl: string): string | null | undefined {
  const value = knownIcons()[pageUrl];
  return typeof value === 'string' || value === null ? value : undefined;
}

function rememberIcon(pageUrl: string, src: string | null): void {
  const icons = knownIcons();
  if (icons[pageUrl] === src) return;
  icons[pageUrl] = src;
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(icons));
  } catch {
    // Blocked storage: icons just appear a few ms later.
  }
}

/** The globe Chrome returns for a page it knows nothing about. */
let globe: Promise<string | null> | null = null;
const cache = new Map<string, Promise<string | null>>();

/**
 * Resolves to an image URL for the site's real icon, or null when Chrome
 * only has the globe (never visited, or Firefox). Tries the exact page, then
 * the site's home page, since Chrome stores icons per visited page.
 */
export function siteIcon(pageUrl: string): Promise<string | null> {
  if (import.meta.env.FIREFOX) return Promise.resolve(null);
  let result = cache.get(pageUrl);
  if (!result) {
    result = findIcon(pageUrl).then(src => {
      rememberIcon(pageUrl, src);
      return src;
    });
    cache.set(pageUrl, result);
  }
  return result;
}

async function findIcon(pageUrl: string): Promise<string | null> {
  globe ??= fingerprint(iconUrl('https://tarn-no-icon.invalid/'));
  const known = await globe;
  const url = new URL(pageUrl);
  const candidates = [
    pageUrl,
    `${url.origin}/`,
    url.hostname.startsWith('www.')
      ? null
      : `${url.protocol}//www.${url.hostname}/`,
  ];
  for (const candidate of new Set(candidates)) {
    if (!candidate) continue;
    const src = iconUrl(candidate);
    const print = await fingerprint(src);
    if (print && print !== known) return src;
  }
  return null;
}

/** A small hash of the decoded image, enough to tell two icons apart. */
async function fingerprint(src: string): Promise<string | null> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const canvas = new OffscreenCanvas(16, 16);
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) return null;
  context.drawImage(image, 0, 0, 16, 16);
  let hash = 2166136261;
  for (const value of context.getImageData(0, 0, 16, 16).data) {
    hash = Math.imul(hash ^ value, 16777619);
  }
  return `${image.naturalWidth}:${hash >>> 0}`;
}

/** A calm color for a site's letter tile, the same every time. */
export function siteHue(host: string): number {
  let hash = 0;
  for (const char of host) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}
