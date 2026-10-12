import {defineConfig} from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Visible name: dot-folders are hidden in Finder and file pickers.
  outDir: 'dist',
  manifestVersion: 3,
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
