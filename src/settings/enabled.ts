/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {rememberEnabled} from '../app/first-paint';
import {reapplyRivals, restoreRivals} from '../takeover/rivals';
import type {Settings} from './schema';
import {saveSettings} from './store';

/**
 * Turns Tarn's new tab on or off everywhere: the synced setting, the
 * first-paint mirror, and any new-tab extensions Tarn replaced.
 */
export async function setTarnEnabled(enabled: boolean): Promise<Settings> {
  rememberEnabled(enabled);
  await (enabled ? reapplyRivals() : restoreRivals()).catch(() => {});
  return saveSettings({enabled});
}
