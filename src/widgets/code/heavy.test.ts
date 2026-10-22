/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {codeHash, forgetHeavy, isHeavy, markHeavy} from './heavy';

function memory() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const HEAVY = 'vec4 widget(vec2 uv, float t) { /* a big loop */ }';

describe('heavy custom widgets', () => {
  it('remembers code that was too heavy, per widget', () => {
    const store = memory();
    markHeavy('w1', HEAVY, store);
    expect(isHeavy('w1', HEAVY, store)).toBe(true);
    expect(isHeavy('w2', HEAVY, store)).toBe(false);
    expect([...store.items.keys()]).toEqual(['tarn.code.heavy.w1']);
  });

  it('forgets it once the code changes', () => {
    const store = memory();
    markHeavy('w1', HEAVY, store);
    expect(isHeavy('w1', HEAVY + ' ', store)).toBe(false);
    expect(store.items.size).toBe(0);
    expect(isHeavy('w1', HEAVY, store)).toBe(false);
  });

  it('forgets it on Run anyway', () => {
    const store = memory();
    markHeavy('w1', HEAVY, store);
    forgetHeavy('w1', store);
    expect(isHeavy('w1', HEAVY, store)).toBe(false);
  });

  it('runs everything when storage is blocked', () => {
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
    expect(() => markHeavy('w1', HEAVY, blocked)).not.toThrow();
    expect(isHeavy('w1', HEAVY, blocked)).toBe(false);
  });

  it('tells codes apart', () => {
    expect(codeHash(HEAVY)).toBe(codeHash(HEAVY));
    expect(codeHash(HEAVY)).not.toBe(codeHash(HEAVY.replace('big', 'bag')));
  });
});
