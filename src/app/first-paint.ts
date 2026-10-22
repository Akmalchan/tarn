/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// How a new tab arrives on screen. Smoothness over speed:
//
// - Opening a tab: the browser shows its own new-tab color for a few frames
//   before any extension can draw. Tarn's first frame is that same color
//   (the browser default, global.css), then the live scene eases in.
// - Reloading: the browser keeps the old page on screen until the new one
//   paints real content. Tarn paints nothing real until its first live frame,
//   which continues the animation from the exact moment the old page left
//   off. Chrome still presents one frame of the new page before that (a page
//   cannot hold its first paint for async work), so that one frame shows a
//   ghost: a small still of the scene, taken at the moment the live scene
//   resumes from. It is stored as raw pixels and written into a <canvas>
//   synchronously, before the first paint: no image decode, and a canvas is
//   one GPU texture, so it can never appear half drawn (a full-screen CSS
//   background is rastered in tiles and can show a "split" frame).
//
// Extension storage is async, so the little that this needs is mirrored into
// synchronous Web Storage: localStorage for things shared by all tabs,
// sessionStorage (per tab, in memory, survives reload) for the ghost. Keep
// this module dependency-free: it is bundled into the blocking script.

import type {GhostFrame} from '../backdrop/renderer';
import {fromBase64} from './codec';
import {applyAppearance, surfacesDark} from '../ui/appearance';
import {AUTO_SCENE, sceneFor} from '../backdrop/scenes/ids';
import {readText, writeText} from './web-storage';

const SCENE_KEY = 'tarn.scene';
const ENABLED_KEY = 'tarn.enabled';
const CLOCK_KEY = 'tarn.clock';
/** Cached tinted icons, one per color scheme (v2: translucent tint). */
const FAVICON_KEYS = {
  dark: 'tarn.favicon.dark.v2',
  light: 'tarn.favicon.light.v2',
} as const;

/**
 * Chrome draws its own new-tab icon in the tab's text color, which blends
 * with the browser theme. Extensions can't read that color, so the icon is
 * tinted with translucent white (dark mode) or black (light mode) instead:
 * the tab color shows through, so it softens into any theme the same way.
 */
const FAVICON_TINTS = {
  dark: 'rgb(255 255 255 / 0.72)',
  light: 'rgb(0 0 0 / 0.62)',
} as const;
const TAB_ICON_KEY = 'tarn.tabIcon';
/** The user's own tab icon (a small PNG data URL), on this computer only. */
export const CUSTOM_TAB_ICON_KEY = 'tarn.tabIcon.custom';
const GHOST_KEY = 'tarn.ghost';
const GHOST_ID = 'tarn-ghost';
/** Largest ghost accepted from storage, in pixels per side. */
const GHOST_MAX_SIDE = 512;
const BASE_KEY = 'tarn.base';

/** How long a saved animation moment stays worth continuing from. */
const CLOCK_RESUME_WINDOW_MS = 30 * 60 * 1000;

/**
 * No tab icon: an empty SVG, which draws nothing and needs no fetch. (Chrome
 * still shows the packaged ta icon for the split second before a page
 * exists, when opening or reloading; the owner chose that so Chrome's side
 * panel header, which uses the same packaged icon, isn't blank.)
 */
const NO_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>";

/** Chrome's own icon for its new tab page, served by the favicon API. */
const NEW_TAB_ICON = `/_favicon/?pageUrl=${encodeURIComponent('chrome://new-tab-page/')}&size=32`;

/**
 * The browser's default new-tab colors, measured from Chrome 154 and
 * Firefox's about:newtab: the first frame matches what the browser just
 * showed, so the hand-over has no edge.
 */
const START_COLORS = import.meta.env.FIREFOX
  ? {light: '#f9f9fb', dark: '#2b2a33'}
  : {light: '#ffffff', dark: '#3c3c3c'};

/** Opening a new tab, or coming back to the same page (reload, back). */
export type Arrival = 'open' | 'resume';

