import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const contentRoot = path.join(repoRoot, 'content');

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function serveContentPlugin(): Plugin {
  return {
    name: 'serve-content-folder',
    configureServer(server) {
      server.middlewares.use('/content', (req, res, next) => {
        const raw = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
        const rel = raw.replace(/^\/+/, '');
        const filePath = path.resolve(contentRoot, rel);
        if (!filePath.startsWith(contentRoot + path.sep) && filePath !== contentRoot) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            next();
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
          res.end(data);
        });
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  plugins: [serveContentPlugin()],
});
