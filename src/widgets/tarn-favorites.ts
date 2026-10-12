/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {
  loadWidgetData,
  peekWidgetData,
  saveWidgetData,
  watchWidgetData,
} from './data';
import {lastSiteIcon, siteHue, siteIcon} from './site-icon';
import {widgetStyles} from './styles';

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
 */
export class TarnFavorites extends LitElement {
  static override properties = {
    widgetId: {attribute: false},
    sites: {state: true},
    icons: {state: true},
    adding: {state: true},
    error: {state: true},
  };

  static override styles = [
    widgetStyles,
    css`
      .sites {
        /* A row that doesn't fit fades out instead of being cut. */
        mask-image: linear-gradient(
          to bottom,
          #000 calc(100% - 14px),
          transparent
        );
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
        gap: 10px 6px;
        overflow: hidden;
        align-content: start;
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
        color: inherit;
        text-decoration: none;
        border-radius: 12px;
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

      .chip img {
        width: 26px;
        height: 26px;
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
        border: 0;
        border-radius: 50%;
        color: var(--ink);
        background: var(--chip-strong);
        cursor: pointer;
        opacity: 0;
        transition: opacity 150ms ease;
      }

      .site:hover .remove,
      .site:focus-within .remove,
      .remove:focus-visible {
        opacity: 1;
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

      form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      input {
        width: 100%;
        padding: 8px 10px;
        font: inherit;
        font-size: 14px;
        color: var(--ink);
        background: var(--chip);
        border: 1px solid var(--tile-line);
        border-radius: 10px;
        outline: none;
      }

      input:focus {
        border-color: var(--focus-ring);
      }

      .error {
        font-size: 12px;
        color: var(--ink-dim);
      }

      .empty {
        font-size: 13px;
        color: var(--ink-dim);
      }

      /* Large tiles: bigger icons, four across in a 2x2 tile. */
      @container (min-height: 250px) {
        .sites {
          grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
          gap: 10px 6px;
          margin-top: 4px;
        }
        .chip {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          font-size: 20px;
        }
        .chip img {
          width: 30px;
          height: 30px;
        }
      }

      /* Small tiles: icons only, no names. */
      @container (max-height: 140px) {
        .name {
          display: none;
        }
        h3 {
          display: none;
        }
      }
    `,
  ];

  declare widgetId: string;
  declare sites: Site[];
  declare adding: boolean;
  declare error: string;
  /** Resolved icon per site URL: an image URL, or null for a letter tile. */
  declare icons: ReadonlyMap<string, string | null>;
  private unwatch: () => void = () => {};
  /** Sites whose icon was looked up in this page. */
  private checked = new Set<string>();

  constructor() {
    super();
    this.widgetId = '';
    this.sites = [];
    this.adding = false;
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

  override render() {
    if (this.adding) return this.renderForm();
    return html`
      <h3>Favorites</h3>
      <div class="sites">
        ${this.sites.map(
          (site, i) => html`
            <div class="site">
              <a class="link" href=${site.url} title=${site.title}>
                ${this.chip(site)}
                <span class="name">${site.title}</span>
              </a>
              <button
                class="remove"
                aria-label="Remove ${site.title}"
                @click=${(event: Event) => this.removeSite(event, i)}
              >
                ×
              </button>
            </div>
          `,
        )}
        ${
          this.sites.length < MAX_SITES
            ? html`
                <button class="add" @click=${this.startAdding}>
                  <span class="chip" aria-hidden="true">+</span>
                  <span class="name">Add</span>
                </button>
              `
            : nothing
        }
      </div>
    `;
  }

  private renderForm() {
    return html`
      <h3>Add a site</h3>
      <form @submit=${this.onSubmit}>
        <input
          name="url"
          type="text"
          inputmode="url"
          placeholder="example.com"
          aria-label="Site address"
          autocomplete="off"
          spellcheck="false"
          @keydown=${this.onKeyDown}
        />
        ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
      </form>
    `;
  }

  private startAdding = async () => {
    this.adding = true;
    this.error = '';
    await this.updateComplete;
    this.renderRoot.querySelector('input')?.focus();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.adding = false;
  };

  private onSubmit = (event: Event) => {
    event.preventDefault();
    const input = this.renderRoot.querySelector('input');
    const url = toUrl(input?.value);
    if (!url) {
      this.error = 'That doesn’t look like a web address.';
      return;
    }
    this.save([...this.sites, {url, title: nameOf(url)}]);
    this.adding = false;
  };

  private removeSite(event: Event, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.save(this.sites.filter((_, i) => i !== index));
  }

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
