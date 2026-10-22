/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

// Loaded render-blocking (index.html): the first frame already contains the
// clock and widgets, so a reload never shows the ghost frame without them.
// The app itself hands off to the browser's page when Tarn is switched off.
import '../../styles/global.css';
import '../../app/tarn-app';
import {localizeTitle} from '../../i18n';

localizeTitle('page.newTab');
