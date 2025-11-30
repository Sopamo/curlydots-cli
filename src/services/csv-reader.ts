/**
 * CSV Reader Service
 *
 * Reads and parses CSV files using fast-csv.
 */

import { parseString } from '@fast-csv/parse';
import type { TranslationRow } from '../types';

/**
 * Expected CSV headers for translation input
 */
const REQUIRED_HEADERS = [
  'translation_key',
  'source_value',
  'source_language',
  'target_language',
  'code_context',
  'translation_context',
] as const;

/**
 * Raw CSV row from parsing
 */
interface RawCsvRow {
  translation_key: string;
  source_value: string;
  source_language: string;
  target_language: string;
  code_context: string;
  translation_context: string;
  translated_value?: string;
}

/**
 * Validate that all required headers are present
 * @param headers - Headers from CSV file
 * @returns Array of missing headers, empty if all present
 */
export function validateHeaders(headers: string[]): string[] {
  const missing: string[] = [];
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      missing.push(required);
    }
  }
  return missing;
}

/**
 * Parse CSV content string into translation rows
 * @param content - CSV file content as string
 * @returns Promise resolving to parsed translation rows
 */
export async function parseCsvContent(content: string): Promise<TranslationRow[]> {
  return new Promise((resolve, reject) => {
    const rows: TranslationRow[] = [];
    let index = 0;
    let headers: string[] = [];

    parseString(content, { headers: true })
      .on('headers', (parsedHeaders: string[]) => {
        headers = parsedHeaders;
        const missing = validateHeaders(headers);
        if (missing.length > 0) {
          reject(new Error(`Missing required CSV columns: ${missing.join(', ')}`));
        }
      })
      .on('data', (row: RawCsvRow) => {
        const translationRow: TranslationRow = {
          index: index++,
          translationKey: row.translation_key || '',
          sourceValue: row.source_value || '',
          sourceLanguage: row.source_language || '',
          targetLanguage: row.target_language || '',
          codeContext: row.code_context || '[]',
          translationContext: row.translation_context || '[]',
          translatedValue: row.translated_value || '',
          status: 'pending',
        };

        // Determine initial status based on existing translated_value
        if (translationRow.translatedValue && translationRow.translatedValue !== 'ERROR') {
          translationRow.status = 'skipped';
        } else if (translationRow.translatedValue === 'ERROR') {
          translationRow.status = 'pending'; // Will be retried
          translationRow.translatedValue = '';
        }

        rows.push(translationRow);
      })
      .on('end', () => resolve(rows))
      .on('error', (error: Error) => reject(error));
  });
}

/**
 * Read and parse a CSV file
 * @param filePath - Path to CSV file
 * @returns Promise resolving to parsed translation rows
 */
export async function readCsv(filePath: string): Promise<TranslationRow[]> {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = await file.text();

  if (!content.trim()) {
    throw new Error('CSV file is empty');
  }

  return parseCsvContent(content);
}

/**
 * Check if a CSV file has a translated_value column
 * @param filePath - Path to CSV file
 * @returns Promise resolving to true if column exists
 */
export async function hasTranslatedValueColumn(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return false;
  }

  const content = await file.text();
  const firstLine = content.split('\n')[0] || '';

  return firstLine.includes('translated_value');
}
