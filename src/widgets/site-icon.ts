/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Site icons from Chrome's own icon cache (the favicon permission): no
// network request. When Chrome has no icon for a page it returns a generic
// globe; Tarn recognizes that globe and shows a letter tile instead.

const iconUrl = (pageUrl: string) =>
  `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=64`;

/** A site's icon, and whether it is light enough to vanish on a white chip. */
export interface FoundIcon {
  readonly src: string;
  /** Mostly white (GitHub, ChatGPT in a dark theme): shown on a dark chip. */
  readonly light: boolean;
}

/**
 * What each site's lookup found last time, read synchronously so a page can
 * show icons in its first frame; refreshed in the background.
 */
const KNOWN_KEY = 'tarn.icons';
type KnownIcons = Record<string, unknown>;
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
 * The icon found last time, null for a letter tile, or undefined if this
 * site was never looked up. Older pages stored just the image URL.
 */
export function lastSiteIcon(pageUrl: string): FoundIcon | null | undefined {
  const value = knownIcons()[pageUrl];
  if (value === null) return null;
  if (typeof value === 'string') return {src: value, light: false};
  if (typeof value === 'object') {
    const {src, light} = value as Record<string, unknown>;
    if (typeof src === 'string') return {src, light: light === true};
  }
  return undefined;
}

function rememberIcon(pageUrl: string, icon: FoundIcon | null): void {
  const icons = knownIcons();
  const value = icon && {src: icon.src, light: icon.light};
  if (JSON.stringify(icons[pageUrl]) === JSON.stringify(value)) return;
  icons[pageUrl] = value;
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(icons));
  } catch {
    // Blocked storage: icons just appear a few ms later.
  }
}

/** The globe Chrome returns for a page it knows nothing about. */
let globe: Promise<string | null> | null = null;
const cache = new Map<string, Promise<FoundIcon | null>>();

/**
 * Resolves to the site's real icon, or null when Chrome only has the globe
 * (never visited, or Firefox). Tries the exact page, then the site's home
 * page, since Chrome stores icons per visited page.
 */
export function siteIcon(pageUrl: string): Promise<FoundIcon | null> {
  if (import.meta.env.FIREFOX) return Promise.resolve(null);
  let result = cache.get(pageUrl);
  if (!result) {
    result = findIcon(pageUrl).then(icon => {
      rememberIcon(pageUrl, icon);
      return icon;
    });
    cache.set(pageUrl, result);
  }
  return result;
}

async function findIcon(pageUrl: string): Promise<FoundIcon | null> {
  globe ??= decode(iconUrl('https://tarn-no-icon.invalid/')).then(image =>
    image ? fingerprint(image) : null,
  );
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
    const image = await decode(src);
    if (image && fingerprint(image) !== known) {
      return {src, light: isLight(image)};
    }
  }
  return null;
}

async function decode(src: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/** A small hash of the decoded image, enough to tell two icons apart. */
function fingerprint(image: HTMLImageElement): string | null {
  const data = pixels(image, 16);
  if (!data) return null;
  let hash = 2166136261;
  for (const value of data) hash = Math.imul(hash ^ value, 16777619);
  return `${image.naturalWidth}:${hash >>> 0}`;
}

function pixels(
  image: CanvasImageSource,
  size: number,
): Uint8ClampedArray | null {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  return context.getImageData(0, 0, size, size).data;
}

/**
 * Whether an icon all but disappears on a white chip: its visible pixels,
 * laid over white, are (nearly) all white too. A white logo on clear
 * (GitHub, ChatGPT) is; a logo on its own white square isn't.
 */
export function isLight(image: CanvasImageSource): boolean {
  const data = pixels(image, 32);
  return data ? lightPixels(data) : false;
}

/** The test behind `isLight`, on raw RGBA pixels. */
export function lightPixels(data: ArrayLike<number>): boolean {
  let visible = 0;
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    if (alpha < 0.3) continue;
    visible++;
    const luminance =
      (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
    // How it looks over the white chip.
    if (alpha * luminance + (1 - alpha) < 0.8) ink++;
  }
  return visible >= 12 && ink < visible * 0.06;
}

/**
 * The user's own icon, from an image file: a 112px square (the chip at 2x),
 * as a small data URL. A photo fills the square; an image with clear parts
 * (a logo) sits inside it on white, or on dark if it is itself light.
 * Null if the file isn't an image a browser can read.
 */
export async function iconFromFile(file: Blob): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const image = await decode(url);
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const size = 112;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const sample = pixels(image, 32);
    const clear = sample ? hasClearParts(sample) : false;
    const {naturalWidth: w, naturalHeight: h} = image;
    if (clear) {
      context.fillStyle = sample && lightPixels(sample) ? DARK_CHIP : '#ffffff';
      context.fillRect(0, 0, size, size);
      // Like a site icon on its chip: contained, with a margin.
      const scale = (size * 0.74) / Math.max(w, h);
      const dw = w * scale;
      const dh = h * scale;
      context.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh);
    } else {
      // A photo: cover the square.
      const scale = size / Math.min(w, h);
      const dw = w * scale;
      const dh = h * scale;
      context.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh);
    }
    const webp = canvas.toDataURL('image/webp', 0.86);
    return webp.startsWith('data:image/webp')
      ? webp
      : canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The chip behind a light icon (also in tarn-favorites' styles). */
export const DARK_CHIP = '#22252c';

function hasClearParts(data: ArrayLike<number>): boolean {
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 200) clear++;
  return clear > data.length / 4 / 20;
}

/** A calm color for a site's letter tile, the same every time. */
export function siteHue(host: string): number {
  let hash = 0;
  for (const char of host) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}
