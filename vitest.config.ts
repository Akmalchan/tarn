// Copyright 2026 The Tarn Authors
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

import {defineConfig} from 'vitest/config';
import {WxtVitest} from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  // CSS as its text, not emptied: license.test.ts reads the headers.
  test: {css: true},
});
