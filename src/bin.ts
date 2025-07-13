#!/usr/bin/env node

// This is a wrapper script that automatically uses tsx to handle TypeScript files
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM-specific __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, 'cli.js');

// Run the CLI with tsx if available, otherwise try direct node execution
function runCli() {
  const args = process.argv.slice(2);

  // Always try tsx first since we're dealing with TypeScript files
  const tsx = spawn('npx', ['tsx', cliPath, ...args], {
    stdio: 'inherit',
    shell: true,
  });

  tsx.on('close', (code) => {
    process.exit(code || 0);
  });

  tsx.on('error', (error) => {
    console.error('Error running with tsx:', error.message);
    console.error('Make sure tsx is installed: npm install --save-dev tsx');
    console.error('Falling back to direct node execution...');

    // Fall back to direct node execution
    const node = spawn('node', [cliPath, ...args], {
      stdio: 'inherit',
    });

    node.on('close', (code) => {
      process.exit(code || 0);
    });

    node.on('error', (nodeError) => {
      console.error(
        'Both tsx and direct node execution failed:',
        nodeError.message,
      );
      process.exit(1);
    });
  });
}

runCli();
