/**
 * Parser Interface Contract
 *
 * This file defines the updated Parser interface with export/import capabilities.
 * Parsers handle reading from and writing to translation files in a specific format.
 *
 * NOTE: This is a contract specification, not implementation code.
 */

/**
 * Parser interface - all parsers must implement this
 *
 * Parsers are responsible for:
 * - Reading translation files and returning key-value pairs (export)
 * - Writing key-value pairs to translation files (import)
 *
 * Parsers are NOT responsible for:
 * - CSV parsing (handled by csv-reader service)
 * - Comparing translations (handled by analyzer service)
 */
export interface Parser {
  /** Unique parser identifier (e.g., "node-module") */
  name: string;

  /**
   * Export translations from files (read operation)
   *
   * Reads all translation files in the given language directory
   * and returns a flattened map of key paths to values.
   *
   * @param langDir - Absolute path to language directory (e.g., "/project/translations/en")
   * @returns Map of dot-notation key paths to translation values
   *
   * @example
   * // Given file: translations/en/generic.js with { welcome: "Hello" }
   * const map = await parser.export("/project/translations/en");
   * map.get("generic.welcome") // => "Hello"
   */
  export(langDir: string): Promise<Map<string, string>>;

  /**
   * Import translations to files (write operation)
   *
   * Writes translations to the appropriate files in the language directory.
   * Merges with existing content (new keys added, existing keys updated).
   * Creates files and directories as needed.
   *
   * @param langDir - Absolute path to language directory (e.g., "/project/translations/de")
   * @param translations - Map of dot-notation key paths to translation values
   * @returns Summary of files created and modified
   *
   * @example
   * // Write: translations/de/generic.js with { welcome: "Hallo" }
   * const translations = new Map([["generic.welcome", "Hallo"]]);
   * await parser.import("/project/translations/de", translations);
   */
  import(langDir: string, translations: Map<string, string>): Promise<ParserImportResult>;
}

/**
 * Result of parser import operation
 */
export interface ParserImportResult {
  /** Number of new files created */
  filesCreated: number;

  /** Number of existing files modified */
  filesModified: number;

  /** Total keys written */
  keysWritten: number;
}
