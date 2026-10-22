/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {CONNECT_HOSTS, FORM_HOSTS, PUBLIC_FILES} from '../wxt.config';

const code = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
// Only in the private repository: the public one is this list.
const publishScript = Object.values(
  import.meta.glob<string>('../scripts/publish-public.sh', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];

describe('the pinned content security policy', () => {
  it('lets every request Tarn makes through', () => {
    const fetching = Object.entries(code).filter(([, text]) =>
      text.includes('fetch('),
    );
    expect(fetching.length).toBeGreaterThan(2);
    for (const [path, text] of fetching) {
      for (const [origin] of text.matchAll(/https:\/\/[a-z0-9.-]+/g)) {
        expect(CONNECT_HOSTS, `${origin} in ${path}`).toContain(origin);
      }
    }
  });

  it('lets the Lens upload through', () => {
    const search = code['./search/tarn-search.ts']!;
    const upload = /LENS_UPLOAD = \(\) =>\s*`(https:\/\/[a-z0-9.-]+)/.exec(
      search,
    );
    expect(FORM_HOSTS).toContain(upload?.[1]);
  });
});

describe('the Firefox sources zip', () => {
  it.runIf(publishScript)('holds what the public repository does', () => {
    const list = /\nPUBLIC=\(([^)]*)\)/.exec(publishScript!)?.[1] ?? '';
    expect(list.split(/\s+/).filter(Boolean)).toEqual(PUBLIC_FILES);
  });
});
