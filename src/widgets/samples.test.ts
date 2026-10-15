/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {layoutBands} from '../layout/bands';
import {WIDGET_SIZE_OPTIONS} from '../settings/schema';
import {EXAMPLES} from './samples';

describe('example setups', () => {
  for (const example of EXAMPLES) {
    describe(example.name, () => {
      it('has at most nine widgets, each kind once', () => {
        const kinds = example.widgets.map(([kind]) => kind);
        expect(kinds.length).toBeLessThanOrEqual(9);
        expect(new Set(kinds).size).toBe(kinds.length);
      });

      it('asks only for sizes each kind offers', () => {
        for (const [kind, size] of example.widgets) {
          expect(WIDGET_SIZE_OPTIONS[kind]).toContain(size);
        }
      });

      it('leaves no holes at 4 or 6 columns', () => {
        const items = example.widgets.map(([kind, size]) => ({id: kind, size}));
        for (const columns of [4, 6]) {
          const {placements, bands, heights} = layoutBands(items, columns);
          // Every band but the last is full.
          for (let band = 0; band < bands.length - 1; band++) {
            const filled = placements
              .filter(p => p.band === band)
              .reduce((sum, p) => sum + p.w * p.h, 0);
            expect(filled, `band ${band} at ${columns}`).toBe(
              bands[band]! * heights[band]!,
            );
          }
        }
      });
    });
  }
});
