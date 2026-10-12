/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fromBase64, toBase64} from './codec';
import {
  rememberClock,
  rememberGhost,
  rememberScene,
  rememberedGhost,
  resumeClock,
} from './first-paint';

/** An in-memory stand-in for localStorage. */
function stubStorage(): Map<string, string> {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

describe('resumeClock', () => {
  beforeEach(() => void stubStorage());

  it('continues from the saved moment plus the time since', () => {
    rememberClock(100, 1_000_000);
    expect(resumeClock(1_002_500)).toBeCloseTo(102.5);
  });

  it('starts fresh when nothing was saved', () => {
    expect(resumeClock()).toBeUndefined();
  });

  it('starts fresh when the saved moment is too old', () => {
    rememberClock(100, 0);
    expect(resumeClock(31 * 60 * 1000)).toBeUndefined();
  });

  it('ignores a moment from the future (clock changed)', () => {
    rememberClock(100, 5000);
    expect(resumeClock(1000)).toBeUndefined();
  });

  it('ignores corrupt data', () => {
    stubStorage().set('tarn.clock', '{nope');
    expect(resumeClock()).toBeUndefined();
  });
});

describe('ghost frame', () => {
  let session: Map<string, string>;
  beforeEach(() => {
    stubStorage();
    session = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => void session.set(k, v),
      removeItem: (k: string) => void session.delete(k),
    });
  });

  const pixels = new Uint8Array([255, 0, 0, 0, 0, 255]);
  const ghost = {
    width: 2,
    height: 1,
    data: toBase64(pixels),
    clock: 42,
    color: '#800080',
  };

  it('round-trips for the current scene, per tab', () => {
    rememberScene('ember');
    rememberGhost('ember', ghost);
    expect(session.has('tarn.ghost')).toBe(true);
    expect(rememberedGhost()).toEqual({
      width: 2,
      height: 1,
      pixels,
      clock: 42,
      color: '#800080',
    });
  });

  it('is ignored when the scene has changed since', () => {
    rememberScene('wave');
    rememberGhost('ember', ghost);
    expect(rememberedGhost()).toBeNull();
  });

  it('rejects a size that does not match its pixels', () => {
    rememberScene('ember');
    rememberGhost('ember', {...ghost, width: 3});
    expect(rememberedGhost()).toBeNull();
  });

  it('rejects oversized or malformed dimensions', () => {
    rememberScene('ember');
    rememberGhost('ember', {...ghost, width: 10_000});
    expect(rememberedGhost()).toBeNull();
  });

  it('rejects a malformed color', () => {
    rememberScene('ember');
    rememberGhost('ember', {...ghost, color: 'red; background: url(x)'});
    expect(rememberedGhost()).toBeNull();
  });
});

describe('base64', () => {
  it('round-trips bytes, including large buffers', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7) & 255);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
