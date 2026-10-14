import {defineConfig} from 'wxt';
import type {Plugin} from 'vite';

/** White-mark icons for the dev build (docs/brand/BRAND.md, "Mark"). */
const DEV_ICON_DIR = 'docs/brand/assets/png/extension-dev';
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

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Visible name: dot-folders are hidden in Finder and file pickers.
  outDir: 'dist',
  manifestVersion: 3,
  vite: () => ({plugins: [renderBlockingNewTab()]}),
  // The dev build installs beside the real one, so it gets its own name and
  // the white mark (hooks below) to tell the two apart at a glance.
  manifest: ({browser, mode}) => ({
    name: mode === 'development' ? 'Tarn Dev' : '__MSG_extName__',
    // Name, panel title and description come from public/_locales, so the
    // store listing and Chrome's own UI speak the browser's language.
    default_locale: 'en',
    // Chrome titles the side panel with short_name (max 12 characters), and
    // the panel is Tarn's settings. Everywhere else shows the full name.
    short_name:
      mode === 'development' ? 'Dev Settings' : '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    // `offscreen` keeps the first-paint mirror in sync (see background.ts).
    // `favicon` shows Chrome's own new-tab icon in the tab, and later lets
    // site icons appear without any network request.
    permissions:
      browser === 'firefox' ? ['storage'] : ['storage', 'offscreen', 'favicon'],
    // Asked for only when needed, so neither shows an install warning:
    // `management` when the user switches off another new-tab extension
    // (Firefox only lets extensions toggle themes, so not there), and
    // `geolocation` when they press "Use my location" in a Weather widget.
    optional_permissions:
      browser === 'firefox' ? ['geolocation'] : ['management', 'geolocation'],
  }),
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
