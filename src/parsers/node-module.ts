/**
 * Node Module Parser
 *
 * Parses CommonJS module.exports translation files.
 * Expected structure: translations/<lang>/*.js with module.exports = { key: value }
 */

import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Glob } from 'bun';
import type { Parser } from '../types';

/**
 * Flatten nested object to dot-notation keys
 * @example { a: { b: 'c' } } => { 'a.b': 'c' }
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result.set(newKey, value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = flattenObject(value as Record<string, unknown>, newKey);
      for (const [nestedKey, nestedValue] of nested) {
        result.set(nestedKey, nestedValue);
      }
    }
    // Skip arrays and other types
  }

  return result;
}

/**
 * Parse a single JS module file
 */
async function parseModuleFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    // Use dynamic import to load CommonJS module
    const module = await import(filePath);
    return module.default || module;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error}`);
  }
}

/**
 * Node Module Parser implementation
 */
export const nodeModuleParser: Parser = {
  name: 'node-module',

  async parse(langDir: string): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    // Check if directory exists
    if (!existsSync(langDir)) {
      throw new Error(`Language directory not found: ${langDir}`);
    }

    // Find all .js files in the language directory
    const glob = new Glob('*.js');
    const files: string[] = [];

    for await (const file of glob.scan({ cwd: langDir, absolute: false })) {
      // Skip index.js as it typically just re-exports other modules
      if (file !== 'index.js') {
        files.push(file);
      }
    }

    // Parse each file
    for (const file of files) {
      const filePath = join(langDir, file);
      const moduleName = basename(file, '.js');

      try {
        const moduleContent = await parseModuleFile(filePath);
        const flattenedKeys = flattenObject(moduleContent, moduleName);

        for (const [key, value] of flattenedKeys) {
          result.set(key, value);
        }
      } catch (error) {
        console.error(`Warning: Failed to parse ${filePath}:`, error);
      }
    }

    return result;
  },
};
