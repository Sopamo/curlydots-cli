/**
 * Import Command
 *
 * Import translated CSV data back into translation files.
 * This is the inverse of the extract command, completing the translation workflow.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAvailableParsers, getParser } from '../parsers';
import { runImport as runImportService } from '../services/import-service';
import type { ImportCommandResult, ImportConfig } from '../types';

/**
 * Import command arguments
 */
export interface ImportArgs {
  csvPath: string;
  translationsDir: string;
  parser: string;
  help: boolean;
}

/**
 * Parse import command arguments
 */
export function parseImportArgs(args: string[]): ImportArgs {
  const result: ImportArgs = {
    csvPath: '',
    translationsDir: '',
    parser: 'node-module',
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '-d' || arg === '--translations-dir') {
      result.translationsDir = args[++i] || '';
    } else if (arg === '-p' || arg === '--parser') {
      result.parser = args[++i] || 'node-module';
    } else if (!arg?.startsWith('-') && !result.csvPath) {
      result.csvPath = arg || '';
    }
    i++;
  }

  return result;
}

/**
 * Validate import command arguments
 */
export function validateImportArgs(args: ImportArgs): string | null {
  if (!args.csvPath) {
    return 'CSV file path is required';
  }

  if (!args.translationsDir) {
    return 'Translations directory (-d) is required';
  }

  const resolvedCsvPath = resolve(args.csvPath);
  if (!existsSync(resolvedCsvPath)) {
    return `CSV file not found: ${resolvedCsvPath}`;
  }

  const parser = getParser(args.parser);
  if (!parser) {
    const available = getAvailableParsers().join(', ');
    return `Unknown parser: ${args.parser}. Available: ${available}`;
  }

  return null;
}

/**
 * Print import command help
 */
export function printImportHelp(): void {
  const parsers = getAvailableParsers().join(', ');
  console.log(`
aitranslate import - Import translated CSV back into translation files

USAGE:
  aitranslate import <csv-file> [options]

ARGUMENTS:
  <csv-file>    Path to translated CSV file (output from 'translate' command)

OPTIONS:
  -d, --translations-dir <path>  Translations directory (required)
  -p, --parser <name>            Parser to use [default: node-module]
  -h, --help                     Show this help message

AVAILABLE PARSERS:
  ${parsers}

EXAMPLES:
  aitranslate import translated.csv -d src/translations
  aitranslate import ./output/translations-de.csv -d locales -p node-module

WORKFLOW:
  1. Extract missing translations:  aitranslate extract ./repo -s en -t de -d translations
  2. Translate with AI:             aitranslate translate missing.csv
  3. Import translations:           aitranslate import translated.csv -d translations
`);
}

/**
 * Run import command
 */
export async function runImport(config: ImportConfig): Promise<ImportCommandResult> {
  try {
    const resolvedCsvPath = resolve(config.csvPath);
    const resolvedTranslationsDir = resolve(config.translationsDir);

    const parser = getParser(config.parser);
    if (!parser) {
      return {
        success: false,
        error: `Unknown parser: ${config.parser}`,
      };
    }

    const result = await runImportService(resolvedCsvPath, resolvedTranslationsDir, parser);

    return {
      success: true,
      summary: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Print import summary
 */
export function printImportSummary(result: ImportCommandResult): void {
  if (!result.success) {
    console.error(`\n❌ Import failed: ${result.error}\n`);
    return;
  }

  const summary = result.summary!;
  console.log(`
✅ Import completed successfully!

Summary:
  Target language:   ${summary.targetLanguage}
  Files created:     ${summary.filesCreated}
  Files modified:    ${summary.filesModified}
  Keys imported:     ${summary.keysImported}
  Rows skipped:      ${summary.rowsSkipped}
`);

  if (summary.errors.length > 0) {
    console.log(`Warnings (${summary.errors.length}):`);
    for (const err of summary.errors) {
      console.log(`  - ${err.translationKey}: ${err.reason}`);
    }
    console.log();
  }
}

/**
 * Main entry point for import command
 */
export async function importCommand(args: string[]): Promise<void> {
  const parsedArgs = parseImportArgs(args);

  if (parsedArgs.help) {
    printImportHelp();
    return;
  }

  const validationError = validateImportArgs(parsedArgs);
  if (validationError) {
    console.error(`Error: ${validationError}\n`);
    printImportHelp();
    process.exit(1);
  }

  const result = await runImport({
    csvPath: parsedArgs.csvPath,
    translationsDir: parsedArgs.translationsDir,
    parser: parsedArgs.parser,
  });

  printImportSummary(result);

  if (!result.success) {
    process.exit(1);
  }
}
