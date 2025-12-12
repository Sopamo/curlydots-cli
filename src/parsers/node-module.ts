/**
 * Node Module Parser
 *
 * Parses CommonJS module.exports translation files.
 * Expected structure: translations/<lang>/*.js with module.exports = { key: value }
 */

import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Glob } from 'bun';
import type { Parser, ParserImportResult } from '../types';

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
 * Uses Bun.file() to read raw content and eval to parse CommonJS module
 */
async function parseModuleFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    // Read file content directly to avoid import caching issues
    const content = await Bun.file(filePath).text();

    // Create a mock module.exports context and evaluate the file
    const moduleExports: { exports: Record<string, unknown> } = { exports: {} };
    const fn = new Function('module', 'exports', content);
    fn(moduleExports, moduleExports.exports);

    return moduleExports.exports;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error}`);
  }
}

/**
 * Set a nested value in an object using dot-notation path
 * @example setNestedValue({}, 'a.b.c', 'value') => { a: { b: { c: 'value' } } }
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Format object as CommonJS module content
 * Uses double quotes for strings to handle values containing single quotes
 */
function formatAsModule(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj, null, 2);
  return `module.exports = ${json};\n`;
}

/**
 * Node Module Parser implementation
 */
export const nodeModuleParser: Parser = {
  name: 'node-module',

  async export(langDir: string): Promise<Map<string, string>> {
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

  async import(langDir: string, translations: Map<string, string>): Promise<ParserImportResult> {
    const { mkdir, writeFile } = await import('node:fs/promises');

    const result: ParserImportResult = {
      filesCreated: 0,
      filesModified: 0,
      keysWritten: 0,
    };

    if (translations.size === 0) {
      return result;
    }

    // Create language directory if it doesn't exist
    await mkdir(langDir, { recursive: true });

    // Group translations by file name (first segment of key)
    const fileGroups = new Map<string, Map<string, string>>();

    for (const [key, value] of translations) {
      const dotIndex = key.indexOf('.');
      if (dotIndex === -1) {
        // Single-segment key - use as both file and key
        console.warn(`Warning: Key '${key}' has no file prefix, skipping`);
        continue;
      }

      const fileName = key.substring(0, dotIndex);
      const nestedKey = key.substring(dotIndex + 1);

      if (!fileGroups.has(fileName)) {
        fileGroups.set(fileName, new Map());
      }
      fileGroups.get(fileName)!.set(nestedKey, value);
    }

    // Write each file
    for (const [fileName, keys] of fileGroups) {
      const filePath = join(langDir, `${fileName}.js`);
      let existingContent: Record<string, unknown> = {};
      let isNewFile = true;

      // Try to read existing file
      if (existsSync(filePath)) {
        isNewFile = false;
        try {
          existingContent = await parseModuleFile(filePath);
        } catch {
          // If we can't parse it, start fresh
          existingContent = {};
        }
      }

      // Build new content object from keys
      const newContent: Record<string, unknown> = {};
      for (const [key, value] of keys) {
        setNestedValue(newContent, key, value);
        result.keysWritten++;
      }

      // Merge with existing content
      const mergedContent = deepMerge(existingContent, newContent);

      // Write file
      const moduleContent = formatAsModule(mergedContent);
      await writeFile(filePath, moduleContent, 'utf-8');

      if (isNewFile) {
        result.filesCreated++;
      } else {
        result.filesModified++;
      }
    }

    return result;
  },
};
