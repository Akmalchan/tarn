/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Loaded as a classic, blocking <script> in the new tab's <head>: it runs
// before the browser paints anything, which a module script cannot do.

import {defineUnlistedScript} from 'wxt/utils/define-unlisted-script';
import {prepareFirstPaint} from '../app/first-paint';

export default defineUnlistedScript(prepareFirstPaint);
