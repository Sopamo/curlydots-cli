/**
 * CSV Writer Service
 *
 * Formats and writes missing translations to CSV file.
 */

import type { MissingTranslation } from '../types';

/** CSV header row - 6 columns per spec */
const CSV_HEADER =
  'translation_key,source_value,source_language,target_language,code_context,translation_context';

/**
 * Escape a field for CSV output (RFC 4180 compliant)
 * @param field - Field value to escape
 * @returns Escaped field value
 */
export function escapeCsvField(field: string): string {
  // Check if field needs quoting
  const needsQuoting = field.includes(',') || field.includes('"') || field.includes('\n');

  if (!needsQuoting) {
    return field;
  }

  // Escape double quotes by doubling them
  const escaped = field.replace(/"/g, '""');

  // Wrap in double quotes
  return `"${escaped}"`;
}

/**
 * Format a missing translation as a CSV row
 * @param missing - Missing translation to format
 * @returns CSV row string with 6 columns
 */
export function formatCsvRow(missing: MissingTranslation): string {
  const codeContextJson = JSON.stringify(missing.contexts);
  const translationContextJson = JSON.stringify(missing.translationContexts || []);

  const fields = [
    escapeCsvField(missing.key),
    escapeCsvField(missing.sourceValue),
    escapeCsvField(missing.sourceLanguage),
    escapeCsvField(missing.targetLanguage),
    escapeCsvField(codeContextJson),
    escapeCsvField(translationContextJson),
  ];

  return fields.join(',');
}

/**
 * Write missing translations to CSV file
 * @param missing - Array of missing translations
 * @param outputPath - Path to output file
 */
export async function writeCsv(missing: MissingTranslation[], outputPath: string): Promise<void> {
  const lines: string[] = [CSV_HEADER];

  for (const item of missing) {
    lines.push(formatCsvRow(item));
  }

  const content = `${lines.join('\n')}\n`;

  await Bun.write(outputPath, content);
}
