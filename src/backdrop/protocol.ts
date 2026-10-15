/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import type {GhostFrame, Pace, Renderer} from './renderer';
import type {Scene} from './scenes/types';

/**
 * Messages that drive a {@link Renderer}, locally or across a worker.
 * Scenes travel whole, resolved by the page: a worker can't read the
 * localStorage index that describes the user's photos.
 */
export type RendererCommand =
  | {type: 'resize'; width: number; height: number}
  | {type: 'scene'; scene: Scene}
  | {type: 'visible'; visible: boolean}
  | {type: 'reducedMotion'; reduced: boolean}
  | {type: 'tiles'; rects: number[]; strength: number; radius: number}
  | {type: 'pace'; pace: Pace};

export interface WorkerInit {
  type: 'init';
  canvas: OffscreenCanvas;
  scene: Scene;
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
  /** A frame of this scene is on screen (a photo may take a moment). */
  | {type: 'sceneShown'; id: string}
  | {type: 'unavailable'}
  | {
      type: 'clock';
      clock: number;
      at: number;
      running: boolean;
      quality: number;
      /** Animation speed multiplier right now (pace). */
      rate: number;
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
      renderer.setScene(command.scene);
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
    case 'pace':
      renderer.setPace(command.pace);
      break;
  }
}
