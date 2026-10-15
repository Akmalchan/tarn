/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

import {t} from '../i18n';

/**
 * The first content of the start widgets (START_WIDGETS in settings), shown
 * until the user changes it: then their own content is saved and this is
 * never used again. Not saved before that, so the words follow the
 * language until then.
 */
export function startContent(id: string): unknown {
  switch (id) {
    case 'favorites-start':
      return [
        {url: 'https://www.youtube.com/', title: 'YouTube'},
        {url: 'https://mail.google.com/', title: 'Gmail'},
        {url: 'https://maps.google.com/', title: 'Maps'},
        {url: 'https://drive.google.com/', title: 'Drive'},
        {url: 'https://www.wikipedia.org/', title: 'Wikipedia'},
        {url: 'https://www.reddit.com/', title: 'Reddit'},
        {url: 'https://chatgpt.com/', title: 'ChatGPT'},
        {url: 'https://www.netflix.com/', title: 'Netflix'},
      ];
    case 'notes-start':
      return t('start.note');
    default:
      return undefined;
  }
}
