/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {keyed} from 'lit/directives/keyed.js';
import {browser} from 'wxt/browser';
import {mirrorSettings} from '../app/mirror';
import {CUSTOM_TAB_ICON_KEY} from '../app/first-paint';
import {newWidgetType} from '../widgets/drag-new';
import {answerPanelPresence} from '../app/side-panel';
import {
  DEFAULT_SCENE_ID,
  SCENES,
  sceneById,
  scenePreview,
  sceneTone,
} from '../backdrop/scenes';
import {loadLevel, type LoadLevel} from '../backdrop/scenes/load';
import type {Scene} from '../backdrop/scenes/types';
import {ScenePlayer} from './scene-live';
import type {WidgetSize} from '../layout/bands';
import {
  CLOCK_STYLES,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SIZE,
  MAX_WIDGETS,
  TAB_ICONS,
  WEATHER_PROVIDERS,
  WEATHER_UNITS,
  WIDGET_KINDS,
  WIDGET_SIZE_OPTIONS,
  newWidgetId,
  type ClockStyle,
  type Settings,
  type TabIcon,
  type WidgetEntry,
  type WeatherProvider,
  type WeatherUnits,
  type WidgetKind,
} from '../settings/schema';
import {getGoogleKey, setGoogleKey} from '../weather/config';
import {
  LANGUAGES,
  LANGUAGE_SETTINGS,
  LocaleController,
  locale,
  t,
  useLanguage,
  type LanguageSetting,
  type MessageKey,
} from '../i18n';
import {
  autoBackups,
  createBackup,
  downloadBackup,
  restoreAutoBackup,
  restoreBackup,
  type AutoBackupInfo,
  type TarnBackup,
} from '../settings/backup';
import {
  loadSettings,
  replaceSettings,
  saveSettings,
  watchSettings,
} from '../settings/store';
import {GLYPHS, type GlyphName} from '../ui/glyphs';
import {wordmark} from '../ui/wordmark';
import {
  clockText,
  clockTime,
  faceFilters,
  faceStyles,
} from '../widgets/clock-faces';
import {EXAMPLES, buildExample, type Example} from '../widgets/samples';
import {
  addWallpaper,
  deleteWallpaper,
  isPhotoId,
  listWallpapers,
  photoMirror,
  restoreWallpaper,
  WallpaperError,
  type WallpaperErrorCode,
  type WallpaperInfo,
} from '../wallpapers/store';

/**
 * The pages of the panel. Home shows what most people change; each section
 * ends in a row that opens more, and Advanced sits last. See
 * docs/design/settings-panel.md.
 */
type Page =
  'home' | 'backgrounds' | 'clock' | 'widgets' | 'language' | 'advanced';

/**
 * Home shows three choices per picker, then a "Show All" tile that opens
 * the page with all of them. The current choice is always among the three.
 */
const HOME_SCENES = 3;
const HOME_FACES: readonly ClockStyle[] = ['center', 'minimal', 'none'];

/**
 * Settings, docked in the browser's side panel next to the new tab. Every
 * change is saved immediately; open new tabs pick it up live through
 * storage change events.
 */
export class TarnPanel extends LitElement {
  static override properties = {
    settings: {state: true},
    customTabIcon: {state: true},
    page: {state: true},
    query: {state: true},
    toast: {state: true},
    jsonDraft: {state: true},
    jsonStatus: {state: true},
    confirmReset: {state: true},
    photos: {state: true},
    backups: {state: true},
    googleKey: {state: true},
  };

