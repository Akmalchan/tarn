/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Keyboard shortcuts on the new tab (docs/architecture.md, "Keyboard").
 * Single keys, only while no text field has the cursor, never with Ctrl,
 * Cmd or Alt, so the browser's own shortcuts always win.
 */
export type Shortcut =
  | {kind: 'search'}
  | {kind: 'site'; number: number}
  | {kind: 'timer'}
  | {kind: 'notes'}
  | {kind: 'settings'}
  | {kind: 'help'};

/** The parts of a keydown that decide a shortcut. */
export interface KeyPress {
  key: string;
  /** The physical key, for letters typed in another alphabet. */
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing: boolean;
}

export function shortcutFor(press: KeyPress): Shortcut | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null;
  if (press.repeat || press.isComposing) return null;
  // On a Russian or Korean layout the T key types another letter; the
  // physical key still counts.
  const key = /^[\x20-\x7e]$/.test(press.key)
    ? press.key
    : (/^Key([A-Z])$/.exec(press.code)?.[1]?.toLowerCase() ?? press.key);
  if (key >= '1' && key <= '9' && key.length === 1) {
    return {kind: 'site', number: Number(key)};
  }
  switch (key) {
    case '/':
      return {kind: 'search'};
    case 't':
    case 'T':
      return {kind: 'timer'};
    case 'n':
    case 'N':
      return {kind: 'notes'};
    case ',':
      return {kind: 'settings'};
    case '?':
      return {kind: 'help'};
    default:
      return null;
  }
}

/** Whether the key went to something the user types in. */
export function isTyping(event: Event): boolean {
  const target = event.composedPath()[0];
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(
    target.type,
  );
}

/** The list the help sheet and the settings panel show, in this order. */
export const SHORTCUT_LIST = [
  {keys: ['/'], label: 'keys.search'},
  {keys: ['1', '–', '9'], label: 'keys.sites'},
  {keys: ['T'], label: 'keys.timer'},
  {keys: ['N'], label: 'keys.notes'},
  {keys: [','], label: 'keys.settings'},
  {keys: ['?'], label: 'keys.help'},
  {keys: ['Esc'], label: 'keys.leave'},
] as const;
