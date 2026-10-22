/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  readJson,
  readText,
  removeKey,
  writeJson,
  writeText,
} from './web-storage';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: key => items.get(key) ?? null,
    key: index => [...items.keys()][index] ?? null,
    removeItem: key => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

const blocked = () => {
  throw new DOMException('blocked', 'SecurityError');
};

describe('web storage', () => {
  let local: Storage;
  let session: Storage;
  beforeEach(() => {
    local = memoryStorage();
    session = memoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads back text and JSON', () => {
    expect(writeText('a', 'one')).toBe(true);
    expect(readText('a')).toBe('one');
    expect(writeJson('b', {n: 1})).toBe(true);
    expect(readJson('b')).toEqual({n: 1});
    removeKey('a');
    expect(readText('a')).toBeNull();
  });

  it('keeps the two areas apart', () => {
    writeText('k', 'tab', 'session');
    expect(readText('k', 'session')).toBe('tab');
    expect(readText('k')).toBeNull();
    expect(local.length).toBe(0);
  });

  it('gives nothing for what is missing or not JSON', () => {
    expect(readJson('none')).toBeUndefined();
    local.setItem('bad', '{oops');
    expect(readJson('bad')).toBeUndefined();
    local.setItem('null', 'null');
    expect(readJson('null')).toBeNull();
  });

  it('survives blocked or full storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    });
    expect(readText('a')).toBeNull();
    expect(readJson('a')).toBeUndefined();
    expect(writeText('a', 'x')).toBe(false);
    expect(writeJson('a', 1)).toBe(false);
    expect(() => removeKey('a')).not.toThrow();
  });

  it('never falls back to localStorage when sessionStorage is missing', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect(writeText('ghost', 'x', 'session')).toBe(false);
    expect(readText('ghost', 'session')).toBeNull();
    expect(local.length).toBe(0);
  });
});
