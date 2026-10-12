/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {css} from 'lit';

/**
 * Shared by every widget. A widget fills its tile; the tile (tarn-board) is
 * a size container, so widgets adapt with @container queries.
 */
export const widgetStyles = css`
  /* Shadow roots don't inherit the page's box-sizing rule. */
  :host,
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    padding: 16px 18px;
    color: var(--ink);
    text-shadow: var(--ink-shadow);
    font-family: var(--font-sans);
  }

  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
    user-select: none;
  }

  button {
    font: inherit;
    color: inherit;
  }

  :focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
`;
