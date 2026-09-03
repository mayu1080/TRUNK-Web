import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Electron loadFile 用。相対パスで dist を読む。 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
