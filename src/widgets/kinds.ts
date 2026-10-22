/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import type {MessageKey} from '../i18n';
import type {WidgetKind} from '../settings/schema';
import type {GlyphName} from '../ui/glyphs';

/** How a kind of widget is named and shown in settings. */
export interface KindInfo {
  /** Its name, also its default heading. */
  readonly nameKey: MessageKey;
  /** One line about it, under its name in settings. */
  readonly noteKey: MessageKey;
  readonly glyph: GlyphName;
}

/**
 * Data only, so the settings panel can read it without loading every
 * widget's element (registry.ts does that, for the page).
 */
export const KINDS: Readonly<Record<WidgetKind, KindInfo>> = {
  favorites: {
    nameKey: 'widget.favorites',
    noteKey: 'panel.widgetAbout.favorites',
    glyph: 'bookmark',
  },
  notes: {
    nameKey: 'widget.notes',
    noteKey: 'panel.widgetAbout.notes',
    glyph: 'note',
  },
  tasks: {
    nameKey: 'widget.tasks',
    noteKey: 'panel.widgetAbout.tasks',
    glyph: 'checklist',
  },
  weather: {
    nameKey: 'widget.weather',
    noteKey: 'panel.widgetAbout.weather',
    glyph: 'weather',
  },
  focus: {
    nameKey: 'widget.focus',
    noteKey: 'panel.widgetAbout.focus',
    glyph: 'timer',
  },
  calendar: {
    nameKey: 'widget.calendar',
    noteKey: 'panel.widgetAbout.calendar',
    glyph: 'calendar',
  },
  code: {
    nameKey: 'widget.code',
    noteKey: 'panel.widgetAbout.code',
    glyph: 'code',
  },
};
