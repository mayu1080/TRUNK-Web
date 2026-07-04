#!/usr/bin/env node
/** DB デモの demo-asset-index.json を DA public にコピー */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(__dirname, '..');
const src = path.resolve(demoRoot, '../DB-pixi-core/public/demo-asset-index.json');
const destDir = path.join(demoRoot, 'public');
const dest = path.join(destDir, 'demo-asset-index.json');

if (!fs.existsSync(src)) {
  console.warn('[DA] demo-asset-index.json が見つかりません。先に DB で npm run generate:index を実行してください。');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[DA] copied demo-asset-index.json → ${dest}`);
