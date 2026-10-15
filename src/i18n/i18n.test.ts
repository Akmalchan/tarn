/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {describe, expect, it} from 'vitest';
import {LANGUAGES, resolveLanguage} from './languages';
import {en} from './messages/en';

const catalogs = import.meta.glob<Record<string, Record<string, string>>>(
  './messages/*.ts',
  {eager: true},
);

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('translations', () => {
  it('exist for every language', () => {
    const files = Object.keys(catalogs).map(path =>
      path.replace('./messages/', '').replace('.ts', ''),
    );
    for (const {code} of LANGUAGES) expect(files).toContain(code);
  });

  it.each(Object.entries(catalogs))(
    '%s has every key, with the same placeholders',
    (_path, module) => {
      const catalog = Object.values(module)[0]!;
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(en)) {
        expect(placeholders(catalog[key]!), key).toEqual(placeholders(text));
        expect(catalog[key]!.trim(), key).not.toBe('');
      }
    },
  );
});

describe('resolveLanguage', () => {
  it('follows the browser for auto, by region then language', () => {
    expect(resolveLanguage('auto', ['pt-PT'])).toBe('pt-BR');
    expect(resolveLanguage('auto', ['zh-CN'])).toBe('zh-CN');
    expect(resolveLanguage('auto', ['zh-TW', 'ja'])).toBe('ja');
    expect(resolveLanguage('auto', ['de-AT', 'en'])).toBe('de');
    expect(resolveLanguage('auto', ['uz', 'ru'])).toBe('ru');
    expect(resolveLanguage('auto', ['uz'])).toBe('en');
  });

  it('uses a chosen language as is', () => {
    expect(resolveLanguage('ko', ['en-US'])).toBe('ko');
  });
});
