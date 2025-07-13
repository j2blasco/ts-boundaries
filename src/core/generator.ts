import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { Boundaries } from './boundaries.types';

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

export interface GeneratorOptions {
  /**
   * The root directory of the project (where package.json is located)
   */
  projectRoot?: string;
  /**
   * The source directory to scan for .boundaries.ts files
   * Defaults to 'src' relative to projectRoot
   */
  srcDir?: string;
  /**
   * The output file path for the generated ESLint configuration
   * Defaults to 'eslint.boundaries.generated.mjs' in projectRoot
   */
  outputPath?: string;
}

function scanForBoundariesFiles(
  dir: string,
  srcRoot: string,
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

          const configName = entry.name.replace('.boundaries.ts', '');

          elements.push({
            type: configName,
            pattern: posixPath ? `src/${posixPath}` : 'src',
            folderPath: posixPath,
          });

          console.log(`Found boundaries file: ${fullPath}`);
        } catch (error) {
          console.error(
            `Error processing boundaries file at ${fullPath}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }

  return elements;
}

async function loadBoundariess(
  srcRoot: string,
): Promise<Map<string, Boundaries>> {
  const configs = new Map<string, Boundaries>();

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
            const config: Boundaries = module.default || module.boundaries;

            if (!config || !config.name) {
              console.error(
                `Invalid boundaries config in ${fullPath}: missing name or default export`,
              );
              continue;
            }

            configs.set(config.name, config);
            console.log(
              `Loaded boundaries config: ${config.name} from ${fullPath}`,
            );
          } catch (error) {
            console.error(`Error loading boundaries.ts at ${fullPath}:`, error);
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

/**
 * Data structure for passing boundary information to config generation
 */
export interface BoundaryData {
  elements: BoundaryElement[];
  configs: Map<string, Boundaries>;
}

/**
 * Scan and load all boundary files from the file system
 */
export async function loadBoundaryData(
  options: GeneratorOptions = {},
): Promise<BoundaryData> {
  const projectRoot = options.projectRoot || process.cwd();
  const srcDir = options.srcDir || 'src';
  const srcPath = path.resolve(projectRoot, srcDir);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source directory not found: ${srcPath}`);
  }

  const elements = scanForBoundariesFiles(srcPath, srcPath);
  const configs = await loadBoundariess(srcPath);

  return { elements, configs };
}

/**
 * Generate ESLint configuration string from boundary data
 */
export function generateESLintConfigFromData(data: BoundaryData): string {
  const { elements, configs } = data;

  // Sort elements by depth (deepest first) to ensure child configs take priority over parent configs
  const sortedElements = [...elements].sort((a, b) => {
    const depthA = a.folderPath.split('/').length;
    const depthB = b.folderPath.split('/').length;
    return depthB - depthA;
  });

  if (sortedElements.length === 0) {
    console.log(
      'No .boundaries.ts files found. Generating empty configuration.',
    );
  }

  // Update element types with actual names from configs
  for (const element of sortedElements) {
    for (const [name, config] of configs) {
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

  for (const element of sortedElements) {
    const config = configs.get(element.type);
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
${sortedElements
  .map(
    (element) =>
      `        { type: '${element.type}', pattern: '${element.pattern}' }`,
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
        .join(', ')}] }`,
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
        .join(', ')}] }`,
  )
  .join(',\n')}
          ]
        }
      ]`;

  const eslintConfig = `// This file is auto-generated by @j2blasco/ts-boundaries
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

/**
 * Generate ESLint boundaries configuration
 */
export async function generateBoundariesConfig(
  options: GeneratorOptions = {},
): Promise<string> {
  const data = await loadBoundaryData(options);
  return generateESLintConfigFromData(data);
}

/**
 * Generate and write ESLint boundaries configuration to file
 */
export async function generateBoundariesConfigFile(
  options: GeneratorOptions = {},
): Promise<void> {
  const projectRoot = options.projectRoot || process.cwd();
  const outputPath =
    options.outputPath ||
    path.join(projectRoot, 'eslint.boundaries.generated.mjs');

  console.log('Generating ESLint boundaries configuration...');

  try {
    const config = await generateBoundariesConfig(options);
    fs.writeFileSync(outputPath, config, 'utf8');

    console.log(`ESLint boundaries configuration generated: ${outputPath}`);
  } catch (error) {
    console.error('Error generating ESLint configuration:', error);
    throw error;
  }
}
