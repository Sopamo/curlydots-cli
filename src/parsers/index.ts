/**
 * Parser registry for translation file parsers
 *
 * Supports pluggable parser architecture - each parser in its own file.
 */

import type { Parser } from '../types';

/**
 * Registry of available parsers
 */
const parsers = new Map<string, Parser>();

/**
 * Register a parser with the registry
 * @param parser - Parser to register
 */
export function registerParser(parser: Parser): void {
  parsers.set(parser.name, parser);
}

/**
 * Get a parser by name
 * @param name - Parser name
 * @returns Parser or undefined if not found
 */
export function getParser(name: string): Parser | undefined {
  return parsers.get(name);
}

/**
 * Get list of available parser names
 * @returns Array of parser names
 */
export function getAvailableParsers(): string[] {
  return Array.from(parsers.keys());
}

/**
 * Clear all registered parsers (for testing)
 */
export function clearParsers(): void {
  parsers.clear();
}

// Re-export Parser type for convenience
export type { Parser } from '../types';

// Import and register built-in parsers
import { nodeModuleParser } from './node-module';
registerParser(nodeModuleParser);
