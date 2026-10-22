/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {mergeTasks, mergeText, shiftCaret} from './merge';

describe('mergeText', () => {
  it("takes the other tab's text when nothing was typed here", () => {
    expect(mergeText('Milk', 'Milk', 'Milk, eggs')).toBe('Milk, eggs');
  });

  it('keeps what was typed here when only this side changed', () => {
    expect(mergeText('Milk', 'Milk, bread', 'Milk')).toBe('Milk, bread');
  });

  it('keeps both edits when they touch different lines', () => {
    const base = 'Milk\nEggs\nTea';
    expect(
      mergeText(base, 'Oat milk\nEggs\nTea', 'Milk\nEggs\nGreen tea'),
    ).toBe('Oat milk\nEggs\nGreen tea');
    expect(
      mergeText(base, 'Milk\nEggs\nGreen tea', 'Oat milk\nEggs\nTea'),
    ).toBe('Oat milk\nEggs\nGreen tea');
  });

  it('keeps this side and adds theirs when both edit one spot', () => {
    expect(mergeText('Call', 'Call mom', 'Call dad')).toBe('Call mom\ndad');
    expect(mergeText('', 'Mine', 'Theirs')).toBe('Mine\nTheirs');
  });

  it('adds nothing twice', () => {
    expect(mergeText('a', 'a b c', 'a b')).toBe('a b c');
  });
});

describe('shiftCaret', () => {
  it('moves with text added in front of it, not behind it', () => {
    expect(shiftCaret('world', 'hello world', 2)).toBe(8);
    expect(shiftCaret('hello', 'hello world', 2)).toBe(2);
    expect(shiftCaret('hello world', 'world', 8)).toBe(2);
  });
});

describe('mergeTasks', () => {
  const task = (id: string, text: string) => ({id, text});
  const base = [task('a', 'Milk'), task('b', 'Eggs')];

  it("takes the other tab's list when nothing changed here", () => {
    const theirs = [task('c', 'Tea'), task('a', 'Milk')];
    expect(mergeTasks(base, base, theirs)).toEqual(theirs);
  });

  it('keeps tasks added on both sides', () => {
    const ours = [task('x', 'Bread'), ...base];
    const theirs = [task('y', 'Tea'), ...base];
    expect(mergeTasks(base, ours, theirs)).toEqual([
      task('x', 'Bread'),
      task('y', 'Tea'),
      ...base,
    ]);
  });

  it('keeps a removal, unless the other side changed the task', () => {
    const ours = [task('a', 'Milk')];
    expect(mergeTasks(base, ours, base)).toEqual(ours);
    expect(
      mergeTasks(base, ours, [task('a', 'Milk'), task('b', 'Six eggs')]),
    ).toEqual([task('a', 'Milk'), task('b', 'Six eggs')]);
    const edited = [task('a', 'Milk'), task('b', 'Six eggs')];
    expect(mergeTasks(base, edited, [task('a', 'Milk')])).toEqual([
      task('b', 'Six eggs'),
      task('a', 'Milk'),
    ]);
  });

  it("merges one task's text edited on both sides", () => {
    const ours = [task('a', 'Oat milk'), task('b', 'Eggs')];
    const theirs = [task('a', 'Milk'), task('b', 'Eggs, six')];
    expect(mergeTasks(base, ours, theirs)).toEqual([
      task('a', 'Oat milk'),
      task('b', 'Eggs, six'),
    ]);
  });
});
