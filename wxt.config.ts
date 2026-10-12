import {defineConfig} from 'wxt';
import type {Plugin} from 'vite';

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
  manifest: ({browser}) => ({
    name: 'Tarn',
    description: 'A still, clear start to every tab.',
    // `offscreen` keeps the first-paint mirror in sync (see background.ts).
    // `favicon` shows Chrome's own new-tab icon in the tab, and later lets
    // site icons appear without any network request.
    permissions:
      browser === 'firefox' ? ['storage'] : ['storage', 'offscreen', 'favicon'],
    // Asked for only when the user chooses to switch off another new-tab
    // extension. Firefox only lets extensions toggle themes, so not there.
    optional_permissions: browser === 'firefox' ? [] : ['management'],
  }),
});
