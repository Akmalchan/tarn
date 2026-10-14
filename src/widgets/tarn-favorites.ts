/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  css,
  html,
  nothing,
  unsafeCSS,
  type PropertyValues,
} from 'lit';
import {live} from 'lit/directives/live.js';
import {repeat} from 'lit/directives/repeat.js';
import {
  lastBookmarksBar,
  readBookmarksBar,
  rememberBookmarksBar,
  watchBookmarks,
} from './bookmarks';
import {
  loadWidgetData,
  peekWidgetData,
  peekWidgetDataStored,
  saveWidgetData,
  watchWidgetData,
  widgetDataStored,
} from './data';
import {SiteDrag, type DragResult, type DragState} from './favorites-drag';
import {
  MAX_FOLDER_SITES,
  MAX_ITEMS,
  allSites,
  dropInto,
  fromBookmarks,
  isFolder,
  moveEntry,
  moveInFolder,
  nameOf,
  normalizeItems,
  putSite,
  removeAt,
  renameFolder,
  siteAt,
  takeOut,
  toUrl,
  type Folder,
  type Item,
  type Place,
  type Site,
} from './favorites-model';
import {
  DARK_CHIP,
  iconFromFile,
  lastSiteIcon,
  siteHue,
  siteIcon,
  type FoundIcon,
} from './site-icon';
import {sheetStyles, widgetStyles} from './styles';
import {LocaleController, t} from '../i18n';

/** The site being edited: where it is (null for a new one) and where it goes. */
interface Editor {
  readonly place: Place | null;
  /** A folder's index, or null for the widget itself. */
  readonly dest: number | null;
}

/** Which grid a drag is in: the widget's own, or the open folder's. */
type Scope = 'main' | 'folder';

/** Stable keys for items across re-renders, so moves can animate. */
const keys = new WeakMap<object, string>();
let nextKey = 0;
function keyOf(item: object): string {
  let key = keys.get(item);
  if (!key) keys.set(item, (key = `k${nextKey++}`));
  return key;
}

// Drawn, not typed: a font's × and + sit a pixel off center.
const CROSS = html`<svg viewBox="0 0 10 10" aria-hidden="true">
  <path d="M2.75 2.75l4.5 4.5m0-4.5l-4.5 4.5" />
</svg>`;
const PLUS = html`<svg viewBox="0 0 16 16" aria-hidden="true">
  <path d="M8 3.5v9M3.5 8h9" />
</svg>`;
const CHEVRON = html`<svg
  class="chevron"
  viewBox="0 0 10 10"
  aria-hidden="true"
>
  <path d="M3 4l2 2 2-2" />
</svg>`;

/** An open folder's columns: rows as even as they can be, at most six. */
function columnsFor(count: number): number {
  if (count <= 6) return Math.max(3, count);
  if (count <= 8) return 4;
  return count <= 10 ? 5 : 6;
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Your sites, one click away, in folders if you like (one level, like a
 * phone). Icons come from the browser's own icon cache (the favicon
 * permission), so showing them makes no network request; a site can also
 * have the user's own image. While settings is open, sites can be added,
 * edited, removed and dragged: onto another site to make a folder, out of
 * an open folder to take them out. Shown as a grid; the model
 * (favorites-model.ts) doesn't depend on it, so a list view can reuse it.
 */
