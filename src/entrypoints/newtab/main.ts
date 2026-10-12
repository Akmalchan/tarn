/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {isRememberedOff} from '../../app/first-paint';
import {handOffToBrowserNewTab} from '../../app/handoff';
import '../../styles/global.css';

async function start(): Promise<void> {
  if (isRememberedOff() && (await handOffToBrowserNewTab())) return;
  await import('../../app/tarn-app');
}

void start();
