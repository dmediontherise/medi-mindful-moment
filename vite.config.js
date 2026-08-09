import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths. Required in two places:
  //   - GitHub Pages serves this repo from /medi-mindful-moment/, not the domain
  //     root, so absolute /assets/... URLs would 404.
  //   - The packaged Electron app loads dist/index.html over file://, where
  //     absolute paths resolve against the filesystem root and fail.
  // './' satisfies both. Safe here because the app has no history-API routing —
  // the ambient view is selected with a query parameter.
  base: './',
  build: {
    outDir: 'dist',
  },
});