  static override styles = css`
    /* Light first, with a dark twin. Black and white; system greys. */
    :host {
      --bg: #f2f2f7;
      --group: #ffffff;
      --ink: #000000;
      --muted: rgb(60 60 67 / 0.6);
      --hair: rgb(60 60 67 / 0.2);
      --field: rgb(118 118 128 / 0.12);
      --tile: #000000;
      --tile-ink: #ffffff;
      --seg-on: #ffffff;
      --press: rgb(0 0 0 / 0.06);
      --track: rgb(120 120 128 / 0.22);
      --on: #000000;
      --knob-on: #ffffff;
      /* Row rhythm, desktop-sized like macOS System Settings. A row is
         a title line plus an optional description line; the icon's box is
         exactly that tall, so it centers on one or two lines and stays
         top-left when a description wraps further. */
      --title: 13.5px;
      --title-lh: 18px;
      --desc: 12px;
      --desc-lh: 16px;
      --icon: 24px;
      --icon-box: calc(var(--title-lh) + var(--desc-lh));
      --row-x: 12px;
      --row-gap: 10px;
      display: block;
      height: 100%;
      overflow-y: auto;
      color: var(--ink);
      background: var(--bg);
      font:
        400 var(--title) / var(--title-lh) var(--font-sans),
        system-ui,
        sans-serif;
      -webkit-font-smoothing: antialiased;
      color-scheme: light;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #000000;
        --group: #1c1c1e;
        --ink: #ffffff;
        --muted: rgb(235 235 245 / 0.6);
        --hair: rgb(84 84 88 / 0.65);
        --field: rgb(118 118 128 / 0.24);
        --tile: #ffffff;
        --tile-ink: #000000;
        --seg-on: #636366;
        --press: rgb(255 255 255 / 0.08);
        --track: rgb(120 120 128 / 0.32);
        --on: #ffffff;
        --knob-on: #000000;
        color-scheme: dark;
      }
    }

    .page {
      display: grid;
      gap: 22px;
      align-content: start;
      padding: 14px 16px 28px;
    }

    .page.forward {
      animation: forward 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .page.backward {
      animation: backward 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    @keyframes forward {
      from {
        transform: translateX(24px);
        opacity: 0.3;
      }
    }

    @keyframes backward {
      from {
        transform: translateX(-24px);
        opacity: 0.3;
      }
    }

    .top {
      display: grid;
      gap: 10px;
    }

    /* Sub-pages: an iOS-style bar, back on the left, the title centered. */
    .bar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      min-height: 30px;
    }

    .back {
      display: flex;
      align-items: center;
      justify-self: start;
      padding: 4px 8px 4px 0;
      font: inherit;
      color: var(--ink);
      background: none;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }

    .back svg {
      width: 18px;
      height: 18px;
      margin-left: -4px;
      fill: currentColor;
    }

    /* Home ends on a quiet, centered signature: the tarn wordmark faded,
       the browser it's for, the version, then Privacy and Source code. The
       top is left to search; Chrome's header already says "Settings". */
    .signature {
      display: grid;
      justify-items: center;
      padding: 26px 0 0;
      font-size: var(--desc);
      line-height: var(--desc-lh);
      color: var(--muted);
      text-align: center;
    }

    .signature svg {
      display: block;
      width: auto;
      height: 40px;
      margin-bottom: 10px;
      color: var(--ink);
      opacity: 0.16;
    }

    .signature .for {
      color: var(--ink);
      opacity: 0.6;
    }

    .signature .links {
      display: flex;
      gap: 6px;
      margin-top: 10px;
    }

    .signature a {
      color: inherit;
      text-decoration: none;
      border-radius: 4px;
    }

    .signature a:hover {
      color: var(--ink);
    }

    h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
    }

    .search {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 9px;
      color: var(--muted);
      background: var(--field);
      border-radius: 9px;
      transition: box-shadow 150ms ease;
    }

    /* Focus shows on the whole field, like macOS: a soft ring, no box
       around the text inside. */
    .search:focus-within {
      box-shadow: 0 0 0 3px var(--hair);
    }

    .search input:focus-visible {
      outline: none;
    }

    .search svg {
      flex: none;
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .search input {
      flex: 1;
      min-width: 0;
      font: inherit;
      color: var(--ink);
      background: none;
      border: 0;
      outline: none;
    }

    .search input::-webkit-search-cancel-button {
      display: none;
    }

    kbd {
      padding: 0 5px;
      font:
        500 11px ui-monospace,
        monospace;
      color: var(--muted);
      border: 1px solid var(--hair);
      border-radius: 5px;
    }

    section {
      display: grid;
      gap: 6px;
    }

    h2 {
      margin: 0 0 0 var(--row-x);
      font-size: 12px;
      font-weight: 400;
      color: var(--muted);
    }

    .group {
      overflow: hidden;
      background: var(--group);
      border-radius: 10px;
    }

    .row {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--row-gap);
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      padding: 5px var(--row-x);
      font: inherit;
      color: inherit;
      text-align: left;
      background: none;
      border: 0;
    }

    .row + .row::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      left: calc(var(--row-x) + var(--icon) + var(--row-gap));
      border-top: 0.5px solid var(--hair);
    }

    button.row {
      cursor: pointer;
    }

    button.row:hover:not(:disabled) {
      background: var(--press);
    }

    button.row:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .row[data-flash] {
      animation: flash 1.4s ease;
    }

    @keyframes flash {
      0%,
      45% {
        background: var(--field);
      }
    }

    .ico {
      display: grid;
      flex: none;
      place-items: center;
      align-self: flex-start;
      width: var(--icon);
      height: var(--icon);
      margin-block: calc((var(--icon-box) - var(--icon)) / 2);
      overflow: hidden;
      color: var(--tile-ink);
      background: var(--tile);
      border-radius: 6px;
    }

    .ico svg {
      width: 15px;
      height: 15px;
      fill: currentColor;
    }

    .txt {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sub {
      display: block;
      white-space: normal;
      font-size: var(--desc);
      line-height: var(--desc-lh);
      color: var(--muted);
    }

    .chev {
      flex: none;
      width: 13px;
      height: 13px;
      fill: var(--muted);
    }

    /* Lists without icons (Language): hairlines start at the text. */
    .plain .row + .row::before {
      left: var(--row-x);
    }

    .check {
      flex: none;
      width: 16px;
      height: 16px;
      fill: var(--ink);
    }

    /* The API key field: right-aligned, like a value. */
    .key {
      flex: 0 1 150px;
      min-width: 0;
      padding: 4px 8px;
      font: inherit;
      color: var(--ink);
      text-align: right;
      background: var(--field);
      border: 0;
      border-radius: 6px;
      outline: none;
    }

    /* A widget's name: plain text until clicked, then a field. */
    .name {
      flex: 1;
      min-width: 0;
      margin: 0 0 0 -5px;
      padding: 3px 5px;
      font: inherit;
      color: inherit;
      text-overflow: ellipsis;
      background: none;
      border: 0;
      border-radius: 6px;
      outline: none;
      cursor: text;
    }

    .name:hover {
      background: var(--press);
    }

    .name:focus {
      background: var(--field);
    }

    .value {
      flex: none;
      color: var(--muted);
    }

    .value.ink {
      color: var(--ink);
    }

    .sw {
      position: relative;
      flex: none;
      width: 34px;
      height: 20px;
      padding: 0;
      background: var(--track);
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition: background-color 200ms ease;
    }

    .sw::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow:
        0 1px 3px rgb(0 0 0 / 0.18),
        0 0 0 0.5px rgb(0 0 0 / 0.06);
      transition: transform 250ms cubic-bezier(0.3, 1.3, 0.6, 1);
    }

    .sw[aria-checked='true'] {
      background: var(--on);
    }

    .sw[aria-checked='true']::after {
      background: var(--knob-on);
      transform: translateX(14px);
    }

    .sw:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .seg {
      display: inline-flex;
      flex: none;
      justify-self: start;
      padding: 2px;
      background: var(--field);
      border-radius: 9px;
    }

    .seg button {
      min-width: 26px;
      padding: 3px 7px;
      font: 500 11.5px/16px var(--font-sans);
      color: var(--ink);
      background: none;
      border: 0;
      border-radius: 7px;
      cursor: pointer;
    }

    .seg button[aria-checked='true'] {
      background: var(--seg-on);
      box-shadow:
        0 3px 8px rgb(0 0 0 / 0.12),
        0 1px 1px rgb(0 0 0 / 0.06);
    }

    /* Pickers. Wallpapers are four big tiles on the page; the clock is a
       card of four square tiles. Either way the last tile is "Show All",
       which opens the page with every choice. Clock text is sized in
       container units, so a thumbnail is a true small copy at any width.
       Corners are concentric: the selection ring sits 4px out, so a tile
       in the card has the card's radius minus 4, and the ring traces the
       card's corner exactly. */
    .scenes {
      --ring-gap: var(--bg);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 12px;
    }

    .tiles {
      --ring-gap: var(--group);
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px 10px;
      padding: 12px 12px 10px;
    }

    .pick {
      display: grid;
      gap: 6px;
      min-width: 0;
      padding: 0;
      font: 500 var(--desc) / var(--desc-lh) var(--font-sans);
      color: var(--ink);
      text-align: center;
      background: none;
      border: 0;
      cursor: pointer;
    }

    .tiles .pick {
      font-size: 11.5px;
      line-height: 14px;
    }

    /* Under a wallpaper or clock card: its name on the left, and for
       wallpapers a gauge of how much it asks of the computer. */
    .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .scenes .meta {
      justify-content: space-between;
      padding: 0 2px;
    }

    .tiles .meta {
      justify-content: center;
    }

    .meta .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gauge {
      display: inline-grid;
      flex: none;
      color: var(--muted);
    }

    .gauge svg {
      width: 20px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
    }

    .gauge .arc {
      opacity: 0.35;
    }

    .gauge .arc.lit {
      opacity: 1;
    }

    .gauge line {
      stroke: var(--ink);
      stroke-width: 1.5;
    }

    .gauge circle {
      fill: var(--ink);
      stroke: none;
    }

    .row .favicon {
      width: var(--icon);
      height: var(--icon);
      padding: 4px;
      box-sizing: border-box;
      border-radius: 6px;
      background: var(--field);
    }

    /* Example setups: a compact row, not a list of rows. */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chips button {
      padding: 7px 12px;
      font: 500 12.5px var(--font-sans);
      color: var(--ink);
      background: var(--group);
      border: 0;
      border-radius: 999px;
      cursor: pointer;
    }

    .chips button:hover {
      background: var(--field);
    }

    .lead {
      margin: -4px var(--row-x) 4px;
      font-size: var(--desc);
      line-height: var(--desc-lh);
      color: var(--muted);
    }

    /* A widget to add: a row that can be picked up. */
    .add-row {
      cursor: grab;
    }

    .add-row:active:not(:disabled) {
      cursor: grabbing;
    }

    .add-row.dragging {
      opacity: 0.4;
    }

    .add-row .grip {
      flex: none;
      width: 7px;
      height: 11px;
      margin-left: auto;
      fill: var(--muted);
      opacity: 0.6;
    }

    /* A wallpaper playing inside its card (scene-live.ts). */
    .thumb {
      position: relative;
    }

    .thumb canvas.live {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 220ms ease;
    }

    .thumb canvas.live.shown {
      opacity: 1;
    }

    .thumb {
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 0.06em;
      aspect-ratio: 16 / 10;
      overflow: hidden;
      border-radius: 12px;
      box-shadow: inset 0 0 0 0.5px var(--hair);
      container-type: inline-size;
      transition: box-shadow 150ms ease;
    }

    .tiles .thumb {
      aspect-ratio: 1;
      border-radius: 6px;
    }

    .pick:hover .thumb {
      box-shadow:
        inset 0 0 0 0.5px var(--hair),
        0 0 0 2px var(--ring-gap),
        0 0 0 4px var(--hair);
    }

    .pick[aria-checked='true'] .thumb {
      box-shadow:
        0 0 0 2px var(--ring-gap),
        0 0 0 4px var(--ink);
    }

    /* A user's photo: the tile plus a delete badge on its corner, shown
       on hover or keyboard focus. */
    .photo {
      position: relative;
      display: grid;
      min-width: 0;
    }

    .photo .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .delete {
      position: absolute;
      top: -6px;
      right: -6px;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      padding: 0;
      color: var(--group);
      background: var(--ink);
      border: 2px solid var(--bg);
      border-radius: 50%;
      opacity: 0;
      cursor: pointer;
      transition: opacity 120ms ease;
    }

    .delete svg {
      width: 11px;
      height: 11px;
      fill: currentColor;
    }

    .photo:hover .delete,
    .delete:focus-visible {
      opacity: 1;
    }

    .thumb.more {
      position: relative;
      background: var(--field);
    }

    .thumb.more .veil {
      position: absolute;
      inset: -12%;
      opacity: 0.6;
      filter: blur(5cqi);
    }

    .thumb.more svg {
      position: relative;
      width: 16cqi;
      height: 16cqi;
      fill: currentColor;
    }

    .scenes .thumb.more svg {
      width: 11cqi;
      height: 11cqi;
    }

    .thumb.dark {
      color: #f4f7fb;
    }

    .thumb.light {
      color: #000000;
    }

    .thumb .t {
      font-size: 27cqi;
      font-weight: 200;
      line-height: 1;
      letter-spacing: -0.04em;
      font-variant-numeric: tabular-nums;
    }

    .scenes .thumb .t {
      font-size: 17cqi;
    }

    .thumb .d {
      font-size: 7.5cqi;
      white-space: nowrap;
      opacity: 0.75;
    }

    .scenes .thumb .d {
      font-size: 5cqi;
    }

    .scenes .thumb .off {
      font-size: 8cqi;
    }

    .thumb .off {
      font-size: 16cqi;
      opacity: 0.75;
    }

    /* The round plus and minus that add and remove widgets. */
    .action {
      display: block;
      flex: none;
      width: 20px;
      height: 20px;
      fill: var(--ink);
    }

    .remove {
      display: grid;
      flex: none;
      place-items: center;
      width: 28px;
      height: 28px;
      margin-right: -4px;
      padding: 0;
      background: none;
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .remove .action {
      fill: var(--muted);
    }

    .remove:hover .action {
      fill: var(--ink);
    }

    .keys {
      display: flex;
      gap: 4px;
      align-items: center;
      color: var(--muted);
    }

    .note,
    .none {
      margin: 0 var(--row-x);
      text-wrap: pretty;
      font-size: var(--desc);
      line-height: var(--desc-lh);
      color: var(--muted);
    }

    textarea {
      display: block;
      box-sizing: border-box;
      width: 100%;
      min-height: 220px;
      padding: 12px 14px;
      font:
        12px/1.5 ui-monospace,
        'SF Mono',
        Menlo,
        monospace;
      color: var(--ink);
      background: none;
      border: 0;
      resize: vertical;
      outline: none;
    }

    .actions {
      border-top: 0.5px solid var(--hair);
    }

    .status {
      flex: 1;
      font-size: var(--desc);
      color: var(--muted);
    }

    .text-button {
      padding: 4px 2px;
      font: 600 var(--title) var(--font-sans);
      color: var(--ink);
      background: none;
      border: 0;
      cursor: pointer;
    }

    .text-button:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .toast {
      position: fixed;
      right: 16px;
      bottom: 16px;
      left: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 11px 14px;
      font-size: var(--title);
      color: var(--bg);
      background: var(--ink);
      border-radius: 12px;
      box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.45);
    }

    .toast button {
      font: 600 var(--title) var(--font-sans);
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }

    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .page.forward,
      .page.backward,
      .row[data-flash] {
        animation: none;
      }
      .sw,
      .sw::after {
        transition: none;
      }
    }

    /* The faces last, so they win over the thumbnails' base text. */
    ${faceStyles}
  `;

