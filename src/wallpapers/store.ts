/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The user's own wallpapers, kept on this computer in IndexedDB (never
 * synced, never sent anywhere). Each photo is stored three ways:
 *
 * - the original file, untouched, so nothing is lost;
 * - a display copy (WebP, at most 3840px on its long edge) that the
 *   background draws;
 * - a small thumbnail for settings, with the photo's mean color and tone.
 *
 * Metadata and images live in separate object stores, so listing photos
 * never loads the big images. Works in windows and workers alike (nothing
 * here touches the DOM at load time).
 *
 * First paint can't wait for IndexedDB, so a tiny index of every photo's
 * base color, tone and size is also kept in localStorage (`tarn.photos`),
 * readable synchronously by any page of the extension: `photoMirror()`.
 *
 * A photo is selected through the usual `scene` setting, as `photo:<id>`.
 */

export const PHOTO_PREFIX = 'photo:';

/** What settings needs to show a photo: everything but the big images. */
export interface WallpaperInfo {
  /** `photo:<uuid>`, the value the `scene` setting holds. */
  readonly id: string;
  /** From the file name, without its extension. */
  readonly name: string;
  readonly created: number;
  readonly width: number;
  readonly height: number;
  /** Mean color as #rrggbb: the base under the photo while it loads. */
  readonly base: string;
  readonly tone: 'light' | 'dark';
  readonly thumb: Blob;
}

interface WallpaperImages {
  readonly id: string;
  readonly display: Blob;
  readonly original: Blob;
}

/** Everything about one photo; what deleting returns, so it can be undone. */
export interface WallpaperRecord {
  readonly info: WallpaperInfo;
  readonly images: WallpaperImages;
}

const DB_NAME = 'tarn-wallpapers';
const INFO = 'info';
const IMAGES = 'images';
const DISPLAY_EDGE = 3840;
const THUMB_EDGE = 480;
/** Larger files are refused before decoding: likely not a photo. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** What first paint needs to know about a photo, synchronously. */
export interface PhotoMirrorEntry {
  readonly base: string;
  readonly tone: 'light' | 'dark';
  readonly w: number;
  readonly h: number;
}

const MIRROR_KEY = 'tarn.photos';

/**
 * Every photo's base color, tone and size, from localStorage: {} in a worker
 * or when nothing is stored. Never trusts the stored shape.
 */
export function photoMirror(): Record<string, PhotoMirrorEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(MIRROR_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, PhotoMirrorEntry> = {};
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      const e = v as Partial<PhotoMirrorEntry> | null;
      if (
        isPhotoId(id) &&
        e &&
        typeof e.base === 'string' &&
        /^#[0-9a-f]{6}$/i.test(e.base) &&
        (e.tone === 'light' || e.tone === 'dark') &&
        typeof e.w === 'number' &&
        typeof e.h === 'number'
      ) {
        out[id] = {base: e.base, tone: e.tone, w: e.w, h: e.h};
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeMirror(infos: readonly WallpaperInfo[]): void {
  if (typeof localStorage === 'undefined') return;
  const mirror: Record<string, PhotoMirrorEntry> = {};
  for (const {id, base, tone, width: w, height: h} of infos) {
    mirror[id] = {base, tone, w, h};
  }
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror));
  } catch {
    // Full storage only costs first paint its base color; the photo still
    // draws once it loads.
  }
}

/** Rebuilds the mirror from IndexedDB, the source of truth. */
async function syncMirror(): Promise<WallpaperInfo[]> {
  const db = await open();
  const all = await request<WallpaperInfo[]>(
    db.transaction(INFO).objectStore(INFO).getAll(),
  );
  writeMirror(all);
  return all;
}

export function isPhotoId(id: string): boolean {
  return /^photo:[\w-]{8,64}$/.test(id);
}

/**
 * Decodes an image file and saves it. Throws an Error with a message fit
 * to show the user when the file can't be used.
 */