export class TarnFavorites extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    editing: {attribute: false},
    heading: {attribute: false},
    items: {state: true},
    icons: {state: true},
    folder: {state: true},
    editor: {state: true},
    more: {state: true},
    draftIcon: {state: true},
    draftUrl: {state: true},
    draftTitle: {state: true},
    error: {state: true},
    drag: {state: true},
    confirming: {state: true},
    announcement: {state: true},
    loaded: {state: true},
  };

  static override styles = [
    widgetStyles,
    sheetStyles,
    css`
      :host {
        --chip-size: 44px;
        --icon-size: 32px;
        --chip-radius: 12px;
        --dark-chip: ${unsafeCSS(DARK_CHIP)};
        /* Opaque, so the icon under its corner never shows through. */
        --badge: rgb(74 78 88);
      }

      svg {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .sites {
        position: relative;
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
        gap: 10px 6px;
        align-content: start;
        /* Room for the remove badges on the icons' corners, so the
           scrolling grid never clips them. */
        padding: 8px;
        margin: -8px;
        overflow: hidden;
        /* A row that doesn't fit fades out instead of being cut. */
        mask-image: linear-gradient(
          to bottom,
          #000 calc(100% - 14px),
          transparent
        );
      }

      /* Arranging a full tile: scroll to reach Add. */
      :host([editing]) .sites {
        overflow-y: auto;
        scrollbar-width: none;
      }

      :host([editing]) .site {
        touch-action: none;
      }

      .site {
        position: relative;
        min-width: 0;
      }

      .link {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 0;
        font: inherit;
        color: inherit;
        text-decoration: none;
        background: transparent;
        border: 0;
        border-radius: 12px;
        cursor: pointer;
      }

      .chip {
        position: relative;
        display: grid;
        place-items: center;
        flex: none;
        width: var(--chip-size);
        height: var(--chip-size);
        overflow: hidden;
        border-radius: var(--chip-radius);
        background: var(--chip);
        font-size: calc(var(--chip-size) * 0.4);
        font-weight: 600;
        line-height: 1;
        transition:
          background-color 150ms ease,
          transform 150ms ease,
          box-shadow 150ms ease;
      }

      .site:hover .chip,
      .add:hover .chip {
        background: var(--chip-hover);
      }

      .site:active .chip {
        transform: scale(0.96);
      }

      /* A real site icon sits on a light tile, like an app icon. */
      .chip.icon {
        background: rgb(255 255 255 / 0.94);
      }

      .site:hover .chip.icon {
        background: rgb(255 255 255);
      }

      /* A white icon (GitHub, ChatGPT) would vanish on white: dark tile. */
      .chip.icon.dark,
      .site:hover .chip.icon.dark {
        background: var(--dark-chip);
        /* An edge, so it doesn't melt into a dark tile. */
        box-shadow: inset 0 0 0 0.5px rgb(255 255 255 / 0.2);
      }

      /* The icon fills most of its tile, like Safari's favorites. */
      .chip.icon img {
        width: var(--icon-size);
        height: var(--icon-size);
      }

      /* The user's own image fills the whole tile. */
      .chip.custom img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      /* No icon in the browser's cache: the site's first letter, on a
         quiet tint of its own (no rainbow). */
      .chip.letter,
      .mini.letter {
        color: rgb(255 255 255 / 0.94);
        text-shadow: none;
        background: hsl(var(--hue) 22% 38%);
        background-image: linear-gradient(
          rgb(255 255 255 / 0.1),
          rgb(255 255 255 / 0)
        );
      }

      .site:hover .chip.letter {
        background-color: hsl(var(--hue) 24% 44%);
      }

      /* A folder: a glass tile holding its first four icons, with corners
         that follow the tile's own. */
      .chip.folder {
        --inset: calc(var(--chip-size) * 0.14);
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: calc(var(--chip-size) * 0.07);
        padding: var(--inset);
        place-items: stretch;
        background: rgb(255 255 255 / 0.16);
        box-shadow: inset 0 0 0 0.5px rgb(255 255 255 / 0.22);
      }

      .site:hover .chip.folder {
        background: rgb(255 255 255 / 0.24);
      }

      .mini {
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: max(3px, calc(var(--chip-radius) - var(--inset)));
        background: rgb(255 255 255 / 0.94);
        font-size: calc(var(--chip-size) * 0.17);
        font-style: normal;
        font-weight: 600;
        line-height: 1;
        text-shadow: none;
      }

      .mini.dark {
        background: var(--dark-chip);
      }

      /* Still loading, or an empty corner. */
      .mini.blank {
        background: rgb(255 255 255 / 0.1);
      }

      .mini img {
        width: 74%;
        height: 74%;
      }

      .mini.custom img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .name {
        max-width: 100%;
        overflow: hidden;
        font-size: 11px;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--ink-dim);
      }

      /* On the icon's corner, like a phone's home screen. */
      .remove {
        position: absolute;
        z-index: 1;
        top: -6px;
        left: calc(50% - var(--chip-size) / 2 - 6px);
        display: grid;
        place-items: center;
        min-width: 18px;
        height: 18px;
        padding: 0;
        color: rgb(255 255 255 / 0.95);
        background: var(--badge);
        border: 0;
        border-radius: 999px;
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.28);
        cursor: pointer;
        transition: transform 150ms ease;
      }

      .remove svg {
        width: 10px;
        height: 10px;
        stroke-width: 1.6;
      }

      .remove:hover {
        transform: scale(1.1);
      }

      /* A folder asks once before it goes, with all its sites. */
      .remove.confirm {
        padding: 0 8px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        text-shadow: none;
      }

      .add {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-width: 0;
        padding: 0;
        font: inherit;
        color: inherit;
        background: transparent;
        border: 0;
        cursor: pointer;
      }

      .add .chip {
        color: var(--ink-dim);
        box-shadow: inset 0 0 0 1px var(--tile-line);
        background: transparent;
      }

      .add:hover .chip {
        color: var(--ink);
      }

      .add svg {
        width: 40%;
        height: 40%;
        stroke-width: 1.5;
      }

      .empty {
        margin: 0;
        font-size: 13px;
        color: var(--ink-dim);
      }

      /* Arranging by hand. */
      .site.held {
        z-index: 2;
        pointer-events: none;
      }

      .site.held .chip {
        transform: scale(1.1);
        box-shadow: 0 10px 24px rgb(0 0 0 / 0.3);
      }

      .site.held .name,
      .site.held .remove {
        opacity: 0;
      }

      /* The held site will drop into this one. */
      .site.target .chip {
        transform: scale(1.12);
        box-shadow: 0 0 0 2px rgb(255 255 255 / 0.6);
      }

      /* Large tiles: bigger icons, four across in a 2x2 tile. */
      @container (min-height: 250px) {
        :host {
          --chip-size: 52px;
          --icon-size: 38px;
          --chip-radius: 14px;
        }
        .sites {
          grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
          margin-top: -4px;
        }
      }

      /* Short tiles: icons only, no names or heading. */
      @container (max-height: 140px) {
        .name,
        h3 {
          display: none;
        }
      }

      /* A small (1x1) tile: four icons in a neat 2x2, like a folder. */
      @container (max-width: 200px) and (max-height: 140px) {
        :host {
          padding: 18px;
        }
        .sites {
          grid-template-columns: repeat(2, 44px);
          gap: 10px;
          justify-content: center;
          align-content: safe center;
          /* No room below: a third row (while arranging) stays out of
             sight until scrolled to, badges and all. */
          padding-bottom: 0;
          margin-bottom: 0;
          mask-image: none;
        }
      }

      /* ---- An open folder: as wide as its icons, glass over the page ---- */

      dialog.folder {
        width: fit-content;
        max-width: calc(100vw - 32px);
        padding: 0;
        border-radius: 30px;
        border-color: rgb(255 255 255 / 0.16);
        background: color-mix(in srgb, var(--tile-held) 76%, transparent);
        backdrop-filter: blur(40px) saturate(1.5);
        transition: opacity 150ms ease;
      }

      dialog.folder.releasing {
        opacity: 0.55;
      }

      .sheet {
        --chip-size: 56px;
        --icon-size: 40px;
        --chip-radius: 15px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: min(78vh, 640px);
        padding: 20px 22px 24px;
      }

      .sheet .title {
        width: 100%;
        margin: 0;
        padding: 4px 8px;
        font: inherit;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: -0.01em;
        text-align: center;
        color: var(--ink);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 10px;
        outline: none;
      }

      .sheet input.title:hover {
        background: var(--chip);
      }

      .sheet input.title:focus {
        background: var(--chip);
        border-color: var(--focus-ring);
      }

      .sheet .sites {
        flex: initial;
        grid-template-columns: repeat(var(--columns, 4), 80px);
        justify-content: center;
        gap: 16px 6px;
        overflow-y: auto;
        scrollbar-width: none;
        mask-image: none;
      }

      .sheet .name {
        font-size: 12px;
      }

      /* ---- Adding or editing a site: like Safari's sheet ---- */

      dialog.editor {
        width: min(360px, calc(100vw - 32px));
        padding: 18px 18px 16px;
        border-radius: 24px;
      }

      dialog.editor form {
        gap: 14px;
      }

      dialog.editor h4 {
        margin: 0;
        font-size: 15px;
        text-align: center;
      }

      /* The image chosen as the site's icon. */
      .thumb {
        flex: none;
        width: 28px;
        height: 28px;
        padding: 0;
        overflow: hidden;
        background: transparent;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
      }

      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
      }

      /* Fields as one rounded group with hairlines between rows. */
      .group {
        overflow: hidden;
        border-radius: 12px;
        background: var(--chip);
      }

      dialog.editor .row {
        position: relative;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 12px;
        min-height: 44px;
        padding: 0 14px;
        font-size: 13px;
        color: var(--ink);
      }

      dialog.editor .row + .row::before {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        left: 14px;
        border-top: 1px solid var(--tile-line);
      }

      .row > span {
        flex: none;
        width: 76px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--ink-dim);
      }

      dialog.editor input::selection {
        color: inherit;
        background: color-mix(in srgb, var(--ink) 28%, transparent);
      }

      dialog.editor .row input,
      dialog.editor .row select {
        flex: 1;
        min-width: 0;
        height: 44px;
        padding: 0;
        font: inherit;
        font-size: 14px;
        color: var(--ink);
        background: transparent;
        border: 0;
        border-radius: 0;
        outline: none;
      }

      dialog.editor .row:focus-within {
        background: rgb(255 255 255 / 0.04);
      }

      dialog.editor .row select {
        appearance: none;
        padding-right: 18px;
        text-align: right;
        text-align-last: right;
        cursor: pointer;
        background: no-repeat right center / 10px
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M3 4l2 2 2-2' fill='none' stroke='%23999' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      }

      option {
        color: initial;
      }

      .row-end {
        display: flex;
        flex: 1;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .text-button {
        padding: 0;
        font: inherit;
        font-size: 13px;
        white-space: nowrap;
        color: var(--ink);
        background: transparent;
        border: 0;
        cursor: pointer;
      }

      .text-button.dim {
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--ink-dim);
      }

      .text-button:hover {
        text-decoration: underline;
      }

      .more-toggle {
        display: inline-flex;
        align-items: center;
        align-self: center;
        gap: 2px;
        margin: -4px 0;
        padding: 2px 6px;
        font: inherit;
        font-size: 12px;
        color: var(--ink-dim);
        background: transparent;
        border: 0;
        cursor: pointer;
      }

      .more-toggle:hover {
        color: var(--ink);
      }

      .chevron {
        width: 12px;
        height: 12px;
        stroke-width: 1.4;
      }

      dialog.editor .error {
        margin: -6px 2px 0;
      }

      /* Two equal buttons across the bottom. */
      dialog.editor .buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        margin-top: 2px;
      }

      dialog.editor .buttons button {
        padding: 9px 16px;
        font-size: 13.5px;
      }

      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .chip,
        .remove,
        dialog.folder {
          transition: none;
        }
      }
    `,
  ];

  declare widgetId: string;
  /** The settings panel is open: sites can be added, edited and moved. */
  declare editing: boolean;
  /** The widget's name: the user's, or the default. */
  declare heading: string;
  declare items: Item[];
  /** Resolved icon per site URL, or null for a letter tile. */
  declare icons: ReadonlyMap<string, FoundIcon | null>;
  /** The open folder's index, or null. */
  declare folder: number | null;
  declare editor: Editor | null;
  /** The editor shows its extras (icon, folder). */
  declare more: boolean;
  /** The editor's icon: unchanged (undefined), a new image, or removed. */
  declare draftIcon: string | null | undefined;
  /** What the editor's fields hold, kept across re-renders. */
  declare draftUrl: string;
  declare draftTitle: string;
  declare error: string;
  declare drag: (DragState & {scope: Scope; from: number}) | null;
  /** The folder whose remove badge asks for a second press. */
  declare confirming: number | null;
  declare announcement: string;
  /** Content is in: until then an empty widget shows no "empty" note. */
  declare loaded: boolean;

  private unwatch: () => void = () => {};
  /** Showing the browser's bookmarks bar, not content of the user's own. */
  private live = false;
  private unwatchBar: (() => void) | undefined;
  /** Sites whose icon was looked up in this page. */
  private checked = new Set<string>();
  private dragger: SiteDrag | null = null;
  private confirmTimer = 0;

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgetId = '';
    this.editing = false;
    this.heading = t('widget.favorites');
    this.items = [];
    this.icons = new Map();
    this.folder = null;
    this.editor = null;
    this.more = false;
    this.draftIcon = undefined;
    this.draftUrl = '';
    this.draftTitle = '';
    this.error = '';
    this.drag = null;
    this.confirming = null;
    this.announcement = '';
    this.loaded = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (peekWidgetDataStored(this.widgetId)) {
      this.live = false;
      this.loaded = true;
      this.show(peekWidgetData(this.widgetId, normalizeItems));
    } else {
      // Not the user's own yet: the browser's bookmarks bar, as last shown
      // (a reload's first frame), refreshed in a moment.
      this.live = true;
      const last = lastBookmarksBar();
      if (last) this.show(normalizeItems(last));
    }
    void this.loadContent();
    this.unwatch = watchWidgetData(this.widgetId, normalizeItems, items => {
      this.stopLive();
      this.show(items);
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
    this.stopLive();
    this.dragger?.cancel();
  }

  /** The user's own content, or else the browser's bookmarks bar. */
  private async loadContent(): Promise<void> {
    if (await widgetDataStored(this.widgetId)) {
      this.stopLive();
      this.show(await loadWidgetData(this.widgetId, normalizeItems));
      return;
    }
    this.unwatchBar ??= watchBookmarks(() => void this.showBar());
    await this.showBar();
  }

  /**
   * Shows the bookmarks bar, live, until the widget becomes the user's
   * own (their first change saves a copy). An empty bar, or a browser
   * without access, shows the start setup's examples instead.
   */
  private async showBar(): Promise<void> {
    const nodes = await readBookmarksBar();
    if (!this.live) return;
    const items = nodes ? fromBookmarks(nodes) : [];
    if (items.length) {
      rememberBookmarksBar(items);
      this.show(items);
    } else {
      this.show(await loadWidgetData(this.widgetId, normalizeItems));
    }
    this.loaded = true;
  }

  private stopLive(): void {
    this.live = false;
    this.loaded = true;
    this.unwatchBar?.();
    this.unwatchBar = undefined;
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('editing')) {
      this.toggleAttribute('editing', this.editing);
      if (!this.editing) {
        this.editor = null;
        this.confirming = null;
        this.dragger?.cancel();
      }
    }
    // The open folder went away (emptied, or changed in another tab).
    if (this.folder !== null && !this.openFolder()) this.folder = null;
  }

  override updated(changed: PropertyValues<this>): void {
    this.dragger?.follow();
    this.syncDialog('dialog.folder', this.folder !== null, () => {
      // Open on the title only while arranging, to rename it.
      if (!this.editing) {
        this.renderRoot
          .querySelector<HTMLElement>('dialog.folder .link')
          ?.focus();
      }
    });
    if (changed.has('editor')) {
      this.syncDialog('dialog.editor', this.editor !== null, dialog => {
        const field = this.editor?.place ? 'title' : 'url';
        dialog
          .querySelector<HTMLInputElement>(`input[name=${field}]`)
          ?.select();
      });
    }
  }

  /** Opens or closes one of the widget's dialogs to match its state. */
  private syncDialog(
    selector: string,
    open: boolean,
    onOpen: (dialog: HTMLDialogElement) => void,
  ): void {
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>(selector);
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      onOpen(dialog);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }

  // ---- Rendering ----------------------------------------------------------

  override render() {
    const empty = !this.items.length && !this.editing && this.loaded;
    return html`
      <h3>${this.heading}</h3>
      ${
        empty
          ? html`<p class="empty">${t('favorites.empty')}</p>`
          : html`<div class="sites" data-scope="main">
              ${repeat(
                this.ordered('main', this.items),
                ({item}) => keyOf(item),
                ({item, index}) =>
                  isFolder(item)
                    ? this.folderTile(item, index)
                    : this.siteTile(item, {folder: null, index}, 'main'),
              )}
              ${
                this.editing && this.items.length < MAX_ITEMS
                  ? this.addTile(null)
                  : nothing
              }
            </div>`
      }
      ${this.renderFolder()} ${this.editing ? this.renderEditor() : nothing}
      <div class="sr" aria-live="polite">${this.announcement}</div>
    `;
  }

  /** The items in the order shown: the drag's preview while dragging. */
  private ordered<T>(scope: Scope, list: readonly T[]) {
    const order =
      this.drag?.scope === scope && this.drag.order.length === list.length
        ? this.drag.order
        : list.map((_, i) => i);
    return order.map(index => ({item: list[index]!, index}));
  }

  private itemClasses(scope: Scope, index: number): string {
    const drag = this.drag;
    if (drag?.scope !== scope) return 'site';
    if (drag.from === index && this.dragger?.held) return 'site held';
    return drag.into === index ? 'site target' : 'site';
  }

  private siteTile(site: Site, place: Place, scope: Scope) {
    const classes = this.itemClasses(scope, place.index);
    if (!this.editing) {
      return html`<div class=${classes} data-index=${place.index}>
        <a class="link" href=${site.url} title=${site.title}>
          ${this.chip(site)}
          <span class="name">${site.title}</span>
        </a>
      </div>`;
    }
    return html`<div
      class=${classes}
      data-index=${place.index}
      data-edit
      @pointerdown=${(event: PointerEvent) =>
        this.startDrag(event, scope, place.index)}
    >
      <button
        class="link"
        title=${t('favorites.editSite', {title: site.title})}
        aria-roledescription=${t('favorites.movable')}
        @click=${() => this.openEditor(place)}
        @keydown=${(event: KeyboardEvent) =>
          this.onItemKey(event, scope, place.index)}
      >
        ${this.chip(site)}
        <span class="name">${site.title}</span>
      </button>
      <button
        class="remove"
        aria-label=${t('favorites.removeSite', {title: site.title})}
        title=${t('common.remove')}
        @click=${() => this.save(removeAt(this.items, place))}
      >
        ${CROSS}
      </button>
    </div>`;
  }

  private folderTile(folder: Folder, index: number) {
    const title = folder.title || t('favorites.folder');
    const confirming = this.confirming === index;
    const label = this.editing
      ? t('favorites.editFolder', {title})
      : t('favorites.openFolder', {title});
    return html`<div
      class=${this.itemClasses('main', index)}
      data-index=${index}
      ?data-edit=${this.editing}
      @pointerdown=${(event: PointerEvent) =>
        this.editing && this.startDrag(event, 'main', index)}
    >
      <button
        class="link"
        title=${label}
        aria-haspopup="dialog"
        aria-roledescription=${this.editing ? t('favorites.movable') : nothing}
        @click=${() => this.openFolderAt(index)}
        @keydown=${(event: KeyboardEvent) =>
          this.editing && this.onItemKey(event, 'main', index)}
      >
        <span class="chip folder" aria-hidden="true">
          ${folder.sites.slice(0, 4).map(site => this.mini(site))}
        </span>
        <span class="name">${title}</span>
      </button>
      ${
        this.editing
          ? html`<button
              class=${confirming ? 'remove confirm' : 'remove'}
              aria-label=${
                confirming
                  ? t('favorites.confirmRemoveFolder', {title})
                  : t('favorites.removeFolder', {title})
              }
              title=${t('common.remove')}
              @click=${() => this.askRemoveFolder(index)}
            >
              ${confirming ? t('common.remove') : CROSS}
            </button>`
          : nothing
      }
    </div>`;
  }

  private addTile(folder: number | null) {
    return html`<button
      class="add"
      data-edit
      title=${t('favorites.addSite')}
      @click=${() => this.openEditor(null, folder)}
    >
      <span class="chip" aria-hidden="true">${PLUS}</span>
      <span class="name">${t('common.add')}</span>
    </button>`;
  }

  private renderFolder() {
    const folder = this.openFolder();
    const index = this.folder;
    const title = folder ? folder.title || t('favorites.folder') : '';
    return html`<dialog
      class=${
        this.drag?.scope === 'folder' && this.drag.out
          ? 'folder releasing'
          : 'folder'
      }
      data-edit
      aria-label=${title}
      @close=${this.onFolderClosed}
      @click=${this.onFolderBackdrop}
    >
      ${
        folder && index !== null
          ? html`<div class="sheet">
              ${
                this.editing
                  ? html`<input
                      class="title"
                      aria-label=${t('favorites.folderName')}
                      maxlength="40"
                      spellcheck="false"
                      autocomplete="off"
                      placeholder=${t('favorites.folder')}
                      .value=${live(folder.title)}
                      @keydown=${this.onTitleKey}
                      @change=${(event: Event) =>
                        this.save(
                          renameFolder(
                            this.items,
                            index,
                            (event.target as HTMLInputElement).value,
                          ),
                        )}
                    />`
                  : html`<h4 class="title">${title}</h4>`
              }
              <div
                class="sites"
                data-scope="folder"
                style="--columns: ${columnsFor(
                  folder.sites.length + (this.editing ? 1 : 0),
                )}"
              >
                ${repeat(
                  this.ordered('folder', folder.sites),
                  ({item}) => keyOf(item),
                  ({item, index: k}) =>
                    this.siteTile(item, {folder: index, index: k}, 'folder'),
                )}
                ${
                  this.editing && folder.sites.length < MAX_FOLDER_SITES
                    ? this.addTile(index)
                    : nothing
                }
              </div>
            </div>`
          : nothing
      }
    </dialog>`;
  }

  private renderEditor() {
    const editor = this.editor;
    const site = editor?.place ? siteAt(this.items, editor.place) : null;
    const icon = this.draftIcon === undefined ? site?.icon : this.draftIcon;
    const folders = this.items
      .map((item, index) => ({item, index}))
      .filter((entry): entry is {item: Folder; index: number} =>
        isFolder(entry.item),
      );
    return html`
      <dialog class="editor" data-edit @close=${this.onEditorClosed}>
        <form method="dialog" @submit=${this.onSubmit} @input=${this.onDraft}>
          <h4>${site ? t('favorites.editTitle') : t('favorites.addTitle')}</h4>
          <div class="group">
            <label class="row">
              <span>${t('favorites.name')}</span>
              <input
                name="title"
                autocomplete="off"
                maxlength="60"
                placeholder=${t('favorites.namePlaceholder')}
                .value=${live(this.draftTitle)}
              />
            </label>
            <label class="row">
              <span>${t('favorites.address')}</span>
              <input
                name="url"
                type="text"
                inputmode="url"
                autocomplete="off"
                spellcheck="false"
                placeholder="example.com"
                .value=${live(this.draftUrl)}
              />
            </label>
          </div>
          ${this.error ? html`<p class="error">${this.error}</p>` : nothing}
          ${
            this.more
              ? html`<div class="group">
                  <div class="row">
                    <span>${t('favorites.icon')}</span>
                    <div class="row-end">
                      ${
                        icon
                          ? html`<button
                                type="button"
                                class="text-button dim"
                                @click=${() => (this.draftIcon = null)}
                              >
                                ${t('common.remove')}
                              </button>
                              <button
                                type="button"
                                class="thumb"
                                title=${t('favorites.chooseIcon')}
                                @click=${this.chooseIcon}
                              >
                                <img src=${icon} alt="" />
                              </button>`
                          : html`<button
                              type="button"
                              class="text-button"
                              @click=${this.chooseIcon}
                            >
                              ${t('favorites.chooseIcon')}
                            </button>`
                      }
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      hidden
                      @change=${this.onIconFile}
                    />
                  </div>
                  <label class="row">
                    <span>${t('favorites.folderLabel')}</span>
                    <select name="folder">
                      <option value="" ?selected=${editor?.dest === null}>
                        ${t('favorites.noFolder')}
                      </option>
                      ${folders.map(
                        ({item, index}) =>
                          html`<option
                            value=${index}
                            ?selected=${editor?.dest === index}
                          >
                            ${item.title || t('favorites.folder')}
                          </option>`,
                      )}
                      <option value="new">${t('favorites.newFolder')}</option>
                    </select>
                  </label>
                </div>`
              : html`<button
                  type="button"
                  class="more-toggle"
                  aria-expanded="false"
                  @click=${() => (this.more = true)}
                >
                  ${t('favorites.more')}${CHEVRON}
                </button>`
          }
          <div class="buttons">
            <button type="button" @click=${() => (this.editor = null)}>
              ${t('common.cancel')}
            </button>
            <button class="primary">
              ${site ? t('common.save') : t('common.add')}
            </button>
          </div>
        </form>
      </dialog>
    `;
  }

  /** Follows the editor's fields, so a re-render keeps what's typed. */
  private onDraft = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.name === 'title') this.draftTitle = input.value;
    if (input.name !== 'url') return;
    this.error = '';
    this.draftUrl = input.value;
  };

  private chip(site: Site) {
    if (site.icon) {
      return html`<span class="chip custom"
        ><img src=${site.icon} alt=""
      /></span>`;
    }
    const found = this.icons.get(site.url);
    // Looking up the icon takes a few ms: a plain tile until then.
    if (found === undefined) return html`<span class="chip"></span>`;
    if (found) {
      return html`<span class=${found.light ? 'chip icon dark' : 'chip icon'}
        ><img src=${found.src} alt=""
      /></span>`;
    }
    const hue = siteHue(new URL(site.url).hostname);
    return html`<span class="chip letter" style="--hue:${hue}"
      >${site.title.charAt(0)}</span
    >`;
  }

  /** One of the four small icons on a folder. */
  private mini(site: Site) {
    if (site.icon) {
      return html`<i class="mini custom"><img src=${site.icon} alt="" /></i>`;
    }
    const found = this.icons.get(site.url);
    if (found) {
      return html`<i class=${found.light ? 'mini dark' : 'mini'}
        ><img src=${found.src} alt=""
      /></i>`;
    }
    if (found === undefined) return html`<i class="mini blank"></i>`;
    const hue = siteHue(new URL(site.url).hostname);
    return html`<i class="mini letter" style="--hue:${hue}"
      >${site.title.charAt(0)}</i
    >`;
  }

  // ---- Folders ------------------------------------------------------------

  /**
   * The 1-9 shortcuts: opens the site in that place, or the folder. With a
   * folder open, the number counts the sites inside it. Returns whether
   * there was one.
   */
  openNumber(number: number): boolean {
    if (this.editing) return false;
    const folder = this.openFolder();
    const item = folder ? folder.sites[number - 1] : this.items[number - 1];
    if (!item) return false;
    if (isFolder(item)) this.openFolderAt(number - 1);
    else location.href = item.url;
    return true;
  }

  private openFolder(): Folder | null {
    const item = this.folder === null ? undefined : this.items[this.folder];
    return item && isFolder(item) ? item : null;
  }

  private openFolderAt(index: number): void {
    this.confirming = null;
    this.folder = index;
  }

  private onFolderClosed = () => {
    this.dragger?.cancel();
    this.folder = null;
  };

  /** A click on the dim backdrop (the dialog itself) closes the folder. */
  private onFolderBackdrop = (event: MouseEvent) => {
    if (event.target === event.currentTarget) this.folder = null;
  };

  private onTitleKey = (event: KeyboardEvent) => {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') input.blur();
  };

  /** First press asks; a second press within a few seconds removes. */
  private askRemoveFolder(index: number): void {
    clearTimeout(this.confirmTimer);
    if (this.confirming !== index) {
      this.confirming = index;
      this.confirmTimer = window.setTimeout(
        () => (this.confirming = null),
        3000,
      );
      return;
    }
    this.confirming = null;
    this.save(this.items.filter((_, i) => i !== index));
  }

  // ---- Editing a site -----------------------------------------------------

  private openEditor(place: Place | null, folder: number | null = null): void {
    const site = place ? siteAt(this.items, place) : null;
    this.error = '';
    this.draftIcon = undefined;
    this.draftUrl = site?.url ?? '';
    this.draftTitle = site?.title ?? '';
    // Basic by default; the extras stay open for a site that uses one.
    this.more = !!site?.icon;
    this.editor = {place, dest: place ? place.folder : folder};
  }

  private onEditorClosed = () => {
    this.editor = null;
  };

  private chooseIcon = () => {
    this.renderRoot
      .querySelector<HTMLInputElement>('dialog.editor input[type=file]')
      ?.click();
  };

  private onIconFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const icon = await iconFromFile(file).catch(() => null);
    if (icon) {
      this.error = '';
      this.draftIcon = icon;
    } else {
      this.error = t('favorites.badIcon');
    }
  };

  private onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const editor = this.editor;
    if (!editor) return;
    const data = new FormData(event.target as HTMLFormElement);
    const url = toUrl(data.get('url'));
    if (!url) {
      this.error = t('favorites.badAddress');
      return;
    }
    const typed = String(data.get('title') ?? '')
      .trim()
      .slice(0, 60);
    const old = editor.place ? siteAt(this.items, editor.place) : null;
    const icon = this.draftIcon === undefined ? old?.icon : this.draftIcon;
    const site: Site = {
      url,
      title: typed || nameOf(url),
      ...(icon ? {icon} : {}),
    };
    const chosen = data.get('folder');
    const dest =
      chosen === null
        ? editor.dest
        : chosen === 'new'
          ? 'new'
          : chosen === ''
            ? null
            : Number(chosen);
    this.save(
      putSite(this.items, editor.place, site, dest, t('favorites.newFolder')),
    );
    this.editor = null;
  };

  // ---- Arranging ----------------------------------------------------------

  private startDrag(event: PointerEvent, scope: Scope, from: number): void {
    if (event.button !== 0 || this.dragger) return;
    // The remove badge is a button of its own.
    if ((event.target as HTMLElement).closest('.remove')) return;
    const grid = this.renderRoot.querySelector<HTMLElement>(
      `.sites[data-scope=${scope}]`,
    );
    if (!grid) return;
    const folderIndex = this.folder;
    const list =
      scope === 'main' ? this.items : (this.openFolder()?.sites ?? []);
    this.dragger = new SiteDrag({
      grid,
      from,
      event,
      container:
        scope === 'folder'
          ? (this.renderRoot.querySelector<HTMLElement>('.sheet') ?? undefined)
          : undefined,
      // Sites drop into sites and folders; folders never nest.
      canDropInto: target =>
        scope === 'main' && !isFolder(list[from]!) && target !== from,
      onChange: state => {
        const before = this.snapshot();
        this.drag = {...state, scope, from};
        void this.animateFrom(before);
      },
      onEnd: result => this.endDrag(scope, folderIndex, result),
    });
    // No text selection or focus ring while pressing to drag.
    event.preventDefault();
  }

  private endDrag(
    scope: Scope,
    folder: number | null,
    result: DragResult | null,
  ): void {
    const held = this.dragger?.held;
    this.dragger = null;
    const before = this.snapshot();
    if (held) held.style.transform = '';
    const name = (index: number) => {
      const list =
        scope === 'main' ? this.items : (this.openFolder()?.sites ?? []);
      const item = list[index];
      return item ? item.title || t('favorites.folder') : '';
    };
    let items = this.items;
    if (result?.kind === 'move') {
      items =
        scope === 'main'
          ? moveEntry(this.items, result.from, result.to)
          : moveInFolder(this.items, folder!, result.from, result.to);
      const count =
        scope === 'main'
          ? items.length
          : (items[folder!] as Folder).sites.length;
      this.announcement = t('favorites.moved', {
        title: name(result.from),
        position: String(result.to + 1),
        count: String(count),
      });
    } else if (result?.kind === 'into') {
      const target = this.items[result.target];
      this.announcement = t('favorites.movedInto', {
        title: name(result.from),
        folder:
          target && isFolder(target)
            ? target.title || t('favorites.folder')
            : t('favorites.newFolder'),
      });
      items = dropInto(
        this.items,
        result.from,
        result.target,
        t('favorites.newFolder'),
      );
    } else if (result?.kind === 'out' && folder !== null) {
      items = takeOut(this.items, folder, result.from);
      // Like a phone: the folder closes to show where the site landed.
      this.folder = null;
    }
    this.drag = null;
    if (items !== this.items) this.save(items);
    void this.animateFrom(before);
  }

  /** Arrow keys move a focused site or folder one place. */
  private onItemKey(event: KeyboardEvent, scope: Scope, index: number): void {
    const step =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : 0;
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const folder = this.folder;
    const count =
      scope === 'main'
        ? this.items.length
        : (this.openFolder()?.sites.length ?? 0);
    const to = index + step;
    if (to < 0 || to >= count) return;
    const before = this.snapshot();
    this.save(
      scope === 'main'
        ? moveEntry(this.items, index, to)
        : moveInFolder(this.items, folder!, index, to),
    );
    void this.animateFrom(before).then(() => {
      // Keep the moved item focused at its new place.
      this.renderRoot
        .querySelector<HTMLElement>(
          `.sites[data-scope=${scope}] > [data-index="${to}"] .link`,
        )
        ?.focus();
    });
    const list =
      scope === 'main' ? this.items : (this.openFolder()?.sites ?? []);
    this.announcement = t('favorites.moved', {
      title: list[to]?.title || t('favorites.folder'),
      position: String(to + 1),
      count: String(count),
    });
  }

  /** Where every item is on screen, to animate the move that follows. */
  private snapshot(): Map<Element, DOMRect> {
    const rects = new Map<Element, DOMRect>();
    for (const item of this.renderRoot.querySelectorAll('[data-index]')) {
      rects.set(item, item.getBoundingClientRect());
    }
    return rects;
  }

  /** Glides items from where they were to where they are now (FLIP). */
  private async animateFrom(before: Map<Element, DOMRect>): Promise<void> {
    await this.updateComplete;
    if (reducedMotion.matches) return;
    const held = this.dragger?.held;
    for (const [item, was] of before) {
      if (item === held || !item.isConnected) continue;
      const now = item.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      item.animate(
        [{transform: `translate(${dx}px, ${dy}px)`}, {transform: 'none'}],
        {duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'},
      );
    }
  }

  // ---- Content ------------------------------------------------------------

  /** Shows items now and fills in their icons as Chrome provides them. */
  private show = (items: Item[]) => {
    // Our own save, echoed back by storage: keep the same objects, so
    // nothing re-renders or interrupts an animation.
    if (JSON.stringify(items) === JSON.stringify(this.items)) return;
    this.items = items;
    const sites = allSites(items);
    const icons = new Map(this.icons);
    for (const site of sites) {
      if (!icons.has(site.url)) {
        const last = lastSiteIcon(site.url);
        if (last !== undefined) icons.set(site.url, last);
      }
    }
    this.icons = icons;
    for (const site of sites) {
      if (this.checked.has(site.url)) continue;
      this.checked.add(site.url);
      void siteIcon(site.url).then(icon => {
        this.icons = new Map(this.icons).set(site.url, icon);
      });
    }
  };

  private save(items: Item[]): void {
    // The first change makes the widget the user's own: no longer the
    // browser's bar, but a copy they arrange.
    this.stopLive();
    // Indices may shift: a pending "Remove?" no longer points anywhere.
    this.confirming = null;
    this.show(items);
    void saveWidgetData(this.widgetId, items);
  }
}

customElements.define('tarn-favorites', TarnFavorites);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-favorites': TarnFavorites;
  }
}
