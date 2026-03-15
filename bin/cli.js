#!/usr/bin/env node
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bunoshfile = resolve(__dirname, '..', 'Bunoshfile.js');
const bunosh = resolve(__dirname, '..', 'node_modules', '.bin', 'bunosh');

const args = ['--bunoshfile', bunoshfile, ...process.argv.slice(2)];

try {
  execFileSync(bunosh, args, { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
