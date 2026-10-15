/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {SETTINGS_KEY} from '../settings/store';
import {TIP_TABS, finishTip, markFirstRun, takeTip} from './first-run';

describe('first-run tip', () => {
  beforeEach(() => fakeBrowser.reset());

  it('never shows without a fresh install (updates, old installs)', async () => {
    expect(await takeTip()).toBe(false);
  });

  it(`shows on the first ${TIP_TABS} new tabs, then gives up`, async () => {
    await markFirstRun();
    for (let i = 0; i < TIP_TABS; i++) expect(await takeTip()).toBe(true);
    expect(await takeTip()).toBe(false);
    expect(await takeTip()).toBe(false);
  });

  it('stops for good once dismissed or settings open', async () => {
    await markFirstRun();
    expect(await takeTip()).toBe(true);
    await finishTip();
    expect(await takeTip()).toBe(false);
  });

  it('skips a computer whose settings came through sync', async () => {
    await fakeBrowser.storage.sync.set({[SETTINGS_KEY]: {version: 1}});
    await markFirstRun();
    expect(await takeTip()).toBe(false);
  });

  it('retires when synced settings arrive after the install', async () => {
    await markFirstRun();
    await fakeBrowser.storage.sync.set({[SETTINGS_KEY]: {version: 1}});
    expect(await takeTip()).toBe(false);
  });

  it('survives a damaged stored value', async () => {
    await markFirstRun();
    await fakeBrowser.storage.local.set({'tip.settings': {shown: 'x'}});
    expect(await takeTip()).toBe(true);
  });
});
