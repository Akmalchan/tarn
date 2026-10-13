/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {html, unsafeStatic} from 'lit/static-html.js';
import type {WidgetKind} from '../settings/schema';
import './tarn-favorites';
import './tarn-focus';
import './tarn-notes';
import './tarn-tasks';

/**
 * Every widget, in one place. A widget is a self-contained custom element
 * (its own code, styles and storage, keyed by `widgetId`) plus one entry
 * here; nothing else in Tarn needs to know about it. The modules load
 * eagerly on purpose: a reload must draw every widget in its first frame
 * (see Arrival in AGENTS.md), and each widget is only a few KB.
 */
export interface WidgetDefinition {
  readonly name: string;
  /** The custom element that draws it. */
  readonly tag: string;
  /**
   * Has its own controls while arranging (Favorites: add and remove
   * sites). Its content stays live then; anything else is inert, and
   * dragging starts anywhere outside an element marked `data-edit`.
   */
  readonly editable?: boolean;
}

export const WIDGETS: Readonly<Record<WidgetKind, WidgetDefinition>> = {
  favorites: {name: 'Favorites', tag: 'tarn-favorites', editable: true},
  notes: {name: 'Notes', tag: 'tarn-notes'},
  tasks: {name: 'Tasks', tag: 'tarn-tasks'},
  focus: {name: 'Focus timer', tag: 'tarn-focus'},
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
    .heading=${name ?? definition.name}
  ></${tag}>`;
}
