/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {WIDGET_KINDS, type WidgetKind} from '../settings/schema';

// Dragging a widget from the settings panel onto the page. The panel and
// the new tab are separate pages, so the kind travels in the drag data.
// While dragging, a page may only read the data's types, not the data,
// so the type itself names the kind: the page can show where it would
// land before the drop.

const PREFIX = 'application/x-tarn-widget-';

/** The drag data type that carries `kind`. */
export function newWidgetType(kind: WidgetKind): string {
  return PREFIX + kind;
}

/** The kind of widget being dragged in, or null for any other drag. */
export function draggedKind(data: DataTransfer | null): WidgetKind | null {
  for (const type of data?.types ?? []) {
    if (!type.startsWith(PREFIX)) continue;
    const kind = type.slice(PREFIX.length);
    if ((WIDGET_KINDS as readonly string[]).includes(kind)) {
      return kind as WidgetKind;
    }
  }
  return null;
}
