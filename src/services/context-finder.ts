/**
 * Context Finder Service
 *
 * Searches for translation key usages in code and extracts surrounding context.
 */

import { join } from 'node:path';
import { Glob } from 'bun';
import { analysisStore, configStore } from '../stores';
import type { UsageContext } from '../types';

/** Maximum number of context snippets per key */
const MAX_CONTEXTS_PER_KEY = 10;

/** Number of lines to extract around each match */
const CONTEXT_LINES = 15;

/** Maximum snippet length in characters to avoid DB overflow */
const MAX_SNIPPET_LENGTH = 5000;

/** Average line length threshold to detect minified files */
const MINIFIED_AVG_LINE_LENGTH = 500;

/**
 * Check if a file is likely binary
 */
function isBinaryFile(content: string): boolean {
  // Check for null bytes which indicate binary content
  return content.includes('\0');
}

/**
 * Extract context lines around a match
 * @param lines - All lines of the file
 * @param matchLine - Line number of the match (0-indexed)
 * @returns Context with snippet and line info
 */
export function extractContext(lines: string[], matchLine: number, filePath: string): UsageContext {
  const startLine = Math.max(0, matchLine - CONTEXT_LINES);
  const endLine = Math.min(lines.length - 1, matchLine + CONTEXT_LINES);

  const snippetLines = lines.slice(startLine, endLine + 1);

  let snippet = snippetLines.join('\n');
  if (snippet.length > MAX_SNIPPET_LENGTH) {
    snippet = snippet.slice(0, MAX_SNIPPET_LENGTH) + '\n... (truncated)';
  }

  return {
    filePath,
    lineNumber: matchLine + 1, // 1-indexed
    snippet,
    snippetStartLine: startLine + 1, // 1-indexed
    snippetEndLine: endLine + 1, // 1-indexed
  };
}

/**
 * Search for a key in file content
 * @param content - File content
 * @param key - Translation key to search for
 * @returns Array of line numbers (0-indexed) where key is found
 */
function findKeyInContent(content: string, key: string): number[] {
  const lines = content.split('\n');
  const matches: number[] = [];

  // Escape special regex characters in the key
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match patterns: 'key', "key", or key (unquoted in certain contexts)
  const patterns = [
    new RegExp(`['"]${escapedKey}['"]`, 'g'), // Quoted
    new RegExp(`\\b${escapedKey}\\b`, 'g'), // Unquoted word boundary
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const pattern of patterns) {
      if (pattern.test(line)) {
        matches.push(i);
        break; // Only count line once even if multiple matches
      }
    }
  }

  return matches;
}

/**
 * Find all usages of a translation key in a directory
 * @param key - Translation key to search for
 * @param searchDir - Directory to search in
 * @returns Array of usage contexts (max 10)
 */
export async function findKeyUsages(key: string, searchDir: string): Promise<UsageContext[]> {
  const config = configStore.getState();
  const contexts: UsageContext[] = [];

  // Build glob pattern from extensions
  const extensions = config.extensions.length > 0
    ? config.extensions.map((ext) => `**/*${ext}`)
    : ['**/*'];

  for (const pattern of extensions) {
    if (contexts.length >= MAX_CONTEXTS_PER_KEY) break;

    const glob = new Glob(pattern);

    for await (const relativePath of glob.scan({ cwd: searchDir, absolute: false })) {
      if (contexts.length >= MAX_CONTEXTS_PER_KEY) break;

      // Skip node_modules and other common non-source directories
      if (
        relativePath.includes('node_modules') ||
        relativePath.includes('.git') ||
        relativePath.includes('dist') ||
        relativePath.includes('build')
      ) {
        continue;
      }

      const filePath = join(searchDir, relativePath);

      try {
        const file = Bun.file(filePath);
        const content = await file.text();

        // Skip binary or minified files
        if (isBinaryFile(content)) continue;
        const lines = content.split('\n');
        if (lines.length > 0 && content.length / lines.length > MINIFIED_AVG_LINE_LENGTH) continue;
        const matchLines = findKeyInContent(content, key);

        for (const matchLine of matchLines) {
          if (contexts.length >= MAX_CONTEXTS_PER_KEY) break;

          const context = extractContext(lines, matchLine, filePath);
          contexts.push(context);
        }
      } catch {}
    }
  }

  return contexts;
}

/**
 * Find context for multiple missing keys
 * @param missingKeys - Array of missing keys with source values
 * @param searchDir - Directory to search in
 * @returns Array with contexts added to each key
 */
export type ContextProgressCallback = (info: { current: number; total: number; key: string }) => void;

const DEFAULT_CONCURRENCY = 10;

export async function findContextForKeys(
  missingKeys: Array<{ key: string; sourceValue: string }>,
  searchDir: string,
  onProgress?: ContextProgressCallback,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<Array<{ key: string; sourceValue: string; contexts: UsageContext[] }>> {
  const analysis = analysisStore.getState();
  const results: Array<{ key: string; sourceValue: string; contexts: UsageContext[] }> = new Array(missingKeys.length);
  let completed = 0;

  async function processKey(index: number): Promise<void> {
    const item = missingKeys[index];
    if (!item) return;

    const contexts = await findKeyUsages(item.key, searchDir);
    results[index] = { key: item.key, sourceValue: item.sourceValue, contexts };

    completed += 1;
    analysis.setCurrentKey(item.key);
    analysis.setProgress(completed, missingKeys.length);
    analysis.setTaskProgress('find_code_context', completed, missingKeys.length);
    onProgress?.({ current: completed, total: missingKeys.length, key: item.key });
  }

  // Process keys in parallel with concurrency limit
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < missingKeys.length) {
      const index = nextIndex;
      nextIndex += 1;
      await processKey(index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, missingKeys.length) }, () => worker());
  await Promise.all(workers);

  return results.filter(Boolean);
}