  declare settings: Settings;
  /** The user's own tab icon on this computer, if any (a data URL). */
  declare customTabIcon: string | null;
  /** Plays a wallpaper inside its card while the pointer rests on it. */
  private player = new ScenePlayer();
  declare page: Page;
  declare query: string;
  declare toast: {text: string; undo?: () => void} | null;
  /** The settings.json being edited, or null to show the live settings. */
  declare jsonDraft: string | null;
  declare jsonStatus: string;
  declare confirmReset: boolean;
  /** The user's own wallpapers (src/wallpapers/store.ts), newest first. */
  declare photos: WallpaperInfo[];
  /** Setups Tarn saved before each update, newest first (settings/backup.ts). */
  declare backups: AutoBackupInfo[];
  /** The Google Weather API key, from storage.local (never synced). */
  declare googleKey: string;
  /** Object URLs of the photos' thumbnails, by id. */
  private photoUrls = new Map<string, string>();

  private unwatch: () => void = () => {};
  private direction: 'forward' | 'backward' | '' = '';
  /** A row to scroll to and highlight after the next render. */
  private flashTarget = '';
  private toastTimer = 0;
  private resetTimer = 0;
  private readonly version = browser.runtime.getManifest().version;

  constructor() {
    super();
    this.settings = DEFAULT_SETTINGS;
    this.customTabIcon = readCustomTabIcon();
    this.page = 'home';
    this.query = '';
    this.toast = null;
    this.jsonDraft = null;
    this.jsonStatus = '';
    this.confirmReset = false;
    this.photos = [];
    this.backups = [];
    this.googleKey = '';
    // Re-renders in the new words when the language changes.
    new LocaleController(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    answerPanelPresence();
    void loadSettings().then(s => this.onSettings(s));
    this.unwatch = watchSettings(s => this.onSettings(s));
    window.addEventListener('keydown', this.onKeyDown);
    // Another page added or deleted a photo: its mirror key changed.
    window.addEventListener('storage', this.onStorage);
    void this.loadPhotos();
    void autoBackups().then(list => (this.backups = list));
    void getGoogleKey().then(key => (this.googleKey = key));
  }

  private onSettings(settings: Settings): void {
    this.settings = settings;
    void useLanguage(settings.language);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.player.stop();
    this.unwatch();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('storage', this.onStorage);
    clearTimeout(this.toastTimer);
    clearTimeout(this.resetTimer);
    for (const url of this.photoUrls.values()) URL.revokeObjectURL(url);
    this.photoUrls.clear();
  }

  override updated(): void {
    if (!this.flashTarget) return;
    const row = this.renderRoot.querySelector<HTMLElement>(
      `[data-target='${this.flashTarget}']`,
    );
    this.flashTarget = '';
    if (!row) return;
    row.scrollIntoView({block: 'center'});
    row.setAttribute('data-flash', '');
    setTimeout(() => row.removeAttribute('data-flash'), 1400);
  }

  override render() {
    // On Wallpapers, Clock, Widgets and Language, search filters that
    // page's choices;
    // elsewhere it finds settings.
    const scoped = SCOPED_SEARCH[this.page];
    const body =
      this.query.trim() && !scoped
        ? this.renderResults()
        : {
            home: () => this.renderHome(),
            backgrounds: () => this.renderBackgrounds(),
            clock: () => this.renderClock(),
            widgets: () => this.renderWidgets(),
            language: () => this.renderLanguage(),
            advanced: () => this.renderAdvanced(),
          }[this.page]();
    return html`
      ${faceFilters}
      ${keyed(
        this.page,
        html`<div class="page ${this.direction}">
          <div class="top">
            ${
              this.page === 'home'
                ? nothing
                : html`<div class="bar">
                    <button class="back" @click=${() => this.go('home')}>
                      ${glyph('back')}${t('common.settings')}
                    </button>
                    <h1>${t(PAGE_TITLES[this.page])}</h1>
                  </div>`
            }
            <label class="search">
              ${glyph('search')}
              <input
                type="search"
                placeholder=${t(scoped ?? 'panel.search')}
                aria-label=${t(scoped ?? 'panel.searchSettings')}
                .value=${this.query}
                @input=${this.onSearch}
                @keydown=${this.onSearchKey}
              />
              <kbd>/</kbd>
            </label>
          </div>
          ${body}
        </div>`,
      )}
      ${
        this.toast
          ? html`<div class="toast" role="status">
              <span>${this.toast.text}</span>
              ${
                this.toast.undo
                  ? html`<button @click=${this.onUndo}>
                      ${t('panel.undo')}
                    </button>`
                  : nothing
              }
            </div>`
          : nothing
      }
      <input
        id="import"
        type="file"
        accept="application/json,.json"
        hidden
        @change=${this.onImportFile}
      />
      <input
        id="tab-icon"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
        hidden
        @change=${this.onTabIconFile}
      />
      <input
        id="photo"
        type="file"
        accept="image/*"
        multiple
        hidden
        @change=${this.onPhotoFiles}
      />
    `;
  }

  // Pages -------------------------------------------------------------------

  private renderHome() {
    const {widgets} = this.settings;
    const preview = clockPreview(this.art(this.settings.scene));
    const scenes = pickShown(
      SCENES.map(s => s.id),
      HOME_SCENES,
      this.settings.scene,
    );
    const faces = pickShown(HOME_FACES, HOME_FACES.length, this.settings.clock);
    // The background "Show All" tile shows a scene that isn't on home.
    const moreScene = SCENES.find(s => !scenes.includes(s.id)) ?? SCENES[0]!;
    return html`
      <section data-target="background">
        <h2>${t('panel.wallpaper')}</h2>
        <div
          class="scenes"
          role="radiogroup"
          aria-label=${t('panel.wallpaper')}
        >
          ${scenes.map(id => this.wallpaperButton(id))}
          <button class="pick" @click=${() => this.go('backgrounds')}>
            ${showAll(sceneArt(moreScene))}
            <span class="meta"
              ><span class="label">${t('panel.showAll')}</span></span
            >
          </button>
        </div>
      </section>

      <section data-target="clock">
        <h2>${t('panel.clock')}</h2>
        <div
          class="group tiles"
          role="radiogroup"
          aria-label=${t('panel.clock')}
        >
          ${faces.map(face => this.faceButton(face, preview))}
          <button class="pick" @click=${() => this.go('clock')}>
            ${showAll(preview.art)}
            <span class="meta"
              ><span class="label">${t('panel.showAll')}</span></span
            >
          </button>
        </div>
      </section>

      <div class="group">
        ${this.navRow(
          'widgets',
          t('panel.page.widgets'),
          widgets.length ? String(widgets.length) : t('panel.none'),
          'widgets',
          'widgets',
        )}
      </div>

      <div class="group">
        ${this.navRow(
          'globe',
          t('panel.page.language'),
          languageName(this.settings.language),
          'language',
          'language',
        )}
        ${this.navRow('sliders', t('panel.page.advanced'), '', 'advanced')}
      </div>

      <footer class="signature">
        ${wordmark('Tarn')}
        ${
          BROWSER
            ? html`<span class="for"
                >${t('panel.for', {browser: BROWSER})}</span
              >`
            : nothing
        }
        <span>${t('panel.version', {version: this.version})}</span>
        <span class="links">
          <a href=${PRIVACY_URL} target="_blank" rel="noopener"
            >${t('panel.privacy')}</a
          >
          <span aria-hidden="true">·</span>
          <a href=${SOURCE_URL} target="_blank" rel="noopener"
            >${t('panel.source')}</a
          >
        </span>
      </footer>
    `;
  }

  private renderBackgrounds() {
    const query = this.query.trim().toLowerCase();
    const matches = (name: string) => name.toLowerCase().includes(query);
    const scenes = SCENES.filter(scene => matches(scene.name));
    const photos = this.photos.filter(photo => matches(photo.name));
    return html`
      <div class="group" data-target="add-photo">
        <button class="row" @click=${this.pickPhoto}>
          ${icon('photo')}
          <span class="txt">${t('panel.addPhoto')}</span>
        </button>
      </div>

      ${
        photos.length
          ? html`<section data-target="photos">
              <h2>${t('panel.yourPhotos')}</h2>
              <div
                class="scenes"
                role="radiogroup"
                aria-label=${t('panel.yourPhotos')}
              >
                ${photos.map(photo => this.wallpaperButton(photo.id))}
              </div>
            </section>`
          : nothing
      }
      ${
        scenes.length
          ? html`<section data-target="all-backgrounds">
              ${this.photos.length ? html`<h2>${t('panel.live')}</h2>` : nothing}
              <div
                class="scenes"
                role="radiogroup"
                aria-label=${t('panel.wallpaper')}
              >
                ${scenes.map(scene => this.sceneButton(scene))}
              </div>
            </section>`
          : nothing
      }
      ${
        !scenes.length && !photos.length
          ? html`<p class="none">
              ${t('panel.noWallpapers', {query: this.query.trim()})}
            </p>`
          : nothing
      }
    `;
  }

  private renderClock() {
    const preview = clockPreview(this.art(this.settings.scene));
    const query = this.query.trim().toLowerCase();
    const faces = CLOCK_STYLES.filter(face =>
      t(FACE_NAMES[face]).toLowerCase().includes(query),
    );
    if (!faces.length) {
      return html`<p class="none">
        ${t('panel.noClocks', {query: this.query.trim()})}
      </p>`;
    }
    return html`
      <section data-target="all-faces">
        <div class="scenes" role="radiogroup" aria-label=${t('panel.clock')}>
          ${faces.map(face => this.faceButton(face, preview))}
        </div>
      </section>
    `;
  }

  private renderWidgets() {
    const {widgets} = this.settings;
    const full = widgets.length >= MAX_WIDGETS;
    const query = this.query.trim().toLowerCase();
    const matches = (kind: WidgetKind, name = '') =>
      !query ||
      [name, t(KIND_NAMES[kind]), t(KIND_NOTES[kind]), kind]
        .join(' ')
        .toLowerCase()
        .includes(query);
    const placed = widgets
      .map((widget, index) => ({widget, index}))
      .filter(({widget}) => matches(widget.kind, widget.name));
    const kinds = WIDGET_KINDS.filter(kind => matches(kind));
    if (query && !placed.length && !kinds.length) {
      return html`<p class="none">
        ${t('panel.noWidgets', {query: this.query.trim()})}
      </p>`;
    }
    return html`
      ${
        !query || placed.length
          ? html`<section data-target="widgets">
              <h2>${t('panel.widgets.onTab')}</h2>
              ${
                placed.length
                  ? html`<div class="group">
                        ${placed.map(({widget, index}) =>
                          this.widgetRow(widget, index),
                        )}
                      </div>
                      <p class="note">${t('panel.widgets.dragNote')}</p>`
                  : html`<p class="none">${t('panel.widgets.empty')}</p>`
              }
            </section>`
          : nothing
      }
      ${
        kinds.length
          ? html`<section>
              <h2>${t('panel.widgets.add')}</h2>
              <p class="lead">${t('panel.widgets.addHint')}</p>
              <div class="group">
                ${kinds.map(kind => this.widgetCard(kind, full))}
              </div>
              ${
                full
                  ? html`<p class="note">${t('panel.widgets.full')}</p>`
                  : nothing
              }
            </section>`
          : nothing
      }
    `;
  }

  /** Shows an example setup; Undo puts the user's widgets back. */
  private async tryExample(example: Example): Promise<void> {
    const previous = this.settings.widgets;
    const widgets = await buildExample(example.widgets);
    this.applyPatch({widgets});
    this.showToast(t('panel.examples.shown', {name: t(example.name)}), () =>
      this.applyPatch({widgets: previous}),
    );
  }

  /**
   * A widget to add, as a row: drag it onto the page to place it there
   * (the grip and the grab cursor say so), or click to add it at the end.
   */
  private widgetCard(kind: WidgetKind, full: boolean) {
    return html`
      <button
        class="row add-row"
        ?disabled=${full}
        draggable=${full ? 'false' : 'true'}
        title=${t('panel.widgets.addHint')}
        @click=${() => this.addWidget(kind)}
        @dragstart=${(event: DragEvent) => this.dragWidget(kind, event)}
        @dragend=${(event: DragEvent) =>
          (event.currentTarget as HTMLElement).classList.remove('dragging')}
      >
        ${icon(KIND_GLYPHS[kind])}
        <span class="txt"
          >${t(KIND_NAMES[kind])}
          <span class="sub">${t(KIND_NOTES[kind])}</span></span
        >
        <svg class="grip" viewBox="0 0 10 16" aria-hidden="true">
          <circle cx="3" cy="3" r="1.3" />
          <circle cx="7" cy="3" r="1.3" />
          <circle cx="3" cy="8" r="1.3" />
          <circle cx="7" cy="8" r="1.3" />
          <circle cx="3" cy="13" r="1.3" />
          <circle cx="7" cy="13" r="1.3" />
        </svg>
        <svg class="action" viewBox="0 0 24 24" aria-hidden="true">
          ${GLYPHS.plus}
        </svg>
      </button>
    `;
  }

  private renderAdvanced() {
    const {tabIcon} = this.settings;
    return html`
      ${
        import.meta.env.FIREFOX
          ? nothing
          : html`<section>
              <h2>${t('panel.tab')}</h2>
              <div class="group">
                <div class="row" data-target="tab-icon">
                  ${icon('tab')}
                  <span class="txt">${t('panel.tab.icon')}</span>
                  <div
                    class="seg"
                    role="radiogroup"
                    aria-label=${t('panel.tab.icon')}
                  >
                    ${TAB_ICONS.map(
                      value => html`
                        <button
                          role="radio"
                          aria-checked=${value === tabIcon}
                          @click=${() => this.setTabIcon(value)}
                        >
                          ${tabIconName(value)}
                        </button>
                      `,
                    )}
                  </div>
                </div>
                ${
                  tabIcon === 'custom' && this.customTabIcon
                    ? html`<button class="row" @click=${this.pickTabIcon}>
                        <img class="favicon" src=${this.customTabIcon} alt="" />
                        <span class="txt">${t('panel.tab.change')}</span>
                      </button>`
                    : nothing
                }
              </div>
              <p class="note">
                ${t(
                  tabIcon === 'none'
                    ? 'panel.tab.noteNone'
                    : tabIcon === 'custom'
                      ? 'panel.tab.noteCustom'
                      : 'panel.tab.noteBrowser',
                )}
              </p>
            </section>`
      }
      ${this.renderWeather()}

      <section>
        <h2>${t('panel.keys')}</h2>
        <div class="group">
          <div class="row" data-target="keys">
            ${icon('search')}
            <span class="txt">${t('panel.searchSettings')}</span>
            <span class="keys"><kbd>/</kbd></span>
          </div>
        </div>
      </section>

      <section>
        <h2>${t('panel.backup')}</h2>
        <div class="group">
          <button
            class="row"
            data-target="backup"
            @click=${this.exportSettings}
          >
            ${icon('share')}
            <span class="txt">${t('panel.backup.export')}</span>
          </button>
          <button class="row" @click=${this.pickImport}>
            ${icon('tray')}
            <span class="txt">${t('panel.backup.import')}</span>
          </button>
          <button class="row" data-target="reset" @click=${this.onReset}>
            ${icon('reset')}
            <span class="txt">${t('panel.backup.reset')}</span>
            ${
              this.confirmReset
                ? html`<span class="value ink"
                    >${t('panel.backup.confirm')}</span
                  >`
                : nothing
            }
          </button>
        </div>
        <p class="note">${t('panel.backup.note')}</p>
      </section>

      ${
        this.backups.length
          ? html`<section data-target="previous">
              <h2>${t('panel.previous')}</h2>
              <div class="group">
                ${this.backups.map(
                  (backup, index) => html`
                    <button
                      class="row"
                      @click=${() => void this.onRestoreAuto(index)}
                    >
                      ${icon('reset')}
                      <span class="txt">${formatWhen(backup.created)}</span>
                      <span class="value"
                        >${t('panel.previous.app', {version: backup.app})}</span
                      >
                    </button>
                  `,
                )}
              </div>
              <p class="note">${t('panel.previous.note')}</p>
            </section>`
          : nothing
      }
      ${
        // Raw settings, for working on Tarn; release builds don't show it.
        import.meta.env.DEV
          ? html`<section>
              <h2>${t('panel.json.file')}</h2>
              <div class="group" data-target="json">
                <textarea
                  spellcheck="false"
                  aria-label=${t('panel.json.file')}
                  .value=${this.jsonDraft ?? JSON.stringify(this.settings, null, 2)}
                  @input=${this.onJsonInput}
                ></textarea>
                <div class="row actions">
                  <span class="status"
                    >${this.jsonStatus || t('panel.json.hint')}</span
                  >
                  <button
                    class="text-button"
                    ?disabled=${this.jsonDraft === null}
                    @click=${this.applyJson}
                  >
                    ${t('panel.json.apply')}
                  </button>
                </div>
              </div>
            </section>`
          : nothing
      }

      <section data-target="examples">
        <h2>${t('panel.examples')}</h2>
        <div class="chips">
          ${EXAMPLES.map(
            example =>
              html`<button @click=${() => void this.tryExample(example)}>
                ${t(example.name)}
              </button>`,
          )}
        </div>
        <p class="note">${t('panel.examples.note')}</p>
      </section>

      <section>
        <h2>${t('panel.about')}</h2>
        <div class="group">
          <div class="row" data-target="about">
            ${icon('info')}
            <span class="txt">${t('panel.about.version')}</span>
            <span class="value">${this.version}</span>
          </div>
          <button class="row" @click=${this.copyDiagnostics}>
            ${icon('doc')}
            <span class="txt">${t('panel.about.diagnostics')}</span>
          </button>
        </div>
        <p class="note">${t('panel.about.diagnosticsNote')}</p>
      </section>
    `;
  }

  /**
   * The Language page: an iOS-style checklist, "Same as browser" first,
   * then every language in its own name.
   */
  private renderLanguage() {
    const current = this.settings.language;
    const query = this.query.trim().toLowerCase();
    const shown = LANGUAGE_SETTINGS.filter(
      setting => !query || languageWords(setting).includes(query),
    );
    if (!shown.length) {
      return html`<p class="none">
        ${t('panel.noLanguages', {query: this.query.trim()})}
      </p>`;
    }
    return html`
      <section data-target="language">
        <div
          class="group plain"
          role="radiogroup"
          aria-label=${t('panel.page.language')}
        >
          ${shown.map(
            setting => html`
              <button
                class="row"
                role="radio"
                aria-checked=${setting === current}
                lang=${setting === 'auto' ? nothing : setting}
                @click=${() => this.setLanguage(setting)}
              >
                <span class="txt">${languageName(setting)}</span>
                ${
                  setting === current
                    ? html`<svg
                        class="check"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        ${GLYPHS.check}
                      </svg>`
                    : nothing
                }
              </button>
            `,
          )}
        </div>
        <p class="note">${t('panel.language.note')}</p>
      </section>
    `;
  }

  /**
   * Weather: who to ask and in which units. Nothing is fetched until a
   * Weather widget is added and given a place (src/weather/).
   */
  private renderWeather() {
    const {provider, units} = this.settings.weather;
    const google = provider === 'google';
    return html`
      <section data-target="weather">
        <h2>${t('widget.weather')}</h2>
        <div class="group">
          <div class="row">
            ${icon('weather')}
            <span class="txt">${t('panel.weather.provider')}</span>
            <span
              class="seg"
              role="radiogroup"
              aria-label=${t('panel.weather.providerLabel')}
            >
              ${WEATHER_PROVIDERS.map(
                value => html`
                  <button
                    role="radio"
                    aria-checked=${value === provider}
                    @click=${() => this.setWeather({provider: value})}
                  >
                    ${PROVIDER_NAMES[value]}
                  </button>
                `,
              )}
            </span>
          </div>
          ${
            google
              ? html`<label class="row">
                  ${icon('key')}
                  <span class="txt">${t('panel.weather.apiKey')}</span>
                  <input
                    class="key"
                    type="password"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder=${t('panel.weather.pasteKey')}
                    .value=${this.googleKey}
                    @change=${this.onGoogleKey}
                  />
                </label>`
              : nothing
          }
          <div class="row">
            ${icon('thermometer')}
            <span class="txt">${t('panel.weather.units')}</span>
            <span
              class="seg"
              role="radiogroup"
              aria-label=${t('panel.weather.unitsLabel')}
            >
              ${WEATHER_UNITS.map(
                value => html`
                  <button
                    role="radio"
                    aria-checked=${value === units}
                    @click=${() => this.setWeather({units: value})}
                  >
                    ${value === 'auto' ? t('panel.weather.auto') : UNIT_NAMES[value]}
                  </button>
                `,
              )}
            </span>
          </div>
        </div>
        <p class="note">
          ${t(
            google ? 'panel.weather.noteGoogle' : 'panel.weather.noteOpenMeteo',
          )}
        </p>
      </section>
    `;
  }

  private renderResults() {
    const query = this.query.trim().toLowerCase();
    // Matches the words in the current language and in English, so either
    // finds a setting.
    const hits = SEARCH_INDEX.filter(entry =>
      `${t(entry.label)} ${t(entry.where)} ${entry.words}`
        .toLowerCase()
        .includes(query),
    );
    if (!hits.length) {
      return html`<p class="none">
        ${t('panel.noSettings', {query: this.query.trim()})}
      </p>`;
    }
    return html`
      <section>
        <h2>${t('panel.results')}</h2>
        <div class="group">
          ${hits.map(
            entry => html`
              <button
                class="row"
                @click=${() => this.go(entry.page, entry.target)}
              >
                ${icon(entry.glyph)}
                <span class="txt">${t(entry.label)}</span>
                <span class="value">${t(entry.where)}</span>
                ${chevron()}
              </button>
            `,
          )}
        </div>
      </section>
    `;
  }

  // Parts -------------------------------------------------------------------

  private sceneButton(scene: Scene) {
    return html`
      <button
        class="pick"
        role="radio"
        aria-checked=${scene.id === this.settings.scene}
        @click=${() => this.selectScene(scene.id)}
        @pointerenter=${(event: PointerEvent) => this.playScene(event, scene)}
        @pointerleave=${this.stopScene}
      >
        <span class="thumb" style="background: ${scenePreview(scene)}"></span>
        <span class="meta">
          <span class="label">${scene.name}</span>
          ${gauge(loadLevel(scene.id))}
        </span>
      </button>
    `;
  }

  /** Resting on a wallpaper plays it inside its card (scene-live.ts). */
  private playScene(event: PointerEvent, scene: Scene): void {
    const thumb = (
      event.currentTarget as HTMLElement
    ).querySelector<HTMLElement>('.thumb');
    if (thumb) this.player.play(thumb, scene);
  }

  private stopScene = () => this.player.stop();

  /** A built-in scene or one of the user's photos, by id. */
  private wallpaperButton(id: string) {
    if (!isPhotoId(id)) return this.sceneButton(sceneById(id));
    const photo = this.photos.find(p => p.id === id);
    const {background} = this.art(id);
    const name = photo?.name ?? t('panel.photo');
    return html`
      <span class="photo">
        <button
          class="pick"
          role="radio"
          aria-checked=${id === this.settings.scene}
          @click=${() => this.selectScene(id)}
        >
          <span class="thumb" style="background: ${background}"></span>
          <span class="meta">
            <span class="label">${name}</span>
            ${gauge('still')}
          </span>
        </button>
        ${
          photo
            ? html`<button
                class="delete"
                aria-label=${t('panel.deletePhotoNamed', {name})}
                title=${t('panel.deletePhoto')}
                @click=${() => void this.deletePhoto(id)}
              >
                ${glyph('close')}
              </button>`
            : nothing
        }
      </span>
    `;
  }

  /** A clock face, drawn on the current background so it previews truly. */
  private faceButton(face: ClockStyle, preview: ClockPreview) {
    const {art} = preview;
    return html`
      <button
        class="pick"
        role="radio"
        aria-checked=${face === this.settings.clock}
        @click=${() => this.applyPatch({clock: face})}
      >
        <span class="thumb ${art.tone}" style="background: ${art.background}">
          ${
            face === 'none'
              ? html`<span class="off">${t('panel.face.off')}</span>`
              : clockArt(face, preview)
          }
        </span>
        <span class="meta"
          ><span class="label">${t(FACE_NAMES[face])}</span></span
        >
      </button>
    `;
  }

  private widgetRow(widget: WidgetEntry, index: number) {
    const kindName = t(KIND_NAMES[widget.kind]);
    const name = widget.name ?? kindName;
    return html`
      <div class="row">
        ${icon(KIND_GLYPHS[widget.kind])}
        <input
          class="name"
          .value=${name}
          data-name=${name}
          maxlength="40"
          spellcheck="false"
          placeholder=${kindName}
          aria-label=${t('panel.widgets.nameOf', {name})}
          title=${t('board.rename')}
          @keydown=${this.onNameKey}
          @change=${(event: Event) =>
            this.renameWidget(index, (event.target as HTMLInputElement).value)}
        />
        <span
          class="seg"
          role="radiogroup"
          aria-label=${t('panel.widgets.sizeOf', {name})}
        >
          ${WIDGET_SIZE_OPTIONS[widget.kind].map(
            size => html`
              <button
                role="radio"
                title=${t(SIZE_NAMES[size])}
                aria-checked=${size === widget.size}
                @click=${() => this.resizeWidget(index, size)}
              >
                ${size.toUpperCase()}
              </button>
            `,
          )}
        </span>
        <button
          class="remove"
          aria-label=${t('board.removeWidget', {name})}
          title=${t('common.remove')}
          @click=${() => this.removeWidget(index)}
        >
          <svg class="action" viewBox="0 0 24 24" aria-hidden="true">
            ${GLYPHS.minus}
          </svg>
        </button>
      </div>
    `;
  }

  private navRow(
    glyphName: GlyphName,
    title: string,
    value: string,
    page: Page,
    target = '',
  ) {
    return html`
      <button
        class="row"
        data-target=${target || nothing}
        @click=${() => this.go(page)}
      >
        ${icon(glyphName)}
        <span class="txt">${title}</span>
        ${value ? html`<span class="value">${value}</span>` : nothing}
        ${chevron()}
      </button>
    `;
  }

  // Navigation and search ---------------------------------------------------

  private go(page: Page, target = ''): void {
    this.direction = page === 'home' ? 'backward' : 'forward';
    if (page === this.page) this.direction = '';
    this.page = page;
    this.query = '';
    this.flashTarget = target;
    this.jsonDraft = null;
    this.jsonStatus = '';
    this.scrollTop = 0;
  }

  private onSearch = (event: Event) => {
    this.query = (event.target as HTMLInputElement).value;
  };

  private onSearchKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.query = '';
      (event.target as HTMLInputElement).blur();
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
    const active = this.shadowRoot?.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement
    )
      return;
    event.preventDefault();
    this.renderRoot
      .querySelector<HTMLInputElement>('input[type=search]')
      ?.focus();
  };

  // Changes -----------------------------------------------------------------

  private addWidget(kind: WidgetKind): void {
    const widget: WidgetEntry = {
      id: newWidgetId(kind),
      kind,
      size: DEFAULT_WIDGET_SIZE[kind],
    };
    this.applyPatch({widgets: [...this.settings.widgets, widget]});
    this.showToast(t('panel.widgets.added', {name: t(KIND_NAMES[kind])}));
  }

  /** Dragged onto the page instead of clicked: the page adds it where it lands. */
  private dragWidget(kind: WidgetKind, event: DragEvent): void {
    if (!event.dataTransfer) return;
    (event.currentTarget as HTMLElement).classList.add('dragging');
    event.dataTransfer.setData(newWidgetType(kind), kind);
    event.dataTransfer.effectAllowed = 'copy';
  }

  private removeWidget(index: number): void {
    const removed = this.settings.widgets[index];
    if (!removed) return;
    this.applyPatch({
      widgets: this.settings.widgets.filter((_, i) => i !== index),
    });
    this.showToast(
      t('panel.widgets.removed', {
        name: removed.name ?? t(KIND_NAMES[removed.kind]),
      }),
      () => {
        const widgets = [...this.settings.widgets];
        widgets.splice(index, 0, removed);
        this.applyPatch({widgets});
      },
    );
  }

  /** Enter saves (by leaving the field); Escape puts the name back. */
  private onNameKey = (event: KeyboardEvent) => {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') input.blur();
    if (event.key === 'Escape') {
      input.value = input.dataset['name'] ?? input.placeholder;
      input.blur();
    }
  };

  /** An empty name, or the kind's own name, goes back to the default. */
  private renameWidget(index: number, value: string): void {
    const name = value.trim().slice(0, 40);
    this.applyPatch({
      widgets: this.settings.widgets.map((w, i) => {
        if (i !== index) return w;
        const {id, kind, size} = w;
        return name && name !== t(KIND_NAMES[kind])
          ? {id, kind, size, name}
          : {id, kind, size};
      }),
    });
  }

  private resizeWidget(index: number, size: WidgetSize): void {
    this.applyPatch({
      widgets: this.settings.widgets.map((w, i) =>
        i === index ? {...w, size} : w,
      ),
    });
  }

  /** Shows the change at once, then saves it; open tabs follow live. */
  private applyPatch(patch: Partial<Settings>): void {
    this.settings = {...this.settings, ...patch};
    void saveSettings(patch);
  }

  private pickTabIcon = () => {
    this.renderRoot.querySelector<HTMLInputElement>('#tab-icon')?.click();
  };

  /** A chosen image becomes the tab icon: 64px, clear parts kept. */
  private onTabIconFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const icon = await tabIconFromFile(file).catch(() => null);
    if (!icon) {
      this.showToast(t('panel.tab.badImage'));
      return;
    }
    try {
      localStorage.setItem(CUSTOM_TAB_ICON_KEY, icon);
    } catch {
      this.showToast(t('panel.tab.badImage'));
      return;
    }
    this.customTabIcon = icon;
    await this.setTabIcon('custom');
  };

  private async setTabIcon(tabIcon: TabIcon): Promise<void> {
    // Your own: pick an image first, unless one is already here.
    if (tabIcon === 'custom' && !this.customTabIcon) {
      this.pickTabIcon();
      return;
    }
    this.settings = {...this.settings, tabIcon};
    mirrorSettings(this.settings);
    this.settings = await saveSettings({tabIcon});
  }

  /** How any wallpaper looks as a thumbnail: its picture and its tone. */
  private art(id: string): Art {
    if (!isPhotoId(id)) return sceneArt(sceneById(id));
    const photo = this.photos.find(p => p.id === id);
    const mirrored = photoMirror()[id];
    const base = photo?.base ?? mirrored?.base;
    const tone = photo?.tone ?? mirrored?.tone;
    // Not on this computer (synced from another one): the default scene,
    // as the background itself falls back to it.
    if (!base || !tone) return sceneArt(sceneById(DEFAULT_SCENE_ID));
    const url = this.photoUrls.get(id);
    return {
      background: url
        ? `url('${url}') center / cover no-repeat, ${base}`
        : base,
      tone,
    };
  }

  private async loadPhotos(): Promise<void> {
    try {
      const photos = await listWallpapers();
      const ids = new Set(photos.map(p => p.id));
      for (const [id, url] of this.photoUrls) {
        if (ids.has(id)) continue;
        URL.revokeObjectURL(url);
        this.photoUrls.delete(id);
      }
      for (const photo of photos) {
        if (!this.photoUrls.has(photo.id)) {
          this.photoUrls.set(photo.id, URL.createObjectURL(photo.thumb));
        }
      }
      this.photos = photos;
    } catch (error) {
      console.error('Tarn: could not read your photos', error);
    }
  }

  private onStorage = (event: StorageEvent) => {
    if (event.key === 'tarn.photos') void this.loadPhotos();
  };

  private pickPhoto = () => {
    this.renderRoot.querySelector<HTMLInputElement>('#photo')?.click();
  };

  /** Adds each chosen image and shows the last one, as macOS does. */
  private onPhotoFiles = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    let added: WallpaperInfo | null = null;
    for (const file of files) {
      try {
        added = await addWallpaper(file);
      } catch (error) {
        this.showToast(
          t(
            error instanceof WallpaperError
              ? PHOTO_ERRORS[error.code]
              : 'panel.photoCantAdd',
          ),
        );
      }
    }
    await this.loadPhotos();
    if (added) {
      this.selectScene(added.id);
      this.showToast(t('panel.photoAdded'));
    }
  };

  private async deletePhoto(id: string): Promise<void> {
    const wasCurrent = this.settings.scene === id;
    const record = await deleteWallpaper(id);
    if (wasCurrent) this.selectScene(DEFAULT_SCENE_ID);
    await this.loadPhotos();
    if (!record) return;
    this.showToast(t('panel.photoDeleted', {name: record.info.name}), () => {
      void restoreWallpaper(record).then(async () => {
        await this.loadPhotos();
        if (wasCurrent) this.selectScene(id);
      });
    });
  }

  private selectScene(id: string): void {
    this.settings = {...this.settings, scene: id};
    // Mirror for first paint too, so the next new tab opens on it directly.
    mirrorSettings(this.settings);
    void saveSettings({scene: id});
  }

  /**
   * After a whole-setup change (import, reset, a restored backup): show the
   * stored settings and mirror them for first paint. `enabled` never comes
   * from a file; settings/store.ts keeps it.
   */
  private async reloadSettings(): Promise<void> {
    this.settings = await loadSettings();
    mirrorSettings(this.settings);
  }

  /** Restores a backup with Undo; `previous` resolves to what it replaced. */
  private async restoreWithUndo(
    previous: Promise<TarnBackup | null>,
    text: string,
  ): Promise<void> {
    const before = await previous;
    await this.reloadSettings();
    if (!before) return;
    this.showToast(text, () => {
      void restoreBackup(before).then(() => this.reloadSettings());
    });
  }

  // Advanced ----------------------------------------------------------------

  private exportSettings = async () => {
    try {
      await downloadBackup();
      this.showToast(t('panel.backup.saved'));
    } catch (error) {
      console.error('Tarn: export failed', error);
      this.showToast(t('panel.backup.cantSave'));
    }
  };

  private pickImport = () => {
    this.renderRoot.querySelector<HTMLInputElement>('#import')?.click();
  };

  private onImportFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      this.showToast(t('panel.backup.notBackup'));
      return;
    }
    await this.restoreWithUndo(restoreBackup(raw), t('panel.backup.imported'));
  };

  private onReset = () => {
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.resetTimer = window.setTimeout(
        () => (this.confirmReset = false),
        4000,
      );
      return;
    }
    clearTimeout(this.resetTimer);
    this.confirmReset = false;
    // Settings only: what's in your widgets stays, for Undo or a re-add.
    void this.restoreWithUndo(
      createBackup().then(async before => {
        await replaceSettings(DEFAULT_SETTINGS);
        return before;
      }),
      t('panel.backup.reset'),
    );
  };

  private setLanguage(language: LanguageSetting): void {
    this.applyPatch({language});
    void useLanguage(language);
  }

  private setWeather(
    patch: Partial<{
      provider: WeatherProvider;
      units: WeatherUnits;
    }>,
  ): void {
    this.applyPatch({weather: {...this.settings.weather, ...patch}});
  }

  private onGoogleKey = async (event: Event) => {
    const key = (event.target as HTMLInputElement).value.trim();
    await setGoogleKey(key);
    this.googleKey = key;
    this.showToast(
      t(key ? 'panel.weather.keySaved' : 'panel.weather.keyRemoved'),
    );
  };

  private async onRestoreAuto(index: number): Promise<void> {
    await this.restoreWithUndo(
      restoreAutoBackup(index),
      t('panel.previous.restored'),
    );
  }

  private onJsonInput = (event: Event) => {
    this.jsonDraft = (event.target as HTMLTextAreaElement).value;
    this.jsonStatus = '';
  };

  private applyJson = () => {
    if (this.jsonDraft === null) return;
    let raw: unknown;
    try {
      raw = JSON.parse(this.jsonDraft);
    } catch (error) {
      this.jsonStatus = t('panel.json.invalid', {
        error: (error as Error).message,
      });
      return;
    }
    this.jsonDraft = null;
    this.jsonStatus = t('panel.json.applied');
    void replaceSettings(raw).then(() => this.reloadSettings());
  };

  private copyDiagnostics = async () => {
    const report = {
      tarn: this.version,
      browser: navigator.userAgent,
      settings: this.settings,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      this.showToast(t('panel.about.copied'));
    } catch {
      this.showToast(t('panel.about.cantCopy'));
    }
  };

  private showToast(text: string, undo?: () => void): void {
    this.toast = {text, undo};
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), 4000);
  }

  private onUndo = () => {
    this.toast?.undo?.();
    this.toast = null;
  };
}

