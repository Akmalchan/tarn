/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Keeps the first-paint mirror current even when no Tarn tab is open, e.g.
// when settings change on another synced device.

import {mirrorSettings} from '../../app/mirror';
import {loadSettings, watchSettings} from '../../settings/store';

void loadSettings().then(mirrorSettings);
watchSettings(mirrorSettings);
