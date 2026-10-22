/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import type {Renderer as RendererType} from './renderer';

/**
 * A 60 Hz display as Chrome drives a worker's frame callbacks: a request
 * waits for the next display frame, except that once a display frame has
 * passed without one, the next request gets that missed frame at once,
 * with its (old) time.
 */
const display = vi.hoisted(() => {
  const FRAME = 1000 / 60;
  const state = {callbacks: 0, delivered: 0};
  const pending: FrameRequestCallback[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const lastVsync = () => Math.floor(performance.now() / FRAME) * FRAME;
  const fire = (stamp: number) => {
    timer = null;
    state.delivered = stamp;
    for (const cb of pending.splice(0)) {
      state.callbacks++;
      cb(stamp);
    }
  };
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    pending.push(cb);
    if (timer) return 1;
    const missed = lastVsync();
    if (missed - state.delivered > FRAME * 1.5) {
      timer = setTimeout(() => fire(missed), 0);
    } else {
      const next = missed + FRAME;
      timer = setTimeout(() => fire(next), next - performance.now());
    }
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};
  return state;
});

describe('frame loop', () => {
  let Renderer: typeof RendererType;
  beforeAll(async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    ({Renderer} = await import('./renderer'));
  });
  afterAll(() => void vi.useRealTimers());

  function fakeCanvas() {
    let draws = 0;
    const gl = new Proxy(
      {},
      {
        get: (_, name: string) =>
          /^[A-Z0-9_]+$/.test(name)
            ? 1
            : () => {
                if (name === 'drawArrays') draws++;
                if (name === 'getShaderParameter') return true;
                if (name === 'getProgramParameter') return true;
                if (name === 'getParameter') return 4096;
                if (name === 'isContextLost') return false;
                return {};
              },
      },
    );
    const canvas = Object.assign(new EventTarget(), {
      width: 300,
      height: 150,
      getContext: () => gl,
    });
    return {canvas, draws: () => draws};
  }

  for (const [pace, fps] of [
    ['active', 30],
    ['calm', 20],
  ] as const) {
    it(`draws ${fps} frames a second at ${pace} pace, one wake each`, async () => {
      const {canvas, draws} = fakeCanvas();
      const {sceneById} = await import('./scenes');
      const renderer = new Renderer(
        canvas as unknown as OffscreenCanvas,
        sceneById('tarn'),
        0,
      );
      renderer.resize(1440, 900);
      renderer.setPace(pace);
      // Let the speed settle (about 10 s down to calm).
      vi.advanceTimersByTime(40_000);
      const drawsBefore = draws();
      const callbacksBefore = display.callbacks;
      vi.advanceTimersByTime(3000);
      const drawn = draws() - drawsBefore;
      const callbacks = display.callbacks - callbacksBefore;
      expect(drawn).toBeGreaterThanOrEqual(fps * 3 - 1);
      expect(drawn).toBeLessThanOrEqual(fps * 3 + 1);
      expect(callbacks).toBeLessThanOrEqual(drawn + 1);
      renderer.dispose();
    });
  }
});