const glyph = (name: GlyphName) =>
  html`<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name]}</svg>`;

const icon = (name: GlyphName) => html`<span class="ico">${glyph(name)}</span>`;

const chevron = () =>
  html`<svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
    ${GLYPHS.chevron}
  </svg>`;

const PRIVACY_URL = 'https://github.com/Akmalchan/tarn/blob/main/PRIVACY.md';
const SOURCE_URL = 'https://github.com/Akmalchan/tarn';

/**
 * The browser Tarn runs in, for the signature's "for ..." line. Only names
 * a browser reports about itself; anything unrecognized shows no line.
 * "Google Chrome™" follows docs/brand/BRAND.md (descriptive use only).
 */
const BROWSER = ((): string => {
  if (import.meta.env.FIREFOX) return 'Firefox';
  const brands = (
    navigator as Navigator & {
      userAgentData?: {brands: Array<{brand: string}>};
    }
  ).userAgentData?.brands.map(b => b.brand);
  const known = ['Microsoft Edge', 'Opera', 'Brave', 'Vivaldi'];
  const other = known.find(name => brands?.includes(name));
  if (other) return other;
  return brands?.includes('Google Chrome') ? 'Google Chrome™' : '';
})();

const PAGE_TITLES: Record<Page, MessageKey> = {
  home: 'common.settings',
  backgrounds: 'panel.page.wallpapers',
  clock: 'panel.page.clock',
  widgets: 'panel.page.widgets',
  language: 'panel.page.language',
  advanced: 'panel.page.advanced',
};

