/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {html} from 'lit';
import {t} from '../i18n';
import type {MessageKey} from '../i18n/messages/en';

/**
 * Keyboard shortcuts on the new tab (docs/architecture.md, "Keyboard").
 * Only the ones people already know from other apps: Cmd/Ctrl+K or / to
 * search (Slack, Linear, GitHub; Google, YouTube), ? for the list (Gmail,
 * GitHub), Esc to leave. Bookmarks take Alt/Option + 1-9: Cmd/Ctrl + 1-9
 * switch tabs, and a bare number is too easy to press by accident.
 */
export type Shortcut =
  {kind: 'search'} | {kind: 'site'; number: number} | {kind: 'help'};

/** The parts of a keydown that decide a shortcut. */
export interface KeyPress {
  key: string;
  /** The physical key: Option + 1 types "¡" on a Mac. */
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
}

export function shortcutFor(press: KeyPress, mac = IS_MAC): Shortcut | null {
  if (press.repeat || press.isComposing) return null;
  const command = mac ? press.metaKey : press.ctrlKey;
  const other = mac ? press.ctrlKey : press.metaKey;
  if (other) return null;
  if (command) {
    return !press.altKey && !press.shiftKey && press.code === 'KeyK'
      ? {kind: 'search'}
      : null;
  }
  if (press.altKey) {
    const digit = /^Digit([1-9])$/.exec(press.code)?.[1];
    return digit && !press.shiftKey
      ? {kind: 'site', number: Number(digit)}
      : null;
  }
  if (press.key === '/') return {kind: 'search'};
  if (press.key === '?') return {kind: 'help'};
  return null;
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

const IS_MAC = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');

/** One way to press a shortcut: its keys, as shown on the keycaps. */
export type Chord = readonly string[];

export interface ShortcutRow {
  /** Alternatives, shown with "or" between them. */
  chords: readonly Chord[];
  label: MessageKey;
}

/** The list the ? sheet and the settings panel show, in this platform's keys. */
export function shortcutList(mac = IS_MAC): readonly ShortcutRow[] {
  const command = mac ? '⌘' : 'Ctrl';
  const alt = mac ? '⌥' : 'Alt';
  return [
    {chords: [[command, 'K'], ['/']], label: 'keys.search'},
    {chords: [[alt, '1–9']], label: 'keys.sites'},
    {chords: [['?']], label: 'keys.help'},
    {chords: [['Esc']], label: 'keys.leave'},
  ];
}

/** A row's keycaps, with "or" between the alternatives. */
export function chordKeys(row: ShortcutRow) {
  return row.chords.map(
    (chord, index) =>
      html`${
        index ? html`<span class="or">${t('keys.or')}</span>` : ''
      }${chord.map(key => html`<kbd>${key}</kbd>`)}`,
  );
}
