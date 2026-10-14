/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing, type PropertyValues} from 'lit';
import {
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {lastSiteIcon, siteHue, siteIcon} from './site-icon';
import {sheetStyles, widgetStyles} from './styles';
import {LocaleController, t} from '../i18n';

interface Site {
  readonly url: string;
  readonly title: string;
}

const MAX_SITES = 24;

function normalize(raw: unknown): Site[] {
  if (!Array.isArray(raw)) return [];
  const sites: Site[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const url = toUrl((item as Record<string, unknown>).url);
    if (!url) continue;
    const title = (item as Record<string, unknown>).title;
    sites.push({
      url,
      title:
        typeof title === 'string' && title ? title.slice(0, 60) : nameOf(url),
    });
    if (sites.length === MAX_SITES) break;
  }
  return sites;
}

/** Accepts "example.com" or a full link; only http(s) pages. */
function toUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`,
    );
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function nameOf(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const name = host.split('.')[0] ?? host;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Your sites, one click away. Icons come from the browser's own icon cache
 * (the favicon permission), so showing them makes no network request.
 * While settings is open, a site opens its editor and there's an Add tile;
 * otherwise the tile is only links.
 */
export class TarnFavorites extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    editing: {attribute: false},
    heading: {attribute: false},
    sites: {state: true},
    icons: {state: true},
    editor: {state: true},
    error: {state: true},
  };

  static override styles = [
    widgetStyles,
    sheetStyles,
    css`
      .sites {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
        gap: 10px 6px;
        align-content: start;
        padding-top: 5px;
        margin-top: -5px;
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
      }

      button.link {
        cursor: pointer;
      }

      .chip {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: var(--chip);
        font-size: 17px;
        font-weight: 600;
        transition:
          background-color 150ms ease,
          transform 150ms ease;
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
        background: rgb(255 255 255 / 0.92);
      }

      .site:hover .chip.icon {
        background: rgb(255 255 255);
      }

      /* The icon fills most of its tile, like Safari's favorites. */
      .chip img {
        width: 32px;
        height: 32px;
      }

      /* No icon in Chrome's cache: the site's first letter on a calm color. */
      .chip.letter {
        color: rgb(255 255 255 / 0.95);
        text-shadow: none;
        background: hsl(var(--hue) 42% 46%);
      }

      .site:hover .chip.letter {
        background: hsl(var(--hue) 46% 52%);
      }

      .name {
        max-width: 100%;
        overflow: hidden;
        font-size: 11px;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--ink-dim);
      }

      .remove {
        position: absolute;
        top: -4px;
        right: 2px;
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
        padding: 0;
        font-size: 12px;
        line-height: 1;
        color: var(--ink);
        background: var(--chip-strong);
        border: 0;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 150ms ease;
      }

      .remove:hover {
        transform: scale(1.12);
      }

      .add {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 0;
        background: transparent;
        border: 0;
        cursor: pointer;
      }

      .add .chip {
        font-size: 22px;
        font-weight: 300;
        color: var(--ink-dim);
      }

      .empty {
        margin: 0;
        font-size: 13px;
        color: var(--ink-dim);
      }

      /* Large tiles: bigger icons, four across in a 2x2 tile. */
      @container (min-height: 250px) {
        .sites {
          grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
          margin-top: -1px;
        }
        .chip {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          font-size: 20px;
        }
        .chip img {
          width: 38px;
          height: 38px;
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
          margin: 0;
          padding: 0;
          mask-image: none;
        }
        .remove {
          top: -6px;
          right: -6px;
        }
      }
    `,
  ];

  declare widgetId: string;
  /** The settings panel is open: sites open their editor, Add shows. */
  declare editing: boolean;
  /** The widget's name: the user's, or the default. */
  declare heading: string;
  declare sites: Site[];
  /** The site being edited (its index), 'new' while adding, or null. */
  declare editor: number | 'new' | null;
  declare error: string;
  /** Resolved icon per site URL: an image URL, or null for a letter tile. */
  declare icons: ReadonlyMap<string, string | null>;
  private unwatch: () => void = () => {};
  /** Sites whose icon was looked up in this page. */
  private checked = new Set<string>();

  constructor() {
    super();
    // Re-renders in a newly chosen language.
    new LocaleController(this);
    this.widgetId = '';
    this.editing = false;
    this.heading = t('widget.favorites');
    this.sites = [];
    this.editor = null;
    this.error = '';
    this.icons = new Map();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.show(peekWidgetData(this.widgetId, normalize));
    void loadWidgetData(this.widgetId, normalize).then(this.show);
    this.unwatch = watchWidgetData(this.widgetId, normalize, this.show);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('editing')) {
      this.toggleAttribute('editing', this.editing);
      if (!this.editing) this.editor = null;
    }
  }

  override updated(changed: PropertyValues<this>): void {
    if (!changed.has('editor')) return;
    const dialog = this.renderRoot.querySelector('dialog');
    if (!dialog) return;
    if (this.editor !== null && !dialog.open) {
      dialog.showModal();
      const field = this.editor === 'new' ? 'url' : 'title';
      dialog.querySelector<HTMLInputElement>(`input[name=${field}]`)?.select();
    } else if (this.editor === null && dialog.open) {
      dialog.close();
    }
  }

  override render() {
    const empty = !this.sites.length && !this.editing;
    return html`
      <h3>${this.heading}</h3>
      ${
        empty
          ? html`<p class="empty">${t('favorites.empty')}</p>`
          : html`<div class="sites">
              ${this.sites.map((site, i) => this.siteTile(site, i))}
              ${
                this.editing && this.sites.length < MAX_SITES
                  ? html`<button
                      class="add"
                      data-edit
                      title=${t('favorites.addSite')}
                      @click=${() => this.open('new')}
                    >
                      <span class="chip" aria-hidden="true">+</span>
                      <span class="name">${t('common.add')}</span>
                    </button>`
                  : nothing
              }
            </div>`
      }
      ${this.editing ? this.renderEditor() : nothing}
    `;
  }

  private siteTile(site: Site, index: number) {
    if (!this.editing) {
      return html`<div class="site">
        <a class="link" href=${site.url} title=${site.title}>
          ${this.chip(site)}
          <span class="name">${site.title}</span>
        </a>
      </div>`;
    }
    return html`<div class="site">
      <button
        class="link"
        data-edit
        title=${t('favorites.editSite', {title: site.title})}
        @click=${() => this.open(index)}
      >
        ${this.chip(site)}
        <span class="name">${site.title}</span>
      </button>
      <button
        class="remove"
        data-edit
        aria-label=${t('favorites.removeSite', {title: site.title})}
        title=${t('common.remove')}
        @click=${() => this.save(this.sites.filter((_, i) => i !== index))}
      >
        ×
      </button>
    </div>`;
  }

  private renderEditor() {
    const site =
      typeof this.editor === 'number' ? this.sites[this.editor] : null;
    return html`
      <dialog data-edit @close=${this.onClose}>
        <form method="dialog" @submit=${this.onSubmit}>
          <h4>${site ? t('favorites.editTitle') : t('favorites.addTitle')}</h4>
          <label>
            ${t('favorites.name')}
            <input
              name="title"
              autocomplete="off"
              maxlength="60"
              placeholder=${t('favorites.namePlaceholder')}
              .value=${site?.title ?? ''}
            />
          </label>
          <label>
            ${t('favorites.address')}
            <input
              name="url"
              type="text"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="example.com"
              .value=${site?.url ?? ''}
              @input=${() => (this.error = '')}
            />
          </label>
          ${this.error ? html`<p class="error">${this.error}</p>` : nothing}
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

  private open(editor: number | 'new'): void {
    this.error = '';
    this.editor = editor;
  }

  private onClose = () => {
    this.editor = null;
  };

  private onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const url = toUrl(data.get('url'));
    if (!url) {
      this.error = t('favorites.badAddress');
      return;
    }
    const typed = String(data.get('title') ?? '')
      .trim()
      .slice(0, 60);
    const site = {url, title: typed || nameOf(url)};
    const sites =
      typeof this.editor === 'number'
        ? this.sites.map((s, i) => (i === this.editor ? site : s))
        : [...this.sites, site];
    this.save(sites);
    this.editor = null;
  };

  /** Shows sites now and fills in their icons as Chrome provides them. */
  private show = (sites: Site[]) => {
    this.sites = sites;
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
      void siteIcon(site.url).then(src => {
        this.icons = new Map(this.icons).set(site.url, src);
      });
    }
  };

  private chip(site: Site) {
    const src = this.icons.get(site.url);
    // Looking up the icon takes a few ms: a plain tile until then.
    if (src === undefined) return html`<span class="chip"></span>`;
    if (src) {
      return html`<span class="chip icon"><img src=${src} alt="" /></span>`;
    }
    const hue = siteHue(new URL(site.url).hostname);
    return html`<span class="chip letter" style="--hue:${hue}"
      >${site.title.charAt(0)}</span
    >`;
  }

  private save(sites: Site[]): void {
    this.show(sites);
    void saveWidgetData(this.widgetId, sites);
  }
}

customElements.define('tarn-favorites', TarnFavorites);

declare global {
  interface HTMLElementTagNameMap {
    'tarn-favorites': TarnFavorites;
  }
}
