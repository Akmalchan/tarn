/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';

// Every source file names Tarn's license (AGENTS.md, LICENSE), so a copied
// file still says what it's under: code, styles, pages, build config and
// scripts.
const sources = import.meta.glob<string>(
  ['./**/*.{ts,css,html}', '../*.{ts,js,mjs}', '../scripts/*.{ts,mjs,sh}'],
  {query: '?raw', import: 'default', eager: true},
);

describe('license headers', () => {
  it('finds the source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        './styles/global.css',
        './entrypoints/newtab/index.html',
        '../wxt.config.ts',
        '../eslint.config.js',
        '../scripts/scene-previews.mjs',
      ]),
    );
  });

  it('every source file carries the PolyForm Shield header', () => {
    const missing = Object.entries(sources)
      .filter(
        ([, text]) =>
          !text.includes(
            'SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0',
          ),
      )
      .map(([path]) => path);
    expect(missing).toEqual([]);
  });
});
