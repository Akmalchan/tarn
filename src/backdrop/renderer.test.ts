/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {toBase64} from '../app/codec';
import {
  rememberGhost,
  rememberScene,
  rememberedGhost,
} from '../app/first-paint';
import {DISPLAY_EDGE} from '../wallpapers/store';
import {Renderer, ghostSize, photoDecodeSize} from './renderer';
import {sceneById} from './scenes';
import type {Scene} from './scenes/types';

/**
 * A stand-in WebGL2 context: constants are numbers, every call is counted,
 * and fragment shaders containing `BROKEN` fail to compile.
 */
function fakeGl() {
  const calls = new Map<string, number>();
  const live = {shaders: new Set<object>(), programs: new Set<object>()};
  const sources = new Map<object, string>();
  const constants = new Map<string, number>();
  let lost = false;
  const count = (name: string) => calls.set(name, (calls.get(name) ?? 0) + 1);
  const constant = (name: string) => {
    if (!constants.has(name)) constants.set(name, constants.size + 1);
    return constants.get(name);
  };
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    createShader: () => {
      const shader = {};
      live.shaders.add(shader);
      return shader;
    },
    deleteShader: shader => live.shaders.delete(shader as object),
    shaderSource: (shader, source) =>
      sources.set(shader as object, source as string),
    getShaderParameter: shader =>
      !sources.get(shader as object)?.includes('BROKEN'),
    createProgram: () => {
      const program = {};
      live.programs.add(program);
      return program;
    },
    deleteProgram: program => live.programs.delete(program as object),
    getProgramParameter: () => true,
    getParameter: () => 4096,
    isContextLost: () => lost,
    checkFramebufferStatus: () => constant('FRAMEBUFFER_COMPLETE'),
    clientWaitSync: () => constant('ALREADY_SIGNALED'),
  };
  const gl = new Proxy(
    {},
    {
      get(_, name: string) {
        if (/^[A-Z0-9_]+$/.test(name)) return constant(name);
        return (...args: unknown[]) => {
          count(name);
          return methods[name] ? methods[name](...args) : {};
        };
      },
    },
  );
  return {
    gl,
    calls: (name: string) => calls.get(name) ?? 0,
    live,
    loseContext: (value: boolean) => (lost = value),
  };
}

function fakeCanvas(gl: object | null) {
  const canvas = new EventTarget() as EventTarget & {
    width: number;
    height: number;
    getContext: () => object | null;
  };
  canvas.width = 300;
  canvas.height = 150;
  canvas.getContext = () => gl;
  return canvas;
}

const broken: Scene = {
  ...sceneById('tarn'),
  id: 'broken',
  fragment: 'BROKEN',
};

