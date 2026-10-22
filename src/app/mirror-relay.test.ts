/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {DEFAULT_SETTINGS, type Settings} from '../settings/schema';
import {SETTINGS_KEY} from '../settings/store';
import {followMirror, serveMirror} from './mirror-relay';

/** A setup far from a new install's: another scene, no widgets, Tarn off. */
const MINE = {version: 1, scene: 'ember', widgets: [], enabled: false};

/** Lets queued promises and message hops finish. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('first-paint mirror relay (offscreen document)', () => {
  let mirrored: Settings[];
  const mirror = (settings: Settings) => void mirrored.push(settings);

  beforeEach(() => {
    fakeBrowser.reset();
    mirrored = [];
  });
  afterEach(() => vi.restoreAllMocks());

  it("mirrors the user's settings from the service worker, not defaults", async () => {
    await fakeBrowser.storage.sync.set({[SETTINGS_KEY]: MINE});
    serveMirror();
    followMirror(mirror);
    await settle();
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0]).toMatchObject({
      scene: 'ember',
      widgets: [],
      enabled: false,
    });
  });

  it("mirrors a new install's defaults when nothing is stored", async () => {
    serveMirror();
    followMirror(mirror);
    await settle();
    expect(mirrored).toEqual([DEFAULT_SETTINGS]);
  });

  it('mirrors nothing when no service worker answers', async () => {
    await fakeBrowser.storage.sync.set({[SETTINGS_KEY]: MINE});
    followMirror(mirror);
    await settle();
    expect(mirrored).toEqual([]);
  });

  it('mirrors nothing when the service worker cannot read settings', async () => {
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockRejectedValue(
      new Error('storage unavailable'),
    );
    serveMirror();
    followMirror(mirror);
    await settle();
    expect(mirrored).toEqual([]);
  });

  it('follows synced changes', async () => {
    serveMirror();
    followMirror(mirror);
    await settle();
    await fakeBrowser.storage.sync.set({
      [SETTINGS_KEY]: {...MINE, scene: 'wave'},
    });
    await settle();
    expect(mirrored.at(-1)).toMatchObject({scene: 'wave', enabled: false});
  });

  it('keeps a change that lands before the first answer', async () => {
    let answer!: (value: Record<string, unknown>) => void;
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockReturnValue(
      new Promise(resolve => (answer = resolve)) as never,
    );
    serveMirror();
    followMirror(mirror);
    await settle();
    await fakeBrowser.storage.sync.set({
      [SETTINGS_KEY]: {...MINE, scene: 'wave'},
    });
    await settle();
    answer({[SETTINGS_KEY]: MINE}); // Read before the change.
    await settle();
    expect(mirrored.map(s => s.scene)).toEqual(['wave']);
  });

  it('ignores storage.local writes (widget content)', async () => {
    serveMirror();
    followMirror(mirror);
    await settle();
    const before = mirrored.length;
    await fakeBrowser.storage.local.set({'widget.notes-a1': {text: 'hi'}});
    await settle();
    expect(mirrored).toHaveLength(before);
  });
});
