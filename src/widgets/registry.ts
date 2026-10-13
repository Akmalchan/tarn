/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {html, unsafeStatic} from 'lit/static-html.js';
import type {WidgetSize} from '../layout/bands';
import type {WidgetKind} from '../settings/schema';
import './tarn-favorites';
import './tarn-focus';
import './tarn-notes';

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
  /** Size when first added. */
  readonly size: WidgetSize;
}

export const WIDGETS: Readonly<Record<WidgetKind, WidgetDefinition>> = {
  favorites: {name: 'Favorites', tag: 'tarn-favorites', size: 'l'},
  notes: {name: 'Notes', tag: 'tarn-notes', size: 'm'},
  focus: {name: 'Focus timer', tag: 'tarn-focus', size: 's'},
};

/** The widget's element, bound to its stored content by id. */
export function renderWidget(kind: WidgetKind, id: string) {
  const definition = WIDGETS[kind];
  if (!definition) return html``;
  const tag = unsafeStatic(definition.tag);
  return html`<${tag} .widgetId=${id}></${tag}>`;
}
