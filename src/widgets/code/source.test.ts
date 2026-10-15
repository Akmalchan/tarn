/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import {BLANK_CODE, CODE_EXAMPLES, DEFAULT_CODE} from './examples';
import {aiInstructions} from './ai-prompt';
import {
  CODE_LIMIT,
  fragmentFor,
  hasEntry,
  isShadertoy,
  normalizeCode,
  parseErrors,
} from './source';

describe('normalizeCode', () => {
  it('reads what the panel saves', () => {
    expect(normalizeCode({lang: 'glsl', code: 'x'})).toEqual({
      lang: 'glsl',
      code: 'x',
    });
  });

  it('keeps a language from a newer Tarn as stored', () => {
    expect(normalizeCode({lang: 'js', code: 'draw()'})).toEqual({
      lang: 'js',
      code: 'draw()',
    });
  });

  it('takes bare code as GLSL and caps its length', () => {
    const long = 'a'.repeat(CODE_LIMIT + 10);
    expect(normalizeCode(long).code).toHaveLength(CODE_LIMIT);
    expect(normalizeCode('x').lang).toBe('glsl');
  });

  it('falls back on anything else', () => {
    for (const raw of [undefined, null, 4, [], {code: 3}]) {
      expect(normalizeCode(raw, 'start')).toEqual({
        lang: 'glsl',
        code: 'start',
      });
    }
  });
});

describe('the shader built from code', () => {
  it('counts error lines from the first line of the code', () => {
    const source = fragmentFor('vec4 widget(vec2 uv, float t) {}');
    const lines = source.split('\n');
    const at = lines.indexOf('#line 1');
    expect(at).toBeGreaterThan(0);
    expect(lines[at + 1]).toBe('vec4 widget(vec2 uv, float t) {}');
  });

  it('wraps Shadertoy code with its names', () => {
    const code = 'void mainImage(out vec4 c, in vec2 p) { c = vec4(iTime); }';
    expect(isShadertoy(code)).toBe(true);
    const source = fragmentFor(code);
    expect(source).toContain('#define iTime uTime');
    expect(source).toContain('mainImage(color, gl_FragCoord.xy)');
    expect(source).not.toContain('widget(uv, uTime)');
  });

  it("doesn't take a commented-out mainImage for Shadertoy code", () => {
    const code =
      '// void mainImage(out vec4 c, in vec2 p)\nvec4 widget(vec2 uv, float t) { return vec4(0); }';
    expect(isShadertoy(code)).toBe(false);
    expect(fragmentFor(code)).toContain('widget(uv, uTime)');
  });

  it('knows when there is nothing to call', () => {
    expect(hasEntry('float x = 1.0;')).toBe(false);
    expect(hasEntry('/* vec4 widget( */')).toBe(false);
    expect(hasEntry('vec4 widget(vec2 uv, float t) {}')).toBe(true);
  });
});

describe('parseErrors', () => {
  const code = 'a\nb\nc\nd';

  it('turns a driver log into lines people read', () => {
    const log =
      "ERROR: 0:4: 'colr' : undeclared identifier\nERROR: 0:4: '' : compilation terminated\n";
    expect(parseErrors(log, code)).toEqual([
      {line: 4, message: "'colr' : undeclared identifier"},
    ]);
  });

  it('drops the line number of an error in the wrapper', () => {
    expect(
      parseErrors(
        "ERROR: 0:9: 'widget' : no matching overloaded function found",
        code,
      ),
    ).toEqual([
      {line: null, message: "'widget' : no matching overloaded function found"},
    ]);
  });

  it('skips warnings and keeps unnumbered errors', () => {
    expect(
      parseErrors('WARNING: 0:1: something\nERROR: too many uniforms', code),
    ).toEqual([{line: null, message: 'too many uniforms'}]);
  });
});

describe('examples', () => {
  it('each has a unique id and something to call', () => {
    const ids = new Set(CODE_EXAMPLES.map(example => example.id));
    expect(ids.size).toBe(CODE_EXAMPLES.length);
    for (const example of CODE_EXAMPLES) {
      expect(hasEntry(example.code), example.id).toBe(true);
      expect(example.code.length).toBeLessThan(CODE_LIMIT);
    }
    // Six, the owner's number; "Start from scratch" is not one of them.
    expect(CODE_EXAMPLES).toHaveLength(6);
    expect(hasEntry(BLANK_CODE)).toBe(true);
    expect(DEFAULT_CODE).toBe(BLANK_CODE);
  });

  it('the AI instructions name every input Tarn declares', () => {
    const text = aiInstructions();
    const declared = fragmentFor('').match(/uniform \w+ (\w+)/g) ?? [];
    expect(declared.length).toBeGreaterThan(0);
    for (const line of declared) {
      expect(text).toContain(line.split(' ')[2]!);
    }
    for (const helper of ['hash01', 'noise', 'fbm']) {
      expect(text).toContain(`float ${helper}(vec2 p)`);
    }
  });
});

describe('wallpaper colors for custom widgets', () => {
  it('brighten on dark wallpapers and deepen on light ones, keeping the hue', async () => {
    const {standOut} = await import('./stage');
    const navy = [0.05, 0.1, 0.2];
    const bright = standOut(navy, 'dark');
    expect(Math.max(...bright)).toBeCloseTo(0.8);
    expect(bright[0]! / bright[2]!).toBeCloseTo(0.25);
    const pastel = standOut([0.9, 0.8, 0.95], 'light');
    expect(Math.max(...pastel)).toBeCloseTo(0.55);
    expect(Math.min(...pastel) / Math.max(...pastel)).toBeCloseTo(0.4);
    expect(standOut([0, 0, 0], 'dark')).toEqual([0.8, 0.8, 0.8]);
  });
});
