/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
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

/**
 * A small sheet over the page for a widget's own forms (adding a site,
 * choosing a place): a <dialog> shown modal, with labelled fields and a
 * Cancel / primary button row.
 */
export const sheetStyles = css`
  /* Like Safari's sheets. */
  dialog {
    width: min(340px, calc(100vw - 32px));
    padding: 20px;
    color: var(--ink);
    text-shadow: none;
    background: var(--tile-held, rgb(20 25 34 / 0.92));
    border: 1px solid var(--tile-line);
    border-radius: 18px;
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.35);
    /* Only while it's open, so blurring the moving scene costs nothing
       the rest of the time. */
    backdrop-filter: blur(28px) saturate(1.2);
  }

  dialog[open] {
    animation: sheet-in 180ms ease-out both;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
  }

  @keyframes sheet-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h4 {
    margin: 0 0 2px;
    font-size: 15px;
    font-weight: 600;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 12px;
    color: var(--ink-dim);
  }

  input {
    width: 100%;
    padding: 8px 10px;
    font: inherit;
    font-size: 14px;
    color: var(--ink);
    background: var(--chip);
    border: 1px solid var(--tile-line);
    border-radius: 10px;
    outline: none;
  }

  input::placeholder {
    color: var(--ink-faint);
  }

  input:focus {
    border-color: var(--focus-ring);
  }

  .error {
    margin: -4px 0 0;
    font-size: 12px;
    color: var(--ink-dim);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .buttons button {
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 500;
    border: 0;
    border-radius: 999px;
    background: var(--chip);
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .buttons button:hover {
    background: var(--chip-hover);
  }

  .buttons .primary {
    color: var(--tile-held, #141922);
    background: var(--ink);
  }

  .buttons .primary:hover {
    background: var(--ink);
    opacity: 0.9;
  }

  @media (prefers-reduced-motion: reduce) {
    dialog[open] {
      animation: none;
    }
  }
`;
