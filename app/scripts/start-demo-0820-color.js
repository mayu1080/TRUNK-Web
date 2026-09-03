'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

process.env.TRUNK_DEMO = '0820-color';
process.env.TRUNK_MONITOR_COUNT = '1';
if (!process.env.TRUNK_IDLE_TIMEOUT_SECONDS) {
  process.env.TRUNK_IDLE_TIMEOUT_SECONDS = '600';
}

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
