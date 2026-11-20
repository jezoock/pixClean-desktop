import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so packaged Electron file:// loads dist/index.html cleanly
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
