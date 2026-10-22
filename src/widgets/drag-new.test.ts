/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CODE_LIMIT} from './code/source';
import {droppedCode, fromPanel, newDragToken, newWidgetType} from './drag-new';

/** A drop carrying `data` by type, as a page sees it. */
const drop = (data: Record<string, string>) =>
  ({
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
  }) as unknown as DataTransfer;

beforeEach(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('fromPanel', () => {
  it("accepts only the panel's own drag, with this drag's token", () => {
    const token = newDragToken();
    expect(fromPanel(drop({[newWidgetType('notes')]: token}), 'notes')).toBe(
      true,
    );
    // A web page can name the type, not the secret.
    expect(fromPanel(drop({[newWidgetType('notes')]: 'notes'}), 'notes')).toBe(
      false,
    );
    expect(fromPanel(drop({[newWidgetType('notes')]: ''}), 'notes')).toBe(
      false,
    );
    // A newer drag makes the older token useless.
    newDragToken();
    expect(fromPanel(drop({[newWidgetType('notes')]: token}), 'notes')).toBe(
      false,
    );
  });

  it('reads the token from a custom widget drag', () => {
    const type = newWidgetType('code');
    const token = newDragToken();
    const code = (body: unknown) => drop({[type]: JSON.stringify(body)});
    expect(fromPanel(code({code: 'x', token}), 'code')).toBe(true);
    expect(fromPanel(code({code: 'x'}), 'code')).toBe(false);
    expect(fromPanel(drop({[type]: '{'}), 'code')).toBe(false);
  });
});

describe('droppedCode', () => {
  it('holds the name and code to their limits', () => {
    const got = droppedCode(
      drop({
        [newWidgetType('code')]: JSON.stringify({
          code: 'a'.repeat(CODE_LIMIT + 500),
          name: `  ${'n'.repeat(5000)}`,
        }),
      }),
    );
    expect(got?.code).toHaveLength(CODE_LIMIT);
    expect(got?.name).toHaveLength(40);
  });

  it('drops an empty name and refuses code that is not text', () => {
    const type = newWidgetType('code');
    expect(
      droppedCode(drop({[type]: JSON.stringify({code: 'x', name: ' '})})),
    ).toEqual({code: 'x'});
    expect(droppedCode(drop({[type]: JSON.stringify({code: 1})}))).toBeNull();
  });
});
