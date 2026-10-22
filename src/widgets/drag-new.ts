/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {readText, writeText} from '../app/web-storage';
import {WIDGET_SIZES, type WidgetSize} from '../layout/bands';
import {WIDGET_KINDS, type WidgetKind} from '../settings/schema';
import {CODE_LIMIT} from './code/source';

// Dragging a widget from the settings panel onto the page. The panel and
// the new tab are separate pages, so the kind travels in the drag data.
// While dragging, a page may only read the data's types, not the data,
// so the type itself names the kind: the page can show where it would
// land before the drop.

const PREFIX = 'application/x-tarn-widget-';
const SIZE_PREFIX = 'application/x-tarn-size-';
const TOKEN_KEY = 'tarn.dragToken';
/** A widget's name is at most this long (as in the settings). */
const NAME_LIMIT = 40;

/**
 * Any web page can start a drag with Tarn's types, so a drop must prove it
 * came from Tarn's panel: the panel puts a fresh secret in each drag's
 * data, kept where the tab can check it (both pages share the extension's
 * localStorage) and no web page can read it.
 */
export function newDragToken(): string {
  const token = crypto.randomUUID();
  return writeText(TOKEN_KEY, token) ? token : '';
}

function dragToken(): string {
  return readText(TOKEN_KEY) ?? '';
}

/** The drag data type that carries `kind` (its data: the drag's token). */
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
    if (type.startsWith(SIZE_PREFIX) && WIDGET_SIZES.includes(size))
      return size;
  }
  return null;
}

/** Whether a drop of `kind` came from Tarn's own panel (its token). */
export function fromPanel(
  data: DataTransfer | null,
  kind: WidgetKind,
): boolean {
  const token = dragToken();
  const raw = data?.getData(newWidgetType(kind)) ?? '';
  if (!token || !raw) return false;
  if (kind !== 'code') return raw === token;
  try {
    return (JSON.parse(raw) as {token?: unknown} | null)?.token === token;
  } catch {
    return false;
  }
}

/** What a dragged custom widget brings: its code and name. */
export interface DraggedCode {
  readonly code: string;
  readonly name?: string;
}

/**
 * The custom widget's code in a drop, or null if it brings none. Held to
 * the limits a saved widget keeps, so it can't overfill sync or storage.
 */
export function droppedCode(data: DataTransfer | null): DraggedCode | null {
  try {
    const raw: unknown = JSON.parse(data?.getData(newWidgetType('code')) ?? '');
    if (!raw || typeof raw !== 'object') return null;
    const {code, name} = raw as Record<string, unknown>;
    if (typeof code !== 'string') return null;
    const label =
      typeof name === 'string' ? name.trim().slice(0, NAME_LIMIT) : '';
    const capped = code.slice(0, CODE_LIMIT);
    return label ? {code: capped, name: label} : {code: capped};
  } catch {
    return null;
  }
}