describe('Renderer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function start(scene: Scene, events = {}) {
    const fake = fakeGl();
    const canvas = fakeCanvas(fake.gl);
    const renderer = new Renderer(
      canvas as unknown as OffscreenCanvas,
      scene,
      0,
      events,
    );
    renderer.resize(1440, 900);
    return {fake, canvas, renderer};
  }

  it('compiles a failing shader once, leaks nothing and stops', () => {
    const onUnavailable = vi.fn();
    const {fake} = start(broken, {onUnavailable});
    vi.advanceTimersByTime(1000);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(fake.calls('compileShader')).toBe(2);
    expect(fake.calls('drawArrays')).toBe(0);
    expect(fake.live.shaders.size).toBe(0);
    expect(fake.live.programs.size).toBe(0);
  });

  it('draws again once another scene is picked', () => {
    const onSceneShown = vi.fn();
    const {fake, renderer} = start(broken, {onSceneShown});
    renderer.setScene(sceneById('tarn'));
    vi.advanceTimersByTime(1000);
    expect(onSceneShown).toHaveBeenCalledWith('tarn');
    expect(fake.calls('drawArrays')).toBeGreaterThan(10);
  });

  it('reports a scene again when it is set again', () => {
    const onSceneShown = vi.fn();
    const {renderer} = start(sceneById('tarn'), {onSceneShown});
    renderer.setScene(sceneById('tarn'));
    expect(onSceneShown.mock.calls).toEqual([['tarn'], ['tarn']]);
  });

  it('tells the page about a lost context and draws nothing until restored', () => {
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();
    const onSceneShown = vi.fn();
    const {fake, canvas, renderer} = start(sceneById('tarn'), {
      onContextLost,
      onContextRestored,
      onSceneShown,
    });
    fake.loseContext(true);
    canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true}));
    expect(onContextLost).toHaveBeenCalledTimes(1);
    const draws = fake.calls('drawArrays');
    renderer.resize(1200, 800);
    vi.advanceTimersByTime(1000);
    expect(fake.calls('drawArrays')).toBe(draws);
    fake.loseContext(false);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(onContextRestored).toHaveBeenCalledTimes(1);
    expect(fake.calls('drawArrays')).toBeGreaterThan(draws);
    expect(onSceneShown).toHaveBeenCalledTimes(2);
  });

  it('captures a ghost from the next frame, without an extra draw', async () => {
    const {fake, renderer} = start(sceneById('tarn'));
    vi.advanceTimersByTime(200);
    const draws = fake.calls('drawArrays');
    let drawsAtCapture = 0;
    const ghost = renderer.ghost().then(frame => {
      drawsAtCapture = fake.calls('drawArrays');
      return frame;
    });
    expect(fake.calls('drawArrays')).toBe(draws);
    await vi.advanceTimersByTimeAsync(200);
    const frame = await ghost;
    expect(frame?.width).toBe(320);
    expect(frame?.height).toBe(200);
    // Read back from the loop's next frame: no draw of its own.
    expect(drawsAtCapture).toBe(draws + 1);
  });
});

describe('ghostSize', () => {
  it('keeps 320 px on the longer side', () => {
    expect(ghostSize(504, 315)).toEqual({width: 320, height: 200});
    expect(ghostSize(378, 672)).toEqual({width: 180, height: 320});
  });

  it('never enlarges a small canvas', () => {
    expect(ghostSize(288, 180)).toEqual({width: 288, height: 180});
  });

  it('fits what the next page accepts, portrait included', () => {
    const session = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
    vi.stubGlobal('localStorage', storage(new Map()));
    vi.stubGlobal('sessionStorage', storage(session));
    rememberScene('tarn');
    for (const [w, h] of [
      [1080 * 0.35, 1920 * 0.35],
      [700, 1300],
      [3840, 1080],
    ]) {
      const {width, height} = ghostSize(w!, h!);
      const data = toBase64(new Uint8Array(width * height * 3));
      rememberGhost('tarn', {width, height, data, clock: 1, color: '#000000'});
      expect(rememberedGhost()?.width).toBe(width);
    }
    vi.unstubAllGlobals();
  });
});

describe('photoDecodeSize', () => {
  const screen = {width: 5120, height: 2880};

  it('never decodes past the display copy', () => {
    expect(photoDecodeSize({width: 9000, height: 3000}, screen, 16384)).toEqual(
      {width: DISPLAY_EDGE, height: 1280},
    );
    expect(photoDecodeSize({width: 6000, height: 3375}, screen, 16384)).toEqual(
      {width: 3840, height: 2160},
    );
  });

  it('stays within the GPU texture limit', () => {
    const size = photoDecodeSize({width: 9000, height: 3000}, screen, 2048);
    expect(size).toEqual({width: 2048, height: 683});
  });

  it('decodes at the cover size, never larger than the photo', () => {
    expect(
      photoDecodeSize(
        {width: 3000, height: 2000},
        {width: 750, height: 400},
        8192,
      ),
    ).toEqual({width: 750, height: 500});
    expect(photoDecodeSize({width: 1000, height: 800}, screen, 8192)).toEqual({
      width: 1000,
      height: 800,
    });
  });
});
