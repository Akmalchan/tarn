/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
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

/**
 * Solid surfaces over the page (sheets, the shortcuts sheet, the first-run
 * guide, the takeover page) follow Tarn's appearance (Settings > Advanced:
 * Auto follows the system), not the wallpaper: light mode never gets a dark
 * sheet over a dark scene (owner, 2026-10-20). Each color is a light-dark()
 * pair, decided by the root's color-scheme (ui/appearance.ts). Set inside the
 * surface, so its contents use the usual tokens.
 */
export const surface = css`
  --surface: light-dark(rgb(251 251 253 / 0.97), rgb(28 30 36 / 0.97));
  --ink: light-dark(rgb(29 29 31), rgb(244 247 251));
  --ink-dim: light-dark(rgb(29 29 31 / 0.62), rgb(244 247 251 / 0.66));
  --ink-faint: light-dark(rgb(29 29 31 / 0.4), rgb(244 247 251 / 0.4));
  --ink-shadow: none;
  --chip: light-dark(rgb(0 0 0 / 0.06), rgb(255 255 255 / 0.1));
  --chip-hover: light-dark(rgb(0 0 0 / 0.1), rgb(255 255 255 / 0.16));
  --chip-strong: light-dark(rgb(255 255 255), rgb(30 34 44 / 0.9));
  --tile-line: light-dark(rgb(0 0 0 / 0.1), rgb(255 255 255 / 0.1));
  --focus-ring: light-dark(rgb(0 0 0 / 0.45), rgb(255 255 255 / 0.6));
  --surface-shadow: 0 24px 60px -20px
    light-dark(rgb(0 0 0 / 0.35), rgb(0 0 0 / 0.6));
`;
