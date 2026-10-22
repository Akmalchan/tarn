/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';

// The manifest's words (public/_locales), held to Chrome's limits: a longer
// short name is cut in the side panel's header (German's "Einstellungen"
// was 13 until 2026-10-20), and the store refuses a longer name or
// description.

const catalogs = import.meta.glob<Record<string, {message: string}>>(
  '../public/_locales/*/messages.json',
  {import: 'default', eager: true},
);

const LIMITS: Record<string, number> = {
  extShortName: 12,
  extName: 75,
  extDescription: 132,
};

describe('manifest words', () => {
  it('cover every language', () => {
    expect(Object.keys(catalogs)).toHaveLength(10);
  });

  it.each(Object.entries(catalogs))('%s stays within limits', (_, catalog) => {
    for (const [key, limit] of Object.entries(LIMITS)) {
      const message = catalog[key]?.message ?? '';
      expect(message.length, key).toBeGreaterThan(0);
      expect([...message].length, `${key}: ${message}`).toBeLessThanOrEqual(
        limit,
      );
    }
  });
});
