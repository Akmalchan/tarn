/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

// Runs the renderer off the main thread so the page never waits on the GPU.

import {
  applyCommand,
  type GhostRequest,
  type RendererCommand,
  type WorkerEvent,
  type WorkerInit,
} from './protocol';
import {Renderer} from './renderer';

let renderer: Renderer | null = null;

const post = (event: WorkerEvent) => self.postMessage(event);

self.onmessage = (
  event: MessageEvent<WorkerInit | GhostRequest | RendererCommand>,
) => {
  const message = event.data;
  if (message.type === 'init') {
    renderer = new Renderer(message.canvas, message.scene, message.clock, {
      onFirstFrame: () => post({type: 'firstFrame'}),
      onSceneShown: id => post({type: 'sceneShown', id}),
      onUnavailable: () => post({type: 'unavailable'}),
      onClock: (clock, at, running, quality, rate) =>
        post({type: 'clock', clock, at, running, quality, rate}),
    });
  } else if (message.type === 'ghost') {
    void (renderer?.ghost() ?? Promise.resolve(null))
      .catch(() => null)
      .then(ghost => post({type: 'ghost', id: message.id, ghost}));
  } else if (renderer) {
    applyCommand(renderer, message);
  }
};
