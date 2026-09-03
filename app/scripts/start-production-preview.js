'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const windowsArg = String(process.argv[2] || 'single').trim().toLowerCase();
const windows = windowsArg === 'multi' || windowsArg === '4' || windowsArg === 'four' ? 'multi' : 'single';

process.env.TRUNK_DEMO = 'production';
process.env.TRUNK_PRODUCTION_PREVIEW_MODE =
  process.env.TRUNK_PRODUCTION_PREVIEW_MODE && process.env.TRUNK_PRODUCTION_PREVIEW_MODE.trim()
    ? process.env.TRUNK_PRODUCTION_PREVIEW_MODE
    : 'portrait';
process.env.TRUNK_PRODUCTION_PREVIEW_WINDOWS = windows;

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
