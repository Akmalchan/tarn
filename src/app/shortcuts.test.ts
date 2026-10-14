/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {describe, expect, it} from 'vitest';
import {shortcutFor, type KeyPress} from './shortcuts';

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  code: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  ...extra,
});

describe('shortcutFor', () => {
  it('maps the single keys', () => {
    expect(shortcutFor(press('/'))).toEqual({kind: 'search'});
    expect(shortcutFor(press('t'))).toEqual({kind: 'timer'});
    expect(shortcutFor(press('N'))).toEqual({kind: 'notes'});
    expect(shortcutFor(press(','))).toEqual({kind: 'settings'});
    expect(shortcutFor(press('?'))).toEqual({kind: 'help'});
  });

  it('finds letters by their physical key in other alphabets', () => {
    expect(shortcutFor(press('е', {code: 'KeyT'}))).toEqual({kind: 'timer'});
    expect(shortcutFor(press('ㅜ', {code: 'KeyN'}))).toEqual({kind: 'notes'});
  });

  it('opens bookmarks 1 to 9, not 0', () => {
    expect(shortcutFor(press('1'))).toEqual({kind: 'site', number: 1});
    expect(shortcutFor(press('9'))).toEqual({kind: 'site', number: 9});
    expect(shortcutFor(press('0'))).toBeNull();
  });

  it("leaves the browser's own shortcuts alone", () => {
    expect(shortcutFor(press('t', {metaKey: true}))).toBeNull();
    expect(shortcutFor(press('1', {ctrlKey: true}))).toBeNull();
    expect(shortcutFor(press('n', {altKey: true}))).toBeNull();
  });

  it('ignores held keys, typing in progress and other keys', () => {
    expect(shortcutFor(press('t', {repeat: true}))).toBeNull();
    expect(shortcutFor(press('n', {isComposing: true}))).toBeNull();
    expect(shortcutFor(press('x'))).toBeNull();
    expect(shortcutFor(press('Enter'))).toBeNull();
  });
});
