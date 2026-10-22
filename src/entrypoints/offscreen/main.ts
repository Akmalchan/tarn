/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Keeps the first-paint mirror current even when no Tarn tab is open, e.g.
// when settings change on another synced device. This document can't read
// storage, so the settings come from the service worker (mirror-relay.ts).

import {mirrorSettings} from '../../app/mirror';
import {followMirror} from '../../app/mirror-relay';

followMirror(mirrorSettings);
