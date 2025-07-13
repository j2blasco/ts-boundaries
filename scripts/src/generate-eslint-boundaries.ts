import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { scritpsRootPath } from './scripts-root-path';

// Import the Boundaries type from the source directory
import type { Boundaries } from '../../src/boundaries.types';

interface BoundariesConfig extends Boundaries {}

interface BoundaryElement {
  type: string;
  pattern: string;
  folderPath: string;
}

interface InternalRule {
  from: string;
  allow: string[];
}

interface ExternalRule {
  from: string;
  allow: string[];
}

const projectRootPath = path.join(scritpsRootPath, '../..');

function scanForBoundariesFiles(
  dir: string,
  srcRoot: string
): BoundaryElement[] {
  const elements: BoundaryElement[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        elements.push(...scanForBoundariesFiles(fullPath, srcRoot));
      } else if (entry.name.endsWith('.boundaries.ts')) {
        try {
          const relativePath = path.relative(srcRoot, dir);
          const posixPath = relativePath.split(path.sep).join('/');

          // We'll load the config later using dynamic import
          const configName = entry.name.replace('.boundaries.ts', '');
          
          elements.push({
            type: configName, // We'll update this with the actual name from the config
            pattern: posixPath ? `src/${posixPath}` : 'src',
            folderPath: posixPath,
          });

          console.log(`Found boundaries file: ${fullPath}`);
        } catch (error) {
          console.error(`Error processing boundaries file at ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }

  return elements;
}

async function loadBoundariesConfigs(srcRoot: string): Promise<Map<string, BoundariesConfig>> {
  const configs = new Map<string, BoundariesConfig>();

  async function scanDirectory(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.name.endsWith('.boundaries.ts')) {
          try {
            // Convert file path to file URL for dynamic import
            const fileUrl = pathToFileURL(fullPath).href;
            const module = await import(fileUrl);
            const config: BoundariesConfig = module.default || module.boundaries;
            
            if (!config || !config.name) {
              console.error(`Invalid boundaries config in ${fullPath}: missing name or default export`);
              continue;
            }
            
            configs.set(config.name, config);
            console.log(`Loaded boundaries config: ${config.name} from ${fullPath}`);
          } catch (error) {
            console.error(
              `Error loading boundaries.ts at ${fullPath}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }

  await scanDirectory(srcRoot);
  return configs;
}

async function generateESLintConfig(): Promise<string> {
  const srcPath = path.join(projectRootPath, 'src');

  if (!fs.existsSync(srcPath)) {
    console.error('src directory not found!');
    process.exit(1);
  }

  const elements = scanForBoundariesFiles(srcPath, srcPath);

  // Sort elements by depth (deepest first) to ensure child configs take priority over parent configs
  elements.sort((a, b) => {
    const depthA = a.folderPath.split('/').length;
    const depthB = b.folderPath.split('/').length;
    return depthB - depthA;
  });

  if (elements.length === 0) {
    console.log(
      'No .boundaries.ts files found. Generating empty configuration.'
    );
  }

  const boundariesConfigs = await loadBoundariesConfigs(srcPath);

  // Update element types with actual names from configs
  for (const element of elements) {
    for (const [name, config] of boundariesConfigs) {
      if (element.folderPath === '' && name === 'root') {
        element.type = name;
        break;
      } else if (element.folderPath && config.name === element.type) {
        element.type = name;
        break;
      }
    }
  }

  const rules: InternalRule[] = [];
  const externalRules: ExternalRule[] = [];

  for (const element of elements) {
    const config = boundariesConfigs.get(element.type);
    if (config) {
      if (config.internal && config.internal.length > 0) {
        rules.push({
          from: element.type,
          allow: config.internal,
        });
      }

      if (config.external && config.external.length > 0) {
        externalRules.push({
          from: element.type,
          allow: config.external,
        });
      }
    }
  }

  const boundaryElementsSection = `'boundaries/elements': [
${elements
  .map(
    (element) =>
      `        { type: '${element.type}', pattern: '${element.pattern}' }`
  )
  .join(',\n')}
      ] `;

  const externalRulesSection = `'boundaries/external': [
        2,
        {
          default: 'disallow',
          rules: [
${externalRules
  .map(
    (rule) =>
      `            { from: '${rule.from}', allow: [${rule.allow
        .map((a) => `'${a}'`)
        .join(', ')}] }`
  )
  .join(',\n')}
          ]
        }
      ],`;

  const internalRulesSection = `'boundaries/element-types': [
        2,
        {
          default: 'disallow',
          rules: [
${rules
  .map(
    (rule) =>
      `            { from: '${rule.from}', allow: [${rule.allow
        .map((a) => `'${a}'`)
        .join(', ')}] }`
  )
  .join(',\n')}
          ]
        }
      ]`;

  const eslintConfig = `// This file is auto-generated by generate-eslint-boundaries.ts
// Do not edit manually!

import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    plugins: {
      boundaries
    },
    settings: {
      ${boundaryElementsSection}
    },
    rules: {
      'boundaries/no-private': [2, { 'allowUncles': false }],
      ${externalRulesSection}
      ${internalRulesSection}
    }
  }
];
`;

  return eslintConfig;
}

async function main() {
  console.log('Generating ESLint boundaries configuration...');

  try {
    const config = await generateESLintConfig();
    const outputPath = path.join(
      projectRootPath,
      'eslint.boundaries.generated.mjs'
    );

    fs.writeFileSync(outputPath, config, 'utf8');

    console.log(`ESLint boundaries configuration generated: ${outputPath}`);
    console.log(
      'Configuration is idempotent and will overwrite existing file.'
    );
  } catch (error) {
    console.error('Error generating ESLint configuration:', error);
    process.exit(1);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}