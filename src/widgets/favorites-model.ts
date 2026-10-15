/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: FSL-1.1-ALv2
 */

// What a Favorites widget holds, and every change to it, as pure functions:
// sites and folders of sites, one level deep (like a phone's home screen).
// The stored shape is a plain array, so content saved before folders
// existed (an array of sites) reads unchanged. The widget decides how the
// items look (a grid today; a list could reuse all of this).

export interface Site {
  readonly url: string;
  readonly title: string;
  /** The user's own image (a data URL), shown instead of the site's icon. */
  readonly icon?: string;
}

export interface Folder {
  readonly title: string;
  readonly sites: readonly Site[];
}

export type Item = Site | Folder;

/** Where a site is: on the widget itself, or inside a folder. */
export interface Place {
  /** The folder's index among the items, or null for the widget itself. */
  readonly folder: number | null;
  readonly index: number;
}

export const MAX_ITEMS = 48;
export const MAX_FOLDER_SITES = 60;
const MAX_TITLE = 60;
const MAX_FOLDER_TITLE = 40;
/** A 112px image as a data URL is ~5-20k characters. */
const MAX_ICON = 80_000;

export const isFolder = (item: Item): item is Folder => 'sites' in item;

/** Turns anything stored into valid items; unknown parts are dropped. */
export function normalizeItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  const items: Item[] = [];
  for (const entry of raw) {
    if (items.length === MAX_ITEMS) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (Array.isArray(record.sites)) {
      const sites = normalizeSites(record.sites, MAX_FOLDER_SITES);
      if (!sites.length) continue;
      items.push({title: folderTitle(record.title), sites});
    } else {
      const site = normalizeSite(record);
      if (site) items.push(site);
    }
  }
  return items;
}

function normalizeSites(raw: unknown[], max: number): Site[] {
  const sites: Site[] = [];
  for (const entry of raw) {
    if (sites.length === max) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const site = normalizeSite(entry as Record<string, unknown>);
    if (site) sites.push(site);
  }
  return sites;
}

function normalizeSite(record: Record<string, unknown>): Site | null {
  const url = toUrl(record.url);
  if (!url) return null;
  const title =
    typeof record.title === 'string' && record.title.trim()
      ? record.title.trim().slice(0, MAX_TITLE)
      : nameOf(url);
  const icon = record.icon;
  return typeof icon === 'string' && isIconData(icon)
    ? {url, title, icon}
    : {url, title};
}

function folderTitle(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().slice(0, MAX_FOLDER_TITLE)
    : '';
}

/** Only small raster images, so a stored value can't be anything else. */
export function isIconData(value: string): boolean {
  return (
    value.length <= MAX_ICON &&
    /^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(value)
  );
}

