import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/player-page'),
  base: '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['jassub'],
  },
  build: {
    outDir: path.resolve(__dirname, 'assets/player'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/player-page/index.html'),
      external: ['jassub'],
    },
  },
});
