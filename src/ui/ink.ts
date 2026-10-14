/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {css} from 'lit';

/** Text colors over a dark wallpaper: light ink, a soft shadow. */
export const darkInk = css`
  --ink: rgb(244 247 251);
  --ink-dim: rgb(244 247 251 / 0.66);
  --ink-faint: rgb(244 247 251 / 0.4);
  /* Keeps white text readable over bright patches (Ember's orange). */
  --ink-shadow: 0 1px 3px rgb(0 0 0 / 0.28);
`;

/** Text colors over a light wallpaper: dark ink, no shadow. */
export const lightInk = css`
  --ink: rgb(22 26 38);
  --ink-dim: rgb(22 26 38 / 0.64);
  --ink-faint: rgb(22 26 38 / 0.4);
  --ink-shadow: none;
`;
