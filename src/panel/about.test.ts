/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {
  RELEASES,
  feedbackUrl,
  hasUnseenUpdate,
  markUpdateSeen,
  markUpdateUnseen,
} from './about';
import {version as packageVersion} from '../../package.json';

describe("What's new", () => {
  it('has notes for this version: a version bump writes them', () => {
    expect(RELEASES[0]?.version).toBe(packageVersion);
  });

  it('lists each release once, newest first, with a few notes', () => {
    const versions = RELEASES.map(release => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    const sorted = [...versions].sort((a, b) =>
      b.localeCompare(a, 'en', {numeric: true}),
    );
    expect(versions).toEqual(sorted);
    for (const release of RELEASES) {
      expect(release.notes.length).toBeGreaterThan(0);
      expect(release.notes.length).toBeLessThanOrEqual(5);
    }
  });

  describe('the dot after an update', () => {
    beforeEach(() => fakeBrowser.reset());

    it('shows after an update until What’s new is opened', async () => {
      expect(await hasUnseenUpdate()).toBe(false);
      await markUpdateUnseen();
      expect(await hasUnseenUpdate()).toBe(true);
      await markUpdateSeen();
      expect(await hasUnseenUpdate()).toBe(false);
    });
  });
});

describe('feedback', () => {
  it('opens a new GitHub issue with the version filled in', () => {
    const url = new URL(feedbackUrl('1.2.3'));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/Akmalchan/tarn/issues/new',
    );
    expect(url.searchParams.get('body')).toContain('Tarn 1.2.3');
  });
});
