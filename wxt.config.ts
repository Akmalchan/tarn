// Copyright 2026 The Tarn Authors
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

import {defineConfig} from 'wxt';
import type {Plugin} from 'vite';

/**
 * What the public repository holds: scripts/publish-public.sh's PUBLIC
 * list (src/build.test.ts keeps the two equal). The Firefox sources zip,
 * which AMO asks for, takes only these, so nothing private (docs/,
 * AGENTS.md, reports...) can go out with it. The one to upload is made
 * from the public snapshot itself, README included (docs/publishing.md).
 */
export const PUBLIC_FILES = [
  'src',
  'public',
  'scripts/scene-previews.mjs',
  'scripts/scene-preview-page.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'wxt.config.ts',
  'eslint.config.js',
  'vitest.config.ts',
  '.prettierrc.json',
  '.editorconfig',
  '.gitignore',
  '.github/workflows',
  'LICENSE',
  'PRIVACY.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'AUTHORS',
];

/**
 * The only hosts Tarn's pages may talk to (AGENTS.md, "Network"): weather
 * from Open-Meteo or Google, and the image a user gives Google Lens (a
 * form post). Pinned so a stray request fails loudly instead of leaving
 * quietly; src/build.test.ts checks every fetch's host is here. Under the
 * dev server, its live reload (localhost) is allowed too.
 */
export const CONNECT_HOSTS = [
  'https://api.open-meteo.com',
  'https://geocoding-api.open-meteo.com',
  'https://weather.googleapis.com',
];
export const FORM_HOSTS = ['https://lens.google.com'];

function contentSecurityPolicy(devServer: boolean): string {
  const connect = ["'self'", ...CONNECT_HOSTS];
  if (devServer) connect.push('http://localhost:*', 'ws://localhost:*');
  return [
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    `connect-src ${connect.join(' ')}`,
    `form-action ${FORM_HOSTS.join(' ')}`,
  ].join('; ');
}

/**
 * White-mark icons for the dev build (docs/brand/BRAND.md, "Mark"). Kept in
 * src/, not docs/, so the public repository's dev build has them too.
 */
const DEV_ICON_DIR = 'src/assets/dev-icons';
const DEV_ICONS: Record<string, string> = {
  'action/16.png': 'action-16.png',
  'action/32.png': 'action-32.png',
  'icon/16.png': 'action-16.png',
  'icon/32.png': 'action-32.png',
  'icon/48.png': 'icon-48.png',
  'icon/96.png': 'icon-96.png',
  'icon/128.png': 'icon-128.png',
};

/**
 * Vite rewrites the new tab's module script and drops its
 * `blocking="render"`; this puts it back, so the first frame of a page
 * already holds the clock and widgets (see entrypoints/newtab/main.ts).
 */
function renderBlockingNewTab(): Plugin {
  return {
    name: 'tarn:render-blocking-newtab',
    transformIndexHtml: {
      order: 'post',
      handler: (html, context) =>
        context.path.endsWith('newtab/index.html') ||
        context.filename.endsWith('newtab/index.html')
          ? html.replace(
              /<script type="module"(?![^>]*blocking=)/,
              '<script type="module" blocking="render"',
            )
          : html,
    },
  };
}

/**
 * Firefox has no `favicon` permission: the new tab's link to Chrome's icon
 * would only ask for a file that isn't there, on every new tab.
 */