/** The browser's short name for the tab icon choice ("Edge"), or "Browser". */
function tabIconName(value: TabIcon): string {
  if (value === 'none') return t('panel.none');
  if (value === 'custom') return t('panel.tab.custom');
  const short = BROWSER.replace(/^(Google|Microsoft) /, '').replace('™', '');
  return short || t('panel.tab.browser');
}

function readCustomTabIcon(): string | null {
  try {
    return localStorage.getItem(CUSTOM_TAB_ICON_KEY);
  } catch {
    return null;
  }
}

/**
 * An image file as a tab icon: 64px square, contained, clear parts kept
 * (a favicon is usually a logo on clear). Null if it can't be read.
 */
async function tabIconFromFile(file: Blob): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const {naturalWidth: w, naturalHeight: h} = image;
    if (!w || !h) return null;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const scale = size / Math.max(w, h);
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      (size - w * scale) / 2,
      (size - h * scale) / 2,
      w * scale,
      h * scale,
    );
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** "Same as browser", or the language in its own name ("Deutsch"). */
function languageName(setting: LanguageSetting): string {
  if (setting === 'auto') return t('panel.language.auto');
  return LANGUAGES.find(l => l.code === setting)?.name ?? setting;
}

/**
 * What finds a language: its own name, its name in the panel's language
 * and in English ("german" finds Deutsch), and its code.
 */
