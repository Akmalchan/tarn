/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {toUrl} from '../widgets/favorites-model';

// What the search box opens instead of searching (docs/search.md). Like
// the browser's own box: a scheme, www., localhost, an IP, a port, or a
// host ending in a real-looking top-level domain. A file name such as
// "package.json" or "main.py" is searched.

/** Endings that are file types far more often than websites. */
const FILE_ENDINGS = new Set(
  (
    'json jsonc js mjs cjs ts tsx jsx vue md txt csv log png jpg jpeg gif ' +
    'svg webp heic pdf zip gz tar rar html htm css scss xml yml yaml toml ' +
    'ini lock env py rb go java kt swift cpp exe dmg doc docx xls ' +
    'xlsx ppt pptx wav mov'
  ).split(' '),
);

const PORT_PATH = String.raw`(:\d{1,5})?([/?#].*)?`;
const IPV4 = new RegExp(
  String.raw`^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)` +
    PORT_PATH +
    '$',
);
const LOCALHOST = new RegExp('^localhost' + PORT_PATH + '$', 'i');
// Dot-separated labels; the last one letters only (or punycode), 2-63 long.
const HOST = new RegExp(
  String.raw`^([\p{L}\p{N}-]+\.)+(\p{L}{2,63}|xn--[a-z0-9-]{1,59})` +
    PORT_PATH +
    '$',
  'iu',
);

/** "github.com", "localhost:3000/x", "192.168.1.1", "https://…": open, not search. */
export function looksLikeAddress(text: string): boolean {
  if (!text || /\s/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return true;
  if (LOCALHOST.test(text) || IPV4.test(text)) return true;
  const match = HOST.exec(text);
  if (!match) return false;
  if (/^www\./i.test(text) || match[3]) return true;
  return !FILE_ENDINGS.has((match[2] ?? '').toLowerCase());
}

/** The page a typed address opens, or null when the text is a search. */
export function addressUrl(text: string): string | null {
  const trimmed = text.trim();
  return looksLikeAddress(trimmed) ? toUrl(trimmed) : null;
}
