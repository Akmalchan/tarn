/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {html, unsafeStatic} from 'lit/static-html.js';
import type {WidgetKind} from '../settings/schema';
import './tarn-favorites';
import './tarn-focus';
import './tarn-notes';
import './tarn-tasks';
import './tarn-weather';
import './tarn-calendar';
import './tarn-code';
import {t} from '../i18n';
import {KINDS} from './kinds';

/**
 * Every widget, in one place. A widget is a self-contained custom element
 * (its own code, styles and storage, keyed by `widgetId`) plus one entry
 * here and one in kinds.ts (its name, note and glyph, which the settings
 * panel reads without loading the elements). The modules load
 * eagerly on purpose: a reload must draw every widget in its first frame
 * (see "Arrival in detail" in docs/architecture.md), and each widget is
 * only a few KB.
 */
export interface WidgetDefinition {
  /** The custom element that draws it. */
  readonly tag: string;
  /**
   * Has its own controls while arranging (Favorites: add and remove
   * sites; Weather: change the place). Its content stays live then; anything else is inert, and
   * dragging starts anywhere outside an element marked `data-edit`.
   */
  readonly editable?: boolean;
}

export const WIDGETS: Readonly<Record<WidgetKind, WidgetDefinition>> = {
  favorites: {tag: 'tarn-favorites', editable: true},
  notes: {tag: 'tarn-notes'},
  tasks: {tag: 'tarn-tasks'},
  focus: {tag: 'tarn-focus'},
  weather: {tag: 'tarn-weather', editable: true},
  calendar: {tag: 'tarn-calendar'},
  code: {tag: 'tarn-code'},
};

/**
 * The widget's element, bound to its stored content by id. `editing` is
 * true while widgets are being arranged (the settings panel is open);
 * `name` is the user's name for it, shown as its heading.
 */
export function renderWidget(
  kind: WidgetKind,
  id: string,
  editing = false,
  name?: string,
) {
  const definition = WIDGETS[kind];
  if (!definition) return html``;
  const tag = unsafeStatic(definition.tag);
  return html`<${tag}
    .widgetId=${id}
    .editing=${editing}
    .heading=${name ?? t(KINDS[kind].nameKey)}
  ></${tag}>`;
}
