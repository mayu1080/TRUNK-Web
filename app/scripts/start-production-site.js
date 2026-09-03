'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const PREVIEW_ENV_KEYS = [
  'TRUNK_PRODUCTION_PREVIEW',
  'TRUNK_PREVIEW',
  'TRUNK_PRODUCTION_PREVIEW_MODE',
  'TRUNK_PRODUCTION_PREVIEW_SCALE',
  'TRUNK_PRODUCTION_PREVIEW_WINDOWS',
  'TRUNK_PRODUCTION_PREVIEW_FRAME',
];

for (const key of PREVIEW_ENV_KEYS) {
  delete process.env[key];
}

process.env.TRUNK_DEMO = 'production';
process.env.TRUNK_PRODUCTION_FORCE_NO_PREVIEW = '1';
process.env.TRUNK_SITE_AUTO_BOUNDS = '1';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['run', 'start'], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
