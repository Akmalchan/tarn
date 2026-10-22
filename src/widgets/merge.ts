/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Another tab changed a note or a task list while this one has typing not
// yet saved. Both sides came from `base`, the content as last loaded or
// saved here; these merge them so neither side's words are lost.

/** The span of `base` that `edited` replaced: [start, end in base, end in edited]. */
function changed(base: string, edited: string): [number, number, number] {
  let start = 0;
  const shortest = Math.min(base.length, edited.length);
  while (start < shortest && base[start] === edited[start]) start++;
  let tail = 0;
  while (
    tail < shortest - start &&
    base[base.length - 1 - tail] === edited[edited.length - 1 - tail]
  ) {
    tail++;
  }
  return [start, base.length - tail, edited.length - tail];
}

/**
 * Both edits, when they touch different parts of `base`. When they
 * overlap, ours (the text in front of the user), then what theirs added,
 * after `gap`.
 */
export function mergeText(
  base: string,
  ours: string,
  theirs: string,
  gap = '\n',
): string {
  if (ours === base || ours === theirs) return theirs;
  if (theirs === base) return ours;
  const [oStart, oEnd, oNewEnd] = changed(base, ours);
  const [tStart, tEnd, tNewEnd] = changed(base, theirs);
  if (oEnd < tStart) {
    return (
      ours.slice(0, oNewEnd) + base.slice(oEnd, tStart) + theirs.slice(tStart)
    );
  }
  if (tEnd < oStart) {
    return (
      theirs.slice(0, tNewEnd) + base.slice(tEnd, oStart) + ours.slice(oStart)
    );
  }
  const added = theirs.slice(tStart, tNewEnd).trim();
  return added && !ours.includes(added) ? ours + gap + added : ours;
}

/**
 * Where a caret at `at` in `before` belongs once the text became `after`:
 * it moves with an edit made in front of it.
 */
export function shiftCaret(before: string, after: string, at: number): number {
  const [start, end, newEnd] = changed(before, after);
  if (at <= start) return at;
  if (at >= end) return at + (newEnd - end);
  return newEnd;
}

interface Item {
  readonly id: string;
  readonly text: string;
}

/**
 * Two edits of one task list: tasks added on either side, each task's
 * text merged, and a task removed on one side stays removed unless the
 * other changed its text. Their order, with ours added at the top.
 */
export function mergeTasks<T extends Item>(
  base: readonly T[],
  ours: readonly T[],
  theirs: readonly T[],
): T[] {
  const was = new Map(base.map(task => [task.id, task]));
  const mine = new Map(ours.map(task => [task.id, task]));
  const merged: T[] = [];
  for (const task of theirs) {
    const old = was.get(task.id);
    const own = mine.get(task.id);
    if (!old) merged.push(own ?? task);
    else if (own) {
      merged.push({
        ...task,
        text: mergeText(old.text, own.text, task.text, ' '),
      });
    } else if (task.text !== old.text) merged.push(task);
  }
  const theirIds = new Set(theirs.map(task => task.id));
  const added = ours.filter(
    task =>
      !theirIds.has(task.id) &&
      (!was.has(task.id) || was.get(task.id)!.text !== task.text),
  );
  return [...added, ...merged];
}
