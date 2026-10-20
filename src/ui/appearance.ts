/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Settings > Advanced > Appearance: whether Tarn's surfaces (the panel,
// sheets, the guide, the popup, the search box's Auto look) are light or
// dark. Auto follows the system. The wallpaper and what sits on it keep the
// scene's own tone. Colors are written as light-dark() pairs, so the one
// root `color-scheme` set here decides them all, through shadow roots too.

export type Appearance = 'auto' | 'light' | 'dark';
export const APPEARANCES: readonly Appearance[] = ['auto', 'light', 'dark'];

/** A copy in localStorage, so every page starts in the right mode. */
const KEY = 'tarn.appearance';

export function rememberedAppearance(): Appearance {
  try {
    const value = localStorage.getItem(KEY);
    return APPEARANCES.includes(value as Appearance)
      ? (value as Appearance)
      : 'auto';
  } catch {
    return 'auto';
  }
}

/** Keeps the copy for the next page (called where settings are mirrored). */
export function rememberAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(KEY, appearance);
  } catch {
    // Blocked storage: pages start in Auto, then catch up.
  }
}

/** Puts this page in the mode. */
export function applyAppearance(
  appearance: Appearance = rememberedAppearance(),
): void {
  document.documentElement.style.colorScheme =
    appearance === 'auto' ? 'light dark' : appearance;
}

/** Whether surfaces are dark right now (for pictures picked in code). */
export function surfacesDark(
  appearance: Appearance = rememberedAppearance(),
): boolean {
  if (appearance !== 'auto') return appearance === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