/**
 * Runs in the blocking first-paint script, before anything is drawn. Uses
 * inline styles only, so it never depends on when a stylesheet arrives.
 */
export function prepareFirstPaint(): void {
  // Menus and sheets in the chosen light or dark mode from the first frame.
  applyAppearance();
  const root = document.documentElement;
  const style = root.style;
  root.dataset.arrival = detectArrival();
  style.backgroundColor = prefersDark()
    ? START_COLORS.dark
    : START_COLORS.light;
  if (root.dataset.arrival === 'resume') {
    const ghost = rememberedGhost();
    const base = ghost?.color ?? readText(BASE_KEY);
    if (base) style.backgroundColor = base;
    if (ghost) {
      paintGhost(ghost);
      // Hand the painted ghost's exact moment to the live scene. Re-reading
      // storage later could pick up a newer ghost the old page wrote at the
      // last second, and then ghost and first live frame would not match.
      root.dataset.ghostClock = String(ghost.clock);
    }
  }
  const tabIcon = readText(TAB_ICON_KEY);
  const custom = tabIcon === 'custom' ? readText(CUSTOM_TAB_ICON_KEY) : null;
  if (tabIcon === 'none') {
    setFavicon(NO_ICON);
  } else if (custom) {
    setFavicon(custom);
  } else {
    const cached = readText(FAVICON_KEYS[scheme()]);
    if (cached) setFavicon(cached);
  }
}

export function rememberTabIcon(icon: string): void {
  writeText(TAB_ICON_KEY, icon);
}

/** The moment of the ghost this page painted on reload, if any. */
export function paintedGhostClock(): number | undefined {
  const value = Number(document.documentElement.dataset.ghostClock);
  return Number.isFinite(value) && document.documentElement.dataset.ghostClock
    ? value
    : undefined;
}

export function arrival(): Arrival {
  return document.documentElement.dataset.arrival === 'resume'
    ? 'resume'
    : 'open';
}

function detectArrival(): Arrival {
  const [entry] = performance.getEntriesByType('navigation') as
    PerformanceNavigationTiming[] | [];
  return entry?.type === 'reload' || entry?.type === 'back_forward'
    ? 'resume'
    : 'open';
}

/** A saved ghost frame: raw RGB pixels, the moment shown, its mean color. */
export interface Ghost {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  readonly clock: number;
  readonly color: string;
}

/** The ghost frame for the current scene in this tab, if one was saved. */
export function rememberedGhost(): Ghost | null {
  const raw = readText(GHOST_KEY, 'session');
  if (!raw) return null;
  try {
    const {scene, width, height, clock, color, data} = JSON.parse(raw) as {
      [key: string]: unknown;
    };
    const valid =
      scene === shownRememberedScene() &&
      isSide(width) &&
      isSide(height) &&
      typeof clock === 'number' &&
      Number.isFinite(clock) &&
      typeof color === 'string' &&
      /^#[0-9a-f]{6}$/.test(color) &&
      typeof data === 'string';
    if (!valid) return null;
    const pixels = fromBase64(data);
    if (pixels.length !== width * height * 3) return null;
    return {width, height, pixels, clock, color};
  } catch {
    return null;
  }
}

/** Keeps the renderer's ghost (pixels already base64) for this tab's reload. */
export function rememberGhost(scene: string, ghost: GhostFrame): void {
  writeText(GHOST_KEY, JSON.stringify({scene, ...ghost}), 'session');
}

/** Draws the ghost into a full-screen canvas, synchronously. */
function paintGhost(ghost: Ghost): void {
  const canvas = document.createElement('canvas');
  canvas.id = GHOST_ID;
  canvas.width = ghost.width;
  canvas.height = ghost.height;
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none';
  // CPU-backed on purpose: a GPU-accelerated canvas can miss the very first
  // frame while its context starts; a CPU bitmap ships with the first commit.
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) return;
  const image = context.createImageData(ghost.width, ghost.height);
  const {data} = image;
  for (let i = 0, j = 0; j < ghost.pixels.length; i += 4, j += 3) {
    data[i] = ghost.pixels[j]!;
    data[i + 1] = ghost.pixels[j + 1]!;
    data[i + 2] = ghost.pixels[j + 2]!;
    data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  // Before <body> exists: a child of <html>, painted beneath everything.
  document.documentElement.append(canvas);
}

