import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rendererDir = path.dirname(fileURLToPath(import.meta.url));

/** Electron loadFile 用。相対パスで dist を読む。 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@trunk-shared': path.resolve(rendererDir, '../../shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