function languageWords(setting: LanguageSetting): string {
  if (setting === 'auto') {
    return `${t('panel.language.auto')} auto browser`.toLowerCase();
  }
  const names = [languageName(setting), setting];
  for (const inLanguage of [locale(), 'en']) {
    try {
      const name = new Intl.DisplayNames([inLanguage], {type: 'language'}).of(
        setting,
      );
      if (name) names.push(name);
    } catch {
      // No display names in this browser: the own name still matches.
    }
  }
  return names.join(' ').toLowerCase();
}

/** "Oct 13, 21:40", in the panel's language. */
function formatWhen(time: number): string {
  return new Date(time).toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A wallpaper as a thumbnail draws it: a CSS background and its tone. */
interface Art {
  background: string;
  tone: 'light' | 'dark';
}

function sceneArt(scene: Scene): Art {
  return {background: scenePreview(scene), tone: sceneTone(scene)};
}

/** What the clock face thumbnails show: the time now, on the wallpaper. */
interface ClockPreview {
  art: Art;
  time: string;
  date: string;
}

function clockPreview(art: Art): ClockPreview {
  const now = new Date();
  return {
    art,
    time: clockText(now),
    // The same format as the clock on the tab (widgets/tarn-clock.ts).
    date: now.toLocaleDateString(locale(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
  };
}

/** A "Show All" tile: a scene, blurred and faded, with a grid on it. */
function showAll(art: Art) {
  return html`<span class="thumb more ${art.tone}" aria-hidden="true">
    <span class="veil" style="background: ${art.background}"></span>
    ${glyph('grid')}
  </span>`;
}

/** Gauge needle angles, from resting (still) to heavier. */
const GAUGE_ANGLES: Record<LoadLevel, number> = {
  still: -80,
  light: -45,
  medium: 0,
  heavy: 45,
};

const GAUGE_LABELS: Record<LoadLevel, MessageKey> = {
  still: 'panel.load.still',
  light: 'panel.load.light',
  medium: 'panel.load.medium',
  heavy: 'panel.load.heavy',
};

/**
 * A small speedometer: how much a wallpaper asks of the computer, from
 * measurements (backdrop/scenes/load.ts).
 */
function gauge(level: LoadLevel) {
  const label = t('panel.load', {level: t(GAUGE_LABELS[level])});
  const angle = (GAUGE_ANGLES[level] * Math.PI) / 180;
  const x = 12 + 6.2 * Math.sin(angle);
  const y = 14 - 6.2 * Math.cos(angle);
  return html`<span class="gauge" role="img" aria-label=${label} title=${label}>
    <svg viewBox="0 0 24 17" aria-hidden="true">
      <path class="arc" d="M3.5 14a8.5 8.5 0 0 1 17 0" />
      <path
        class="arc lit"
        d="M3.5 14a8.5 8.5 0 0 1 17 0"
        pathLength="100"
        style="stroke-dasharray: ${((GAUGE_ANGLES[level] + 90) / 180) * 100} 100"
      />
      <line x1="12" y1="14" x2=${x.toFixed(2)} y2=${y.toFixed(2)} />
      <circle cx="12" cy="14" r="1.6" />
    </svg>
  </span>`;
}

/** The clock as a face draws it, for thumbnails and the preview. */
function clockArt(face: ClockStyle, {time, date}: ClockPreview) {
  if (face === 'none') return nothing;
  return html`<span class="t ${face}">${clockTime(face, time)}</span>
    ${face === 'minimal' ? nothing : html`<span class="d">${date}</span>`}`;
}

/**
 * The choices a home picker shows: the first few, with the current one
 * always among them (in the last place when it's further down the list),
 * so the choice is visible and the tiles don't reshuffle on every pick.
 */
function pickShown<T>(all: readonly T[], count: number, current: T): T[] {
  const shown = all.slice(0, count);
  if (shown.includes(current)) return shown;
  return [...shown.slice(0, -1), current];
}

const FACE_NAMES: Record<ClockStyle, MessageKey> = {
  center: 'panel.face.center',
  bold: 'panel.face.bold',
  minimal: 'panel.face.minimal',
  serif: 'panel.face.serif',
  stacked: 'panel.face.stacked',
  outline: 'panel.face.outline',
  pixel: 'panel.face.pixel',
  glass: 'panel.face.glass',
  rounded: 'panel.face.rounded',
  analog: 'panel.face.analog',
  flip: 'panel.face.flip',
  nixie: 'panel.face.nixie',
  lcd: 'panel.face.lcd',
  neon: 'panel.face.neon',
  fraktur: 'panel.face.fraktur',
  gotisch: 'panel.face.gotisch',
  none: 'panel.face.none',
};

/** Pages whose search filters their own choices: the field's placeholder. */
const SCOPED_SEARCH: Partial<Record<Page, MessageKey>> = {
  backgrounds: 'panel.searchWallpapers',
  clock: 'panel.searchClocks',
  widgets: 'panel.searchWidgets',
  language: 'panel.searchLanguages',
};

const KIND_NAMES: Record<WidgetKind, MessageKey> = {
  favorites: 'widget.favorites',
  notes: 'widget.notes',
  tasks: 'widget.tasks',
  weather: 'widget.weather',
  focus: 'widget.focus',
  calendar: 'widget.calendar',
};

const KIND_NOTES: Record<WidgetKind, MessageKey> = {
  favorites: 'panel.widgetAbout.favorites',
  notes: 'panel.widgetAbout.notes',
  tasks: 'panel.widgetAbout.tasks',
  weather: 'panel.widgetAbout.weather',
  focus: 'panel.widgetAbout.focus',
  calendar: 'panel.widgetAbout.calendar',
};

const PHOTO_ERRORS: Record<WallpaperErrorCode, MessageKey> = {
  notImage: 'panel.photoNotImage',
  tooLarge: 'panel.photoTooLarge',
  cantOpen: 'panel.photoCantOpen',
  cantProcess: 'panel.photoCantAdd',
};

const KIND_GLYPHS: Record<WidgetKind, GlyphName> = {
  favorites: 'bookmark',
  notes: 'note',
  tasks: 'checklist',
  weather: 'weather',
  focus: 'timer',
  calendar: 'calendar',
};

const PROVIDER_NAMES: Record<WeatherProvider, string> = {
  'open-meteo': 'Open-Meteo',
  google: 'Google',
};

/** Symbols, the same in every language; Auto is translated where shown. */
const UNIT_NAMES: Record<WeatherUnits, string> = {
  auto: 'Auto',
  celsius: '°C',
  fahrenheit: '°F',
};

const SIZE_NAMES: Record<WidgetSize, MessageKey> = {
  s: 'panel.size.s',
  m: 'panel.size.m',
  l: 'panel.size.l',
  xl: 'panel.size.xl',
};

interface SearchEntry {
  label: MessageKey;
  where: MessageKey;
  page: Page;
  target: string;
  glyph: GlyphName;
  words: string;
}

/** What search finds, and where each setting lives. */
const SEARCH_INDEX: readonly SearchEntry[] = [
  {
    label: 'panel.wallpaper',
    where: 'common.settings',
    page: 'home',
    target: 'background',
    glyph: 'photo',
    words: `scene background ${SCENES.map(s => s.name).join(' ')}`,
  },
  {
    label: 'panel.clock',
    where: 'common.settings',
    page: 'home',
    target: 'clock',
    glyph: 'clock',
    words:
      'time date face classic glass bold rounded minimal serif stacked outline pixel 8-bit retro flip nixie lcd digital neon gothic fraktur gotisch analog dial hide',
  },
  {
    label: 'panel.page.widgets',
    where: 'common.settings',
    page: 'widgets',
    target: 'widgets',
    glyph: 'widgets',
    words:
      'bookmarks favorites sites folders notes tasks timer focus weather calendar add remove size',
  },
  {
    label: 'panel.page.language',
    where: 'common.settings',
    page: 'language',
    target: 'language',
    glyph: 'globe',
    words:
      'language translate english español português français deutsch русский 日本語 简体中文 한국어 türkçe idioma langue sprache язык 言語 语言 언어 dil língua',
  },
  ...(import.meta.env.FIREFOX
    ? []
    : ([
        {
          label: 'panel.tab.icon',
          where: 'panel.page.advanced',
          page: 'advanced',
          target: 'tab-icon',
          glyph: 'tab',
          words: 'favicon chrome none',
        },
      ] satisfies SearchEntry[])),
  {
    label: 'widget.weather',
    where: 'panel.page.advanced',
    page: 'advanced',
    target: 'weather',
    glyph: 'weather',
    words:
      'forecast temperature celsius fahrenheit provider google open-meteo api key',
  },
  {
    label: 'panel.keys.shortcuts',
    where: 'panel.page.advanced',
    page: 'advanced',
    target: 'keys',
    glyph: 'keyboard',
    words: 'keys hotkeys',
  },
  {
    label: 'panel.examples',
    where: 'panel.page.advanced',
    page: 'advanced',
    target: 'examples',
    glyph: 'grid',
    words: 'examples setups layouts sample demo try',
  },
  {
    label: 'panel.backup.search',
    where: 'panel.page.advanced',
    page: 'advanced',
    target: 'backup',
    glyph: 'share',
    words: 'backup export import file save restore previous setup update',
  },
  {
    label: 'panel.backup.reset',
    where: 'panel.page.advanced',
    page: 'advanced',
    target: 'reset',
    glyph: 'reset',
    words: 'reset defaults start over',
  },
  ...(import.meta.env.DEV
    ? ([
        {
          label: 'panel.json.file',
          where: 'panel.page.advanced',
          page: 'advanced',
          target: 'json',
          glyph: 'doc',
          words: 'json raw edit developer',
        },
      ] satisfies SearchEntry[])
    : []),
  {
    label: 'panel.about.search',
    where: 'panel.page.advanced',
    page: 'advanced',
    target: 'about',
    glyph: 'info',
    words: 'about version debug copy bug',
  },
];

customElements.define('tarn-panel', TarnPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-panel': TarnPanel;
  }
}
