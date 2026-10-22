/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
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

/**
 * Whether the key belongs to an input method still composing (Japanese,
 * Chinese, Korean): its Enter picks a candidate, its Escape cancels it.
 * 229 is what Chrome and Safari report for those keys.
 */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}

const IS_MAC = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');

/** One way to press a shortcut: its keys, as shown on the keycaps. */
export type Chord = readonly string[];

export interface ShortcutRow {
  /** Alternatives, shown with "or" between them. */
  chords: readonly Chord[];
  label: MessageKey;
}

/**
 * A key as this computer's keyboard labels it: symbols on a Mac, the
 * language's own names elsewhere (German keyboards say Strg, Umschalt).
 * `command` is Cmd on a Mac and Ctrl elsewhere.
 */
export function keyName(
  key: 'command' | 'alt' | 'shift' | 'esc',
  mac = IS_MAC,
): string {
  if (mac && key !== 'esc') {
    return {command: '⌘', alt: '⌥', shift: '⇧'}[key];
  }
  return t(key === 'command' ? 'keys.ctrl' : `keys.${key}`);
}

/** The list the ? sheet and the settings panel show, in this platform's keys. */
export function shortcutList(mac = IS_MAC): readonly ShortcutRow[] {
  return [
    {chords: [[keyName('command', mac), 'K'], ['/']], label: 'keys.search'},
    {chords: [[keyName('alt', mac), '1–9']], label: 'keys.sites'},
    {chords: [['?']], label: 'keys.help'},
    {chords: [[keyName('esc', mac)]], label: 'keys.leave'},
  ];
}

/** A row's keycaps: "+" inside a chord, "or" between alternatives. */
export function chordKeys(row: ShortcutRow) {
  return row.chords.map(
    (chord, index) =>
      html`${
        index ? html`<span class="or">${t('keys.or')}</span>` : ''
      }${chord.map(
        (key, n) =>
          html`${n ? html`<span class="plus">+</span>` : ''}<kbd>${key}</kbd>`,
      )}`,
  );
}
