/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {addressUrl, looksLikeAddress} from './address';

describe('typed addresses', () => {
  it.each([
    ['github.com', 'https://github.com/'],
    ['github.com/akmal/tarn', 'https://github.com/akmal/tarn'],
    ['www.example.com', 'https://www.example.com/'],
    ['news.ycombinator.com', 'https://news.ycombinator.com/'],
    ['docs.rs', 'https://docs.rs/'],
    ['brew.sh', 'https://brew.sh/'],
    ['example.com:8080', 'https://example.com:8080/'],
    ['example.com:8080/x?y=1', 'https://example.com:8080/x?y=1'],
    ['localhost', 'https://localhost/'],
    ['localhost:3000', 'https://localhost:3000/'],
    ['localhost:3000/x', 'https://localhost:3000/x'],
    ['192.168.1.1', 'https://192.168.1.1/'],
    ['10.0.0.5:8443/admin', 'https://10.0.0.5:8443/admin'],
    ['http://192.168.1.1', 'http://192.168.1.1/'],
    ['http://intranet', 'http://intranet/'],
    ['https://package.json', 'https://package.json/'],
    ['www.package.json', 'https://www.package.json/'],
    ['package.json:3000', 'https://package.json:3000/'],
    ['пример.рф', 'https://xn--e1afmkfd.xn--p1ai/'],
    ['example.xn--p1ai', 'https://example.xn--p1ai/'],
  ])('%s opens %s', (text, url) => {
    expect(looksLikeAddress(text)).toBe(true);
    expect(addressUrl(text)).toBe(url);
  });

  it.each([
    'news',
    'package.json',
    'node.js',
    'index.html',
    'main.py',
    'README.md',
    'photo.JPG',
    'report.pdf',
    'tsconfig.app.json',
    'weather tomorrow',
    'github.com is down',
    '3.14',
    '1.2.3',
    '999.1.1.1',
    'e.g.',
    'a.b',
    'mailto:me@example.com',
    'about:blank',
    'javascript:alert(1)',
    'ftp://example.com',
    '',
  ])('%s searches', text => {
    expect(addressUrl(text)).toBeNull();
  });
});