function noChromeTabIcon(): Plugin {
  return {
    name: 'tarn:no-chrome-tab-icon',
    transformIndexHtml: (html, context) =>
      context.filename.endsWith('newtab/index.html')
        ? html.replace(/(\s*<!--[^>]*-->)?\s*<link\s+rel="icon"[^>]*>/, '')
        : html,
  };
}

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Visible name: dot-folders are hidden in Finder and file pickers.
  outDir: 'dist',
  manifestVersion: 3,
  vite: ({browser}) => ({
    plugins: [
      renderBlockingNewTab(),
      ...(browser === 'firefox' ? [noChromeTabIcon()] : []),
    ],
    build: {
      // The oldest browsers Tarn runs in (minimum versions below). Older CSS
      // targets make the minifier rewrite light-dark() into variables
      // nothing defines, and the popup and takeover lose their backgrounds.
      cssTarget: ['chrome123', 'firefox140'],
      // Both have modulepreload, so Vite's polyfill would be dead weight.
      modulePreload: {polyfill: false},
    },
  }),
  // The dev build installs beside the real one, so it gets its own name and
  // the white mark (hooks below) to tell the two apart at a glance.
  manifest: ({browser, mode, command}) => ({
    name: mode === 'development' ? 'Tarn Dev' : '__MSG_extName__',
    // Name, panel title and description come from public/_locales, so the
    // store listing and Chrome's own UI speak the browser's language.
    default_locale: 'en',
    // Chrome titles the side panel with short_name (max 12 characters), and
    // the panel is Tarn's settings. Everywhere else shows the full name.
    short_name:
      mode === 'development' ? 'Dev Settings' : '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    // light-dark() is the newest thing Tarn needs in Chrome (123). Firefox:
    // AMO signs only with a fixed id (storage.sync needs one too), and asks
    // what leaves the computer (PRIVACY.md): a Weather place's rounded
    // coordinates, the question for AI Mode and a place search's words,
    // the image given to Lens. Firefox asks for that consent itself from
    // 140; older ones would need Tarn's own (docs/publishing.md, Firefox).
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'tarn@akmalchan',
              strict_min_version: '140.0',
              data_collection_permissions: {
                required: ['locationInfo', 'searchTerms', 'websiteContent'],
              },
            },
          },
        }
      : {minimum_chrome_version: '123'}),
    content_security_policy: {
      extension_pages: contentSecurityPolicy(command === 'serve'),
    },
    // `offscreen` keeps the first-paint mirror in sync (see background.ts).
    // `favicon` shows Chrome's own new-tab icon in the tab, and later lets
    // site icons appear without any network request.
    // `bookmarks` shows the browser's bookmarks bar in a Bookmarks widget
    // from the first new tab, until the user edits it (read only; install
    // warning "Read and change your bookmarks", owner's choice 2026-10-14).
    // `search` sends the search box's queries to the browser's own default
    // engine (chrome.search / browser.search); Tarn never picks the engine.
    permissions:
      browser === 'firefox'
        ? ['storage', 'bookmarks', 'search']
        : ['storage', 'offscreen', 'favicon', 'bookmarks', 'search'],
    // Asked for only when needed, so neither shows an install warning:
    // `management` when the user switches off another new-tab extension
    // (Firefox only lets extensions toggle themes, so not there), and
    // `geolocation` when they press "Use my location" in a Weather widget.
    // Chrome can't make geolocation optional (it drops it from the
    // manifest), so there the page asks for the location like a website.
    optional_permissions:
      browser === 'firefox' ? ['geolocation'] : ['management'],
  }),
  zip: {
    // The public files (a folder with all it holds), and the README with
    // its images, which the public snapshot takes from public-repo/.
    includeSources: [
      ...PUBLIC_FILES.flatMap(path => [path, `${path}/**`]),
      'README.md',
      '.github/readme/**',
    ],
    // For the dot files in the list (.github, .gitignore...); a Mac's
    // .DS_Store isn't one.
    dotSources: true,
    excludeSources: ['**/.DS_Store'],
  },
  hooks: {
    'build:publicAssets': (wxt, files) => {
      if (wxt.config.mode !== 'development') return;
      for (const file of files) {
        const dev = DEV_ICONS[file.relativeDest];
        if (dev && 'absoluteSrc' in file) {
          file.absoluteSrc = `${wxt.config.root}/${DEV_ICON_DIR}/${dev}`;
        }
      }
    },
  },
});
