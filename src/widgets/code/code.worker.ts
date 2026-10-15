/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

// Draws the page's custom widgets off the main thread (stage.ts).

import {CodeRenderer, type StageCommand} from './renderer';

const renderer = new CodeRenderer(event => self.postMessage(event));

self.onmessage = (event: MessageEvent<StageCommand>) => {
  renderer.apply(event.data);
};
