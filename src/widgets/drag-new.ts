/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import type {WidgetSize} from '../layout/bands';
import {WIDGET_KINDS, type WidgetKind} from '../settings/schema';

// Dragging a widget from the settings panel onto the page. The panel and
// the new tab are separate pages, so the kind travels in the drag data.
// While dragging, a page may only read the data's types, not the data,
// so the type itself names the kind: the page can show where it would
// land before the drop.

const PREFIX = 'application/x-tarn-widget-';
const SIZE_PREFIX = 'application/x-tarn-size-';
const SIZES: readonly WidgetSize[] = ['s', 'm', 'l', 'xl'];

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

/**
 * A size other than the kind's default (a custom widget example comes at
 * its own size), also named by a type so the page can show it while
 * dragging.
 */
export function newWidgetSizeType(size: WidgetSize): string {
  return SIZE_PREFIX + size;
}

/** The size being dragged in, if the drag names one. */
export function draggedSize(data: DataTransfer | null): WidgetSize | null {
  for (const type of data?.types ?? []) {
    const size = type.slice(SIZE_PREFIX.length) as WidgetSize;
    if (type.startsWith(SIZE_PREFIX) && SIZES.includes(size)) return size;
  }
  return null;
}

/** What a dragged custom widget brings: its code and name. */
export interface DraggedCode {
  readonly code: string;
  readonly name?: string;
}

/** The custom widget's code in a drop, or null if it brings none. */
export function droppedCode(data: DataTransfer | null): DraggedCode | null {
  try {
    const raw: unknown = JSON.parse(data?.getData(newWidgetType('code')) ?? '');
    if (!raw || typeof raw !== 'object') return null;
    const {code, name} = raw as Record<string, unknown>;
    if (typeof code !== 'string') return null;
    return typeof name === 'string' ? {code, name} : {code};
  } catch {
    return null;
  }
}
