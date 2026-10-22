// Copyright 2026 The Tarn Authors
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

// Google TypeScript Style (gts) rules, configured directly.
import js from '@eslint/js';
import {defineConfig} from 'eslint/config';
import prettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {ignores: ['dist/', '.wxt/', 'node_modules/']},
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {...globals.browser, ...globals.worker},
    },
    rules: {
      'block-scoped-var': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-restricted-properties': [
        'error',
        {object: 'describe', property: 'only'},
        {object: 'it', property: 'only'},
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
  {
    // Build-time tools run in Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: {globals: globals.node},
  },
]);
