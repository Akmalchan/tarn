/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** The languages Tarn speaks, each named in itself. */
export const LANGUAGES = [
  {code: 'en', name: 'English'},
  {code: 'es', name: 'Español'},
  {code: 'pt-BR', name: 'Português (Brasil)'},
  {code: 'fr', name: 'Français'},
  {code: 'de', name: 'Deutsch'},
  {code: 'ru', name: 'Русский'},
  {code: 'ja', name: '日本語'},
  {code: 'zh-CN', name: '简体中文'},
  {code: 'ko', name: '한국어'},
  {code: 'tr', name: 'Türkçe'},
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

/** 'auto' follows the browser's languages. */
export type LanguageSetting = 'auto' | Language;

export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = [
  'auto',
  ...LANGUAGES.map(l => l.code),
];

const CODES: readonly string[] = LANGUAGES.map(l => l.code);

/**
 * The language to use: the setting, or for 'auto' the first of the
 * browser's languages Tarn speaks (by region, then by language), else
 * English. Traditional Chinese falls back to English rather than to
 * Simplified.
 */
export function resolveLanguage(
  setting: LanguageSetting,
  preferred: readonly string[] = typeof navigator === 'undefined'
    ? []
    : navigator.languages,
): Language {
  if (setting !== 'auto') return setting;
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = CODES.find(code => code.toLowerCase() === lower);
    if (exact) return exact as Language;
    const [base, ...rest] = lower.split('-');
    if (base === 'zh') {
      const traditional = rest.some(p =>
        ['tw', 'hk', 'mo', 'hant'].includes(p),
      );
      if (!traditional) return 'zh-CN';
      continue;
    }
    if (base === 'pt') return 'pt-BR';
    const byBase = CODES.find(code => code === base);
    if (byBase) return byBase as Language;
  }
  return 'en';
}
