/**
 * Import Service
 *
 * Orchestrates importing translated CSV data back to translation files.
 * Handles CSV parsing, filtering, and delegating file writing to parsers.
 */

import { join } from 'node:path';
import type { ImportError, ImportResult, Parser, TranslationRow } from '../types';
import { readCsv } from './csv-reader';

/**
 * Run import operation: read CSV and write translations to files
 *
 * @param csvPath - Path to translated CSV file
 * @param translationsDir - Base translations directory
 * @param parser - Parser to use for writing files
 * @returns Import result summary
 */
export async function runImport(
  csvPath: string,
  translationsDir: string,
  parser: Parser,
): Promise<ImportResult> {
  // Read and parse CSV
  const rows = await readCsv(csvPath);

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Filter rows with valid translations
  const validRows: TranslationRow[] = [];
  let rowsSkipped = 0;

  for (const row of rows) {
    if (row.translatedValue && row.translatedValue.trim() !== '') {
      validRows.push(row);
    } else {
      rowsSkipped++;
    }
  }

  if (validRows.length === 0) {
    throw new Error('No valid translations found in CSV (all rows have empty translated_value)');
  }

  // Extract target language from first valid row (all rows have same target)
  const firstRow = validRows[0]!;
  const targetLanguage = firstRow.targetLanguage;

  if (!targetLanguage) {
    throw new Error('No target language found in CSV');
  }

  // Build translation map (key -> value)
  const translations = new Map<string, string>();
  const errors: ImportError[] = [];

  for (const row of validRows) {
    const key = row.translationKey;
    const value = row.translatedValue;

    if (!key || key.trim() === '') {
      errors.push({
        translationKey: key || '(empty)',
        reason: 'Empty translation key',
      });
      continue;
    }

    if (!key.includes('.')) {
      errors.push({
        translationKey: key,
        reason: 'Key must contain file prefix (e.g., "generic.welcome")',
      });
      continue;
    }

    translations.set(key, value);
  }

  if (translations.size === 0) {
    throw new Error('No valid translation keys found in CSV');
  }

  // Build target language directory path
  const langDir = join(translationsDir, targetLanguage);

  // Import translations using parser
  const parserResult = await parser.import(langDir, translations);

  return {
    targetLanguage,
    filesCreated: parserResult.filesCreated,
    filesModified: parserResult.filesModified,
    keysImported: parserResult.keysWritten,
    rowsSkipped,
    errors,
  };
}