export async function addWallpaper(file: File): Promise<WallpaperInfo> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file isn’t an image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That image is too large (over 50 MB).');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
  } catch {
    throw new Error('That image couldn’t be opened.');
  }
  try {
    const {width, height} = bitmap;
    const [display, thumb] = await Promise.all([
      encode(bitmap, DISPLAY_EDGE, 0.92),
      encode(bitmap, THUMB_EDGE, 0.8),
    ]);
    const base = meanColor(bitmap);
    const info: WallpaperInfo = {
      id: PHOTO_PREFIX + crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Photo',
      created: Date.now(),
      width,
      height,
      base,
      tone: toneOf(base),
      thumb,
    };
    await put({info, images: {id: info.id, display, original: file}});
    await syncMirror();
    return info;
  } finally {
    bitmap.close();
  }
}

/**
 * The user's photos, newest first, without the big images. Also refreshes
 * the localStorage mirror, so it heals if it was cleared.
 */
export async function listWallpapers(): Promise<WallpaperInfo[]> {
  const all = await syncMirror();
  return all.sort((a, b) => b.created - a.created);
}

export async function getWallpaperInfo(
  id: string,
): Promise<WallpaperInfo | null> {
  const db = await open();
  const info = await request<WallpaperInfo | undefined>(
    db.transaction(INFO).objectStore(INFO).get(id),
  );
  return info ?? null;
}

/** The copy the background draws, or null if this computer doesn't have it. */
export async function getWallpaperImage(id: string): Promise<Blob | null> {
  const db = await open();
  const images = await request<WallpaperImages | undefined>(
    db.transaction(IMAGES).objectStore(IMAGES).get(id),
  );
  return images?.display ?? null;
}

/** Deletes a photo and returns it, so the deletion can be undone. */
export async function deleteWallpaper(
  id: string,
): Promise<WallpaperRecord | null> {
  const db = await open();
  const tx = db.transaction([INFO, IMAGES], 'readwrite');
  const [info, images] = await Promise.all([
    request<WallpaperInfo | undefined>(tx.objectStore(INFO).get(id)),
    request<WallpaperImages | undefined>(tx.objectStore(IMAGES).get(id)),
  ]);
  tx.objectStore(INFO).delete(id);
  tx.objectStore(IMAGES).delete(id);
  await done(tx);
  await syncMirror();
  return info && images ? {info, images} : null;
}

/** Puts a deleted photo back (Undo). */
export async function restoreWallpaper(record: WallpaperRecord): Promise<void> {
  await put(record);
  await syncMirror();
}

// IndexedDB plumbing ------------------------------------------------------

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(INFO, {keyPath: 'id'});
      req.result.createObjectStore(IMAGES, {keyPath: 'id'});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('Couldn’t open wallpaper storage.'));
    };
  });
  return opening;
}

async function put({info, images}: WallpaperRecord): Promise<void> {
  const db = await open();
  const tx = db.transaction([INFO, IMAGES], 'readwrite');
  tx.objectStore(IMAGES).put(images);
  tx.objectStore(INFO).put(info);
  await done(tx);
}

function request<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Saving was cancelled.'));
  });
}

// Image work ----------------------------------------------------------------

/** Scales down (never up) to fit `edge`, as WebP. */
function encode(
  bitmap: ImageBitmap,
  edge: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('That image couldn’t be processed.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({type: 'image/webp', quality});
}

/** The photo's average color, from a 16×16 copy. */
function meanColor(bitmap: ImageBitmap): string {
  const canvas = new OffscreenCanvas(16, 16);
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) return '#000000';
  context.drawImage(bitmap, 0, 0, 16, 16);
  const {data} = context.getImageData(0, 0, 16, 16);
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  const n = data.length / 4;
  const hex = (v: number) =>
    Math.round(v / n)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Light or dark, by the same luminance rule as the built-in scenes. */
function toneOf(hex: string): 'light' | 'dark' {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return luminance > 0.35 ? 'light' : 'dark';
}
