#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the path to the CLI TypeScript file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '..', 'src', 'utils', 'cli.ts');

// Run the CLI with tsx
const args = process.argv.slice(2);
const tsx = spawn('npx', ['tsx', cliPath, ...args], {
  stdio: 'inherit',
  shell: true,
});

tsx.on('close', (code) => {
  process.exit(code || 0);
});

tsx.on('error', (error) => {
  console.error('Error running ts-boundaries:', error.message);
  console.error('Make sure tsx is installed: npm install tsx');
  process.exit(1);
});
