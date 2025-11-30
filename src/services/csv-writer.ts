/**
 * CSV Writer Service
 *
 * Formats and writes missing translations to CSV file using fast-csv.
 */

import { writeToBuffer } from '@fast-csv/format';
import type { MissingTranslation } from '../types';

/** CSV column headers */
const CSV_HEADERS = [
  'translation_key',
  'source_value',
  'source_language',
  'target_language',
  'code_context',
  'translation_context',
] as const;

/**
 * CSV row type for fast-csv
 */
interface CsvRow {
  translation_key: string;
  source_value: string;
  source_language: string;
  target_language: string;
  code_context: string;
  translation_context: string;
}

/**
 * Convert a MissingTranslation to a CSV row object
 * @param missing - Missing translation to convert
 * @returns CSV row object
 */
export function toCsvRow(missing: MissingTranslation): CsvRow {
  return {
    translation_key: missing.key,
    source_value: missing.sourceValue,
    source_language: missing.sourceLanguage,
    target_language: missing.targetLanguage,
    code_context: JSON.stringify(missing.contexts),
    translation_context: JSON.stringify(missing.translationContexts || []),
  };
}

/**
 * Write missing translations to CSV file using fast-csv
 * @param missing - Array of missing translations
 * @param outputPath - Path to output file
 */
export async function writeCsv(missing: MissingTranslation[], outputPath: string): Promise<void> {
  const rows = missing.map(toCsvRow);

  const buffer = await writeToBuffer(rows, {
    headers: CSV_HEADERS as unknown as string[],
    quoteColumns: true,
    quoteHeaders: false,
  });

  await Bun.write(outputPath, buffer);
}

/**
 * Write translation rows to CSV file (for translate command output)
 * @param rows - Array of row objects
 * @param headers - Column headers
 * @param outputPath - Path to output file
 */
export async function writeTranslationCsv(
  rows: Record<string, string>[],
  headers: string[],
  outputPath: string,
): Promise<void> {
  const buffer = await writeToBuffer(rows, {
    headers,
    quoteColumns: true,
    quoteHeaders: false,
  });

  await Bun.write(outputPath, buffer);
}
