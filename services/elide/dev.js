#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hasEnv = existsSync(path.resolve(__dirname, '../../.env'));
const args = hasEnv ? ['--env-file=../../.env', 'elide.mjs'] : ['elide.mjs'];

const child = spawn(process.execPath, args, { stdio: 'inherit', cwd: __dirname });
child.on('exit', (code) => process.exit(code ?? 0));

