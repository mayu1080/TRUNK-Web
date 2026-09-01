#!/usr/bin/env node
/** DB の demo-asset-index.json を DD public にコピー（DE は DD ソースを共有） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ddPublic = path.resolve(__dirname, '../../DD-pixi-three-style/public');
const src = path.resolve(__dirname, '../../DB-pixi-core/public/demo-asset-index.json');
const dest = path.join(ddPublic, 'demo-asset-index.json');

if (!fs.existsSync(src)) {
  console.warn('[DE] demo-asset-index.json が見つかりません。先に DB で npm run generate:index を実行してください。');
  process.exit(0);
}

fs.mkdirSync(ddPublic, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[DE] copied demo-asset-index.json → ${dest}`);
