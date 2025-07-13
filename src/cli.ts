#!/usr/bin/env node

import { generateBoundariesConfigFile } from './generator.js';

async function main() {
  try {
    await generateBoundariesConfigFile();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
