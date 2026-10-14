/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {
  resolveLanguage,
  type Language,
  type LanguageSetting,
} from './languages';
import {en, type Catalog, type MessageKey} from './messages/en';

export {LANGUAGES, LANGUAGE_SETTINGS, resolveLanguage} from './languages';
export type {Language, LanguageSetting} from './languages';
export type {MessageKey} from './messages/en';

// Every word Tarn shows goes through t(). English is built in; another
// language loads on demand, and the one in use is kept in localStorage so
// a new tab paints its first frame in the right language (see Arrival in
// AGENTS.md).

const MIRROR_KEY = 'tarn.i18n';

const LOADERS: Record<Language, () => Promise<Catalog>> = {
  en: async () => en,
  es: () => import('./messages/es').then(m => m.es),
  'pt-BR': () => import('./messages/pt-BR').then(m => m.ptBR),
  fr: () => import('./messages/fr').then(m => m.fr),
  de: () => import('./messages/de').then(m => m.de),
  ru: () => import('./messages/ru').then(m => m.ru),
  ja: () => import('./messages/ja').then(m => m.ja),
  'zh-CN': () => import('./messages/zh-CN').then(m => m.zhCN),
  ko: () => import('./messages/ko').then(m => m.ko),
  tr: () => import('./messages/tr').then(m => m.tr),
};

interface Current {
  readonly lang: Language;
  readonly messages: Readonly<Partial<Record<MessageKey, string>>>;
}

let current: Current = readMirror() ?? {lang: 'en', messages: en};
/** The catalog was loaded fresh in this page (the mirror may be older). */
let loaded = current.lang === 'en';
const listeners = new Set<() => void>();
applyDocumentLanguage();

/**
 * The text for `key` in the current language, with `{name}` placeholders
 * filled from `params`. Falls back to English for anything missing.
 */
export function t(
  key: MessageKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const text = current.messages[key] ?? en[key];
  return params
    ? text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match,
      )
    : text;
}

/**
 * The tag for Intl (dates, times, numbers): the browser's own when it is
 * the same language, so its region's conventions stay (en-GB keeps its
 * 24-hour clock and day-month order), otherwise the language in use.
 */
export function locale(): string {
  const lang = current.lang;
  const base = lang.split('-')[0]!;
  const preferred =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? []);
  // Chinese stays Simplified: a zh-TW browser with Chinese chosen keeps zh-CN.
  if (base === 'zh') return lang;
  return (
    preferred.find(tag => tag.toLowerCase().split('-')[0] === base) ?? lang
  );
}

/**
 * Switches to the language a setting asks for. Cheap when nothing
 * changes; otherwise loads the catalog, remembers it for first paint and
 * re-renders everything that uses LocaleController.
 */
let generation = 0;

export async function useLanguage(setting: LanguageSetting): Promise<void> {
  const lang = resolveLanguage(setting);
  if (lang === current.lang && loaded) return;
  // Quick changes (one language, then another): only the last one counts.
  const mine = ++generation;
  let messages: Catalog;
  try {
    messages = await LOADERS[lang]();
  } catch (error) {
    console.warn('[tarn] language not loaded:', error);
    return;
  }
  if (mine !== generation) return;
  const changed =
    lang !== current.lang ||
    JSON.stringify(messages) !== JSON.stringify(current.messages);
  current = {lang, messages};
  loaded = true;
  writeMirror();
  if (!changed) return;
  applyDocumentLanguage();
  for (const listener of listeners) listener();
}

/** Re-renders its element when the language changes. */
export class LocaleController implements ReactiveController {
  private readonly update = () => this.host.requestUpdate();

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {
    listeners.add(this.update);
  }

  hostDisconnected(): void {
    listeners.delete(this.update);
  }
}

function applyDocumentLanguage(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current.lang;
  }
}

function readMirror(): Current | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw: unknown = JSON.parse(localStorage.getItem(MIRROR_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const {lang, messages} = raw as {lang?: unknown; messages?: unknown};
    if (typeof lang !== 'string' || !(lang in LOADERS)) return null;
    if (typeof messages !== 'object' || messages === null) return null;
    const clean: Partial<Record<MessageKey, string>> = {};
    for (const [key, value] of Object.entries(messages)) {
      if (key in en && typeof value === 'string') {
        clean[key as MessageKey] = value;
      }
    }
    return {lang: lang as Language, messages: clean};
  } catch {
    return null;
  }
}

function writeMirror(): void {
  try {
    if (current.lang === 'en') localStorage.removeItem(MIRROR_KEY);
    else localStorage.setItem(MIRROR_KEY, JSON.stringify(current));
  } catch {
    // Blocked storage: the first frame shows English, then the language.
  }
}
