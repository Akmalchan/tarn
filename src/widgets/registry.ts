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
import './tarn-weather';
import './tarn-calendar';
import './tarn-code';
import {t, type MessageKey} from '../i18n';

/**
 * Every widget, in one place. A widget is a self-contained custom element
 * (its own code, styles and storage, keyed by `widgetId`) plus one entry
 * here; nothing else in Tarn needs to know about it. The modules load
 * eagerly on purpose: a reload must draw every widget in its first frame
 * (see Arrival in AGENTS.md), and each widget is only a few KB.
 */
export interface WidgetDefinition {
  /** Its name, also its default heading. */
  readonly nameKey: MessageKey;
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
  favorites: {
    nameKey: 'widget.favorites',
    tag: 'tarn-favorites',
    editable: true,
  },
  notes: {nameKey: 'widget.notes', tag: 'tarn-notes'},
  tasks: {nameKey: 'widget.tasks', tag: 'tarn-tasks'},
  focus: {nameKey: 'widget.focus', tag: 'tarn-focus'},
  weather: {nameKey: 'widget.weather', tag: 'tarn-weather', editable: true},
  calendar: {nameKey: 'widget.calendar', tag: 'tarn-calendar'},
  code: {nameKey: 'widget.code', tag: 'tarn-code'},
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
    .heading=${name ?? t(definition.nameKey)}
  ></${tag}>`;
}