/** Drops the ghost once the live scene has taken over. */
export function releaseGhost(): void {
  document.getElementById(GHOST_ID)?.remove();
}

function isSide(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) > 0 &&
    Number(value) <= GHOST_MAX_SIDE
  );
}

/** The scene shown last time, so the first frame is already the right one. */
export function rememberedScene(): string | null {
  return readText(SCENE_KEY);
}

/** The remembered scene as shown: `auto` resolved for light or dark. */
function shownRememberedScene(): string | null {
  const scene = rememberedScene();
  return scene === AUTO_SCENE ? sceneFor(scene, surfacesDark()) : scene;
}

export function rememberScene(id: string): void {
  writeText(SCENE_KEY, id);
}

/** The scene's flat base color, the reload fallback when no ghost exists. */
export function rememberBase(color: string): void {
  writeText(BASE_KEY, color);
}

/** True only if Tarn was explicitly switched off; unknown means on. */
export function isRememberedOff(): boolean {
  return readText(ENABLED_KEY) === 'false';
}

export function rememberEnabled(enabled: boolean): void {
  writeText(ENABLED_KEY, String(enabled));
}

/** Saves the animation moment shown right now (seconds, wall time in ms). */
export function rememberClock(clock: number, at = Date.now()): void {
  writeText(CLOCK_KEY, JSON.stringify({clock, at}));
}

/**
 * Where the animation should continue from: the last saved moment plus the
 * time since, so motion carries on across reloads and tabs. Undefined when
 * nothing recent was saved.
 */
export function resumeClock(now = Date.now()): number | undefined {
  const raw = readText(CLOCK_KEY);
  if (!raw) return undefined;
  try {
    const {clock, at} = JSON.parse(raw) as {clock?: unknown; at?: unknown};
    if (typeof clock !== 'number' || typeof at !== 'number') return undefined;
    const elapsed = now - at;
    if (!Number.isFinite(clock) || elapsed < 0) return undefined;
    if (elapsed > CLOCK_RESUME_WINDOW_MS) return undefined;
    return clock + elapsed / 1000;
  } catch {
    return undefined;
  }
}

/**
 * Shows the chosen tab icon: Chrome's own new-tab icon, tinted to blend with
 * the browser theme (FAVICON_TINTS), computed once per scheme and cached
 * (bump FAVICON_KEYS' version to recompute after changing the tint).
 */
export async function refreshFavicon(icon: string): Promise<void> {
  if (icon === 'none') {
    setFavicon(NO_ICON);
    return;
  }
  const custom = icon === 'custom' ? readText(CUSTOM_TAB_ICON_KEY) : null;
  if (custom) {
    setFavicon(custom);
    return;
  }
  if (import.meta.env.FIREFOX) return;
  const current = scheme();
  const cached = readText(FAVICON_KEYS[current]);
  if (cached) {
    setFavicon(cached);
    return;
  }
  try {
    const blob = await (await fetch(NEW_TAB_ICON)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    // Keep the shape, replace the color: alpha multiplies, so the tint's own
    // transparency carries into the icon.
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = FAVICON_TINTS[current];
    context.fillRect(0, 0, canvas.width, canvas.height);
    const tinted = await blobToDataUrl(
      await canvas.convertToBlob({type: 'image/png'}),
    );
    writeText(FAVICON_KEYS[current], tinted);
    setFavicon(tinted);
  } catch {
    // Keep whatever icon is showing.
  }
}

function setFavicon(href: string): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (link && link.href !== href) link.href = href;
}

function prefersDark(): boolean {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function scheme(): 'dark' | 'light' {
  return prefersDark() ? 'dark' : 'light';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
