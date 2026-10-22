/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {
  RETRY_AFTER_MS,
  forgetTooSlow,
  isTooSlow,
  markTooSlow,
  tooSlowKey,
} from './too-slow';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const CHROME_147 = 'Mozilla/5.0 ... Chrome/147.0.0.0 Safari/537.36';
const CHROME_148 = 'Mozilla/5.0 ... Chrome/148.0.0.0 Safari/537.36';
const DAY = 24 * 60 * 60 * 1000;

describe('too-slow marks', () => {
  it('remembers a scene this computer could not keep up with', () => {
    const store = memoryStore();
    expect(isTooSlow('topology', 0, CHROME_147, store)).toBe(false);
    markTooSlow('topology', 0, CHROME_147, store);
    expect(isTooSlow('topology', DAY, CHROME_147, store)).toBe(true);
    expect(isTooSlow('tarn', DAY, CHROME_147, store)).toBe(false);
  });

  it('retries live after a week', () => {
    const store = memoryStore();
    markTooSlow('matrix', 0, CHROME_147, store);
    expect(isTooSlow('matrix', RETRY_AFTER_MS - 1, CHROME_147, store)).toBe(
      true,
    );
    expect(isTooSlow('matrix', RETRY_AFTER_MS, CHROME_147, store)).toBe(false);
    // ...and the stale mark is gone.
    expect(store.map.has(tooSlowKey('matrix'))).toBe(false);
  });

  it('retries live once the browser is updated', () => {
    const store = memoryStore();
    markTooSlow('matrix', 0, CHROME_147, store);
    expect(isTooSlow('matrix', DAY, CHROME_148, store)).toBe(false);
    expect(isTooSlow('matrix', DAY, CHROME_147, store)).toBe(false);
  });

  it('retries a mark from the future (a clock set back)', () => {
    const store = memoryStore();
    markTooSlow('matrix', 10 * DAY, CHROME_147, store);
    expect(isTooSlow('matrix', DAY, CHROME_147, store)).toBe(false);
  });

  it('forgets a mark when the scene is picked again', () => {
    const store = memoryStore();
    markTooSlow('canopy', 0, CHROME_147, store);
    forgetTooSlow('canopy', store);
    expect(isTooSlow('canopy', 1, CHROME_147, store)).toBe(false);
  });

  it('never trusts what is stored', () => {
    const store = memoryStore();
    for (const value of ['', 'x', '{', 'null', '[]', '{"at":"1"}', '42']) {
      store.setItem(tooSlowKey('ember'), value);
      expect(isTooSlow('ember', 1, CHROME_147, store)).toBe(false);
    }
  });

  it('works without storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    markTooSlow('ember', 0, CHROME_147, blocked);
    forgetTooSlow('ember', blocked);
    expect(isTooSlow('ember', 1, CHROME_147, blocked)).toBe(false);
    expect(isTooSlow('ember', 1, CHROME_147, null)).toBe(false);
  });
});
