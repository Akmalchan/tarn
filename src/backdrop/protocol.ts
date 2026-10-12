/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {GhostFrame, Renderer} from './renderer';
import {sceneById} from './scenes';

/** Messages that drive a {@link Renderer}, locally or across a worker. */
export type RendererCommand =
  | {type: 'resize'; width: number; height: number}
  | {type: 'scene'; id: string}
  | {type: 'visible'; visible: boolean}
  | {type: 'reducedMotion'; reduced: boolean}
  | {type: 'tiles'; rects: number[]; strength: number; radius: number};

export interface WorkerInit {
  type: 'init';
  canvas: OffscreenCanvas;
  scene: string;
  clock?: number;
}

/** Asks the worker for a ghost frame; answered with the same id. */
export interface GhostRequest {
  type: 'ghost';
  id: number;
}

/** What the worker reports back to the page. */
export type WorkerEvent =
  | {type: 'firstFrame'}
  | {type: 'unavailable'}
  | {
      type: 'clock';
      clock: number;
      at: number;
      running: boolean;
      quality: number;
    }
  | {type: 'ghost'; id: number; ghost: GhostFrame | null};

export function applyCommand(
  renderer: Renderer,
  command: RendererCommand,
): void {
  switch (command.type) {
    case 'resize':
      renderer.resize(command.width, command.height);
      break;
    case 'scene':
      renderer.setScene(sceneById(command.id));
      break;
    case 'visible':
      renderer.setVisible(command.visible);
      break;
    case 'reducedMotion':
      renderer.setReducedMotion(command.reduced);
      break;
    case 'tiles':
      renderer.setTiles(command.rects, command.strength, command.radius);
      break;
  }
}
