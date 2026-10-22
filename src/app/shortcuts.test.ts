/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, describe, expect, it} from 'vitest';
import {useLanguage} from '../i18n';
import {
  isComposing,
  keyName,
  shortcutFor,
  shortcutList,
  type KeyPress,
} from './shortcuts';

const press = (key: string, code: string, extra: Partial<KeyPress> = {}) =>
  ({
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    ...extra,
  }) satisfies KeyPress;

describe('shortcutFor', () => {
  it('searches with Cmd+K on a Mac and Ctrl+K elsewhere, or /', () => {
    const k = press('k', 'KeyK');
    expect(shortcutFor({...k, metaKey: true}, true)).toEqual({kind: 'search'});
    expect(shortcutFor({...k, ctrlKey: true}, false)).toEqual({
      kind: 'search',
    });
    expect(shortcutFor({...k, ctrlKey: true}, true)).toBeNull();
    expect(shortcutFor({...k, metaKey: true}, false)).toBeNull();
    expect(shortcutFor(press('/', 'Slash'))).toEqual({kind: 'search'});
  });

  it('finds K by its physical key in other alphabets', () => {
    expect(shortcutFor(press('л', 'KeyK', {ctrlKey: true}), false)).toEqual({
      kind: 'search',
    });
  });

  it('opens bookmarks with Alt or Option + 1 to 9', () => {
    expect(shortcutFor(press('¡', 'Digit1', {altKey: true}), true)).toEqual({
      kind: 'site',
      number: 1,
    });
    expect(shortcutFor(press('9', 'Digit9', {altKey: true}), false)).toEqual({
      kind: 'site',
      number: 9,
    });
    expect(shortcutFor(press('0', 'Digit0', {altKey: true}))).toBeNull();
  });

  it('leaves bare numbers and letters alone', () => {
    expect(shortcutFor(press('1', 'Digit1'))).toBeNull();
    expect(shortcutFor(press('t', 'KeyT'))).toBeNull();
    expect(shortcutFor(press('k', 'KeyK'))).toBeNull();
  });

  it("leaves the browser's own shortcuts alone", () => {
    expect(shortcutFor(press('1', 'Digit1', {metaKey: true}), true)).toBeNull();
    expect(
      shortcutFor(press('1', 'Digit1', {ctrlKey: true}), false),
    ).toBeNull();
    expect(
      shortcutFor(press('K', 'KeyK', {ctrlKey: true, shiftKey: true}), false),
    ).toBeNull();
  });

  it('shows the list with ?, and ignores held keys', () => {
    expect(shortcutFor(press('?', 'Slash', {shiftKey: true}))).toEqual({
      kind: 'help',
    });
    expect(shortcutFor(press('/', 'Slash', {repeat: true}))).toBeNull();
  });
});

describe('shortcutList', () => {
  afterEach(() => useLanguage('en'));

  it("names this platform's keys", () => {
    expect(shortcutList(true)[0]!.chords[0]).toEqual(['⌘', 'K']);
    expect(shortcutList(false)[0]!.chords[0]).toEqual(['Ctrl', 'K']);
  });

  it('names the keys as the language labels them, off a Mac', async () => {
    await useLanguage('de');
    expect(shortcutList(false)[0]!.chords[0]).toEqual(['Strg', 'K']);
    expect(keyName('shift', false)).toBe('Umschalt');
    expect(keyName('shift', true)).toBe('⇧');
    await useLanguage('fr');
    expect(keyName('esc', false)).toBe('Échap');
  });
});

describe('isComposing', () => {
  const key = (isComposing: boolean, keyCode: number) =>
    ({key: 'Enter', isComposing, keyCode}) as KeyboardEvent;

  it('skips the Enter that picks an input-method candidate', () => {
    expect(isComposing(key(true, 229))).toBe(true);
    expect(isComposing(key(true, 13))).toBe(true);
    // Safari reports the commit Enter after compositionend, with 229.
    expect(isComposing(key(false, 229))).toBe(true);
    expect(isComposing(key(false, 13))).toBe(false);
  });
});