/** Accepts "example.com" or a full link; only http(s) pages. */
export function toUrl(value: unknown): string | null {
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

/** "https://www.github.com/x" -> "Github". */
export function nameOf(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const name = host.split('.')[0] || host;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Folder titles are cut to the stored length. */
export function cleanFolderTitle(title: string): string {
  return folderTitle(title);
}

/** The list with the entry at `from` moved to `to`. */
export function moveEntry<T>(
  list: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [entry] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, entry!);
  return next;
}

/** Moves a site within a folder. */
export function moveInFolder(
  items: readonly Item[],
  folder: number,
  from: number,
  to: number,
): Item[] {
  return items.map((item, i) =>
    i === folder && isFolder(item)
      ? {...item, sites: moveEntry(item.sites, from, to)}
      : item,
  );
}

/**
 * Drops the site at `from` onto the item at `target`: onto a folder, it
 * goes in at the end; onto another site, the two become a new folder in
 * the target's place. Folders never go inside folders.
 */
export function dropInto(
  items: readonly Item[],
  from: number,
  target: number,
  newFolderTitle: string,
): Item[] {
  const moving = items[from];
  const onto = items[target];
  if (!moving || !onto || from === target || isFolder(moving)) {
    return [...items];
  }
  let replacement: Folder;
  if (isFolder(onto)) {
    if (onto.sites.length >= MAX_FOLDER_SITES) return [...items];
    replacement = {...onto, sites: [...onto.sites, moving]};
  } else {
    replacement = {
      title: cleanFolderTitle(newFolderTitle),
      sites: [onto, moving],
    };
  }
  return items
    .map((item, i) => (i === target ? replacement : item))
    .filter((_, i) => i !== from);
}

/**
 * Takes a site out of its folder and puts it right after the folder. A
 * folder left empty goes away.
 */
export function takeOut(
  items: readonly Item[],
  folder: number,
  index: number,
): Item[] {
  const holder = items[folder];
  if (!holder || !isFolder(holder) || !holder.sites[index]) return [...items];
  const site = holder.sites[index];
  const rest = holder.sites.filter((_, i) => i !== index);
  const next: Item[] = [...items];
  next.splice(
    folder,
    1,
    ...(rest.length ? [{...holder, sites: rest}] : []),
    site,
  );
  return next;
}

/** The site at a place, if there is one. */
export function siteAt(items: readonly Item[], place: Place): Site | null {
  if (place.folder === null) {
    const item = items[place.index];
    return item && !isFolder(item) ? item : null;
  }
  const holder = items[place.folder];
  return (holder && isFolder(holder) && holder.sites[place.index]) || null;
}

/**
 * Saves a site from the editor. `place` is where it was (null for a new
 * one) and `dest` where it goes: a folder's index, null for the widget
 * itself, or 'new' for a new folder in its place. A site that stays where
 * it was keeps its position; a moved one goes last.
 */
export function putSite(
  items: readonly Item[],
  place: Place | null,
  site: Site,
  dest: number | null | 'new',
  newFolderTitle = '',
): Item[] {
  if (place && dest !== 'new' && place.folder === dest) {
    if (!siteAt(items, place)) return [...items];
    return place.folder === null
      ? items.map((item, i) => (i === place.index ? site : item))
      : items.map((item, i) =>
          i === place.folder && isFolder(item)
            ? {
                ...item,
                sites: item.sites.map((s, k) => (k === place.index ? site : s)),
              }
            : item,
        );
  }
  if (dest === 'new') {
    const folder: Folder = {
      title: cleanFolderTitle(newFolderTitle),
      sites: [site],
    };
    if (place?.folder === null) {
      // Becomes a folder right where it was.
      return items.map((item, i) => (i === place.index ? folder : item));
    }
    if (items.length >= MAX_ITEMS) return [...items];
    return prune(removeAt([...items, folder], place));
  }
  let next: Item[];
  if (dest === null) {
    if (items.length >= MAX_ITEMS && !(place && place.folder === null)) {
      return [...items];
    }
    next = [...items, site];
  } else {
    const holder = items[dest];
    if (!holder || !isFolder(holder)) return [...items];
    if (holder.sites.length >= MAX_FOLDER_SITES) return [...items];
    next = items.map((item, i) =>
      i === dest ? {...holder, sites: [...holder.sites, site]} : item,
    );
  }
  // Appending never shifts the old place, so it can go after.
  return prune(removeAt(next, place));
}

/** Removes the site or folder at a place. */
export function removeAt(items: readonly Item[], place: Place | null): Item[] {
  if (!place) return [...items];
  if (place.folder === null) return items.filter((_, i) => i !== place.index);
  return prune(
    items.map((item, i) =>
      i === place.folder && isFolder(item)
        ? {...item, sites: item.sites.filter((_, k) => k !== place.index)}
        : item,
    ),
  );
}

/** Renames a folder; an empty name is kept empty (shown as "Folder"). */
export function renameFolder(
  items: readonly Item[],
  folder: number,
  title: string,
): Item[] {
  return items.map((item, i) =>
    i === folder && isFolder(item)
      ? {...item, title: cleanFolderTitle(title)}
      : item,
  );
}

/** Folders left without sites go away. */
function prune(items: Item[]): Item[] {
  return items.filter(item => !isFolder(item) || item.sites.length > 0);
}

/** Every site, folders included, in order. */
export function allSites(items: readonly Item[]): Site[] {
  return items.flatMap(item => (isFolder(item) ? item.sites : [item]));
}

// ---- Bookmarks ----------------------------------------------------------

/** The parts of a browser bookmark node this uses. */
export interface BookmarkNode {
  readonly title?: string;
  readonly url?: string;
  readonly children?: readonly BookmarkNode[];
}

/**
 * The bookmarks bar as items: its links as sites, its folders as folders.
 * A folder's own subfolders are folded into it (folders are one level
 * deep). Bookmarklets and browser pages are skipped.
 */
export function fromBookmarks(nodes: readonly BookmarkNode[]): Item[] {
  const items: Item[] = [];
  for (const node of nodes) {
    if (items.length === MAX_ITEMS) break;
    if (node.children) {
      const sites = flatten(node.children).slice(0, MAX_FOLDER_SITES);
      if (sites.length) items.push({title: folderTitle(node.title), sites});
    } else {
      const site = bookmarkSite(node);
      if (site) items.push(site);
    }
  }
  return items;
}

function flatten(nodes: readonly BookmarkNode[]): Site[] {
  return nodes.flatMap(node => {
    if (node.children) return flatten(node.children);
    const site = bookmarkSite(node);
    return site ? [site] : [];
  });
}

function bookmarkSite(node: BookmarkNode): Site | null {
  const url = toUrl(node.url);
  // Only real links: toUrl adds https:// to bare text, so check the source.
  if (!url || !/^https?:/i.test(node.url ?? '')) return null;
  return normalizeSite({url, title: node.title});
}

/**
 * Adds imported items to what's there, skipping sites already present
 * anywhere. A folder with the same name as an existing one fills that one.
 */
export function mergeImported(
  items: readonly Item[],
  imported: readonly Item[],
): Item[] {
  const known = new Set(allSites(items).map(site => site.url));
  const fresh = (sites: readonly Site[]) =>
    sites.filter(site => {
      if (known.has(site.url)) return false;
      known.add(site.url);
      return true;
    });
  const next: Item[] = [...items];
  for (const item of imported) {
    if (!isFolder(item)) {
      if (next.length < MAX_ITEMS && fresh([item]).length) next.push(item);
      continue;
    }
    const same = next.findIndex(
      other =>
        isFolder(other) &&
        other.title.toLowerCase() === item.title.toLowerCase(),
    );
    const sites = fresh(item.sites);
    if (!sites.length) continue;
    if (same >= 0) {
      const folder = next[same] as Folder;
      next[same] = {
        ...folder,
        sites: [...folder.sites, ...sites].slice(0, MAX_FOLDER_SITES),
      };
    } else if (next.length < MAX_ITEMS) {
      next.push({title: item.title, sites});
    }
  }
  return next;
}
