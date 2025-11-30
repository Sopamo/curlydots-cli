/**
 * Translate Command
 *
 * Translates a CSV file using OpenAI GPT-5.1 with context.
 */

import { basename, dirname, extname, resolve } from 'node:path';
import pLimit from 'p-limit';
import { readCsv } from '../services/csv-reader';
import { writeTranslationCsv } from '../services/csv-writer';
import {
  type TranslationResponseWithReasoning,
  translateText,
  validateApiKey,
} from '../services/openai/client';
import { createTraceConfig, writeTrace } from '../services/trace-writer';
import { translationStore } from '../stores/translation-store';
import type {
  CodeUsage,
  ReasoningTrace,
  TraceConfig,
  TranslateConfig,
  TranslationExample,
  TranslationRequest,
  TranslationRow,
} from '../types';

/** Maximum consecutive errors before aborting */
const MAX_CONSECUTIVE_ERRORS = 5;

/** CSV output headers */
const OUTPUT_HEADERS = [
  'translation_key',
  'source_value',
  'source_language',
  'target_language',
  'code_context',
  'translation_context',
  'translated_value',
];

/**
 * Parse translate command arguments
 */
export function parseTranslateArgs(args: string[]): TranslateConfig {
  const result: TranslateConfig = {
    inputPath: '',
    outputPath: '',
    concurrency: 5,
    force: false,
    yes: false,
    traces: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      printTranslateHelp();
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      result.outputPath = args[++i] || '';
    } else if (arg === '-c' || arg === '--concurrency') {
      result.concurrency = Number.parseInt(args[++i] || '5', 10);
    } else if (arg === '-f' || arg === '--force') {
      result.force = true;
    } else if (arg === '-y' || arg === '--yes') {
      result.yes = true;
    } else if (arg === '--traces') {
      result.traces = true;
    } else if (!arg?.startsWith('-') && !result.inputPath) {
      result.inputPath = arg || '';
    }
    i++;
  }

  // Default output path: input-translated.csv
  if (!result.outputPath && result.inputPath) {
    const dir = dirname(result.inputPath);
    const base = basename(result.inputPath, extname(result.inputPath));
    result.outputPath = resolve(dir, `${base}-translated.csv`);
  }

  return result;
}

/**
 * Print translate command help
 */
export function printTranslateHelp(): void {
  console.log(`
aitranslate translate - Translate CSV file using AI

USAGE:
  aitranslate translate <csv-file> [options]

ARGUMENTS:
  <csv-file>    CSV file with missing translations (from extract command)

OPTIONS:
  -o, --output <path>       Output CSV path [default: <input>-translated.csv]
  -c, --concurrency <N>     Parallel API requests [default: 5]
  -f, --force               Re-translate all rows (ignore existing translations)
  -y, --yes                 Skip confirmation prompt
  --traces                  Enable reasoning trace logging (saves LLM reasoning to files)
  -h, --help                Show this help message

ENVIRONMENT:
  OPENAI_API_KEY    Required. Your OpenAI API key.

EXAMPLES:
  aitranslate translate missing-translations.csv
  aitranslate translate input.csv --output translated.csv --concurrency 10
  aitranslate translate input.csv --force --yes
`);
}

/**
 * Validate translate arguments
 */
export function validateTranslateArgs(config: TranslateConfig): string[] {
  const errors: string[] = [];

  if (!config.inputPath) {
    errors.push('Missing required argument: <csv-file>');
  }

  if (config.concurrency < 1 || config.concurrency > 20) {
    errors.push('Concurrency must be between 1 and 20');
  }

  return errors;
}

/**
 * Show warning about sending code context to OpenAI and get confirmation
 */
async function confirmCodeContextWarning(config: TranslateConfig): Promise<boolean> {
  if (config.yes) {
    return true;
  }

  console.log('\n⚠️  WARNING: Code context will be sent to OpenAI');
  console.log('   The CSV file may contain code snippets from your repository.');
  console.log('   These will be sent to OpenAI for translation context.\n');

  process.stdout.write('Do you want to proceed? (y/N): ');

  // Read single character from stdin
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      const char = data.toString().toLowerCase();
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      console.log(); // New line after input
      resolve(char === 'y');
    });
  });
}

/**
 * Parse JSON context from CSV row
 */
function parseCodeContext(jsonStr: string): CodeUsage[] {
  try {
    return JSON.parse(jsonStr) as CodeUsage[];
  } catch {
    return [];
  }
}

/**
 * Parse JSON translation context from CSV row
 */
function parseTranslationContext(jsonStr: string): TranslationExample[] {
  try {
    return JSON.parse(jsonStr) as TranslationExample[];
  } catch {
    return [];
  }
}

/**
 * Format JSON context for human-readable trace output
 */
function formatContextForTrace(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr) as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return '';
    }

    // Format code usages
    if ('filePath' in (parsed[0] as object)) {
      const usages = parsed as CodeUsage[];
      return usages
        .map((u) => `File: ${u.filePath} (line ${u.lineNumber})\n  ${u.snippet}`)
        .join('\n\n');
    }

    // Format translation examples
    if ('sourceKey' in (parsed[0] as object)) {
      const examples = parsed as TranslationExample[];
      return examples
        .map((e) => `${e.sourceKey}: "${e.sourceValue}" → "${e.targetValue}"`)
        .join('\n');
    }

    return JSON.stringify(parsed, null, 2);
  } catch {
    return jsonStr || '';
  }
}

/**
 * Build translation request from row
 */
function buildRequest(row: TranslationRow): TranslationRequest {
  return {
    sourceValue: row.sourceValue,
    sourceLanguage: row.sourceLanguage,
    targetLanguage: row.targetLanguage,
    codeUsages: parseCodeContext(row.codeContext),
    translationExamples: parseTranslationContext(row.translationContext),
  };
}

/**
 * Convert rows to CSV format for output
 */
function rowsToCsvData(rows: TranslationRow[]): Record<string, string>[] {
  return rows.map((row) => ({
    translation_key: row.translationKey,
    source_value: row.sourceValue,
    source_language: row.sourceLanguage,
    target_language: row.targetLanguage,
    code_context: row.codeContext,
    translation_context: row.translationContext,
    translated_value: row.translatedValue,
  }));
}

/**
 * Write current state to output CSV
 */
async function writeOutput(rows: TranslationRow[], outputPath: string): Promise<void> {
  // Sort by original index to preserve order
  const sorted = [...rows].sort((a, b) => a.index - b.index);
  const csvData = rowsToCsvData(sorted);
  await writeTranslationCsv(csvData, OUTPUT_HEADERS, outputPath);
}

/**
 * Translate a single row
 * Returns both the translated value and reasoning
 */
async function translateRow(row: TranslationRow): Promise<TranslationResponseWithReasoning> {
  const request = buildRequest(row);
  const response = await translateText(request);
  return response;
}

/**
 * Write trace file for a completed translation
 */
async function writeTraceFile(
  traceConfig: TraceConfig | null,
  row: TranslationRow,
  response: TranslationResponseWithReasoning,
): Promise<void> {
  if (!traceConfig?.enabled) {
    return;
  }

  const trace: ReasoningTrace = {
    translationKey: row.translationKey,
    sourceValue: row.sourceValue,
    sourceLanguage: row.sourceLanguage,
    targetLanguage: row.targetLanguage,
    timestamp: new Date().toISOString(),
    reasoningContent: response.reasoning,
    translatedValue: response.translated_value,
    codeContext: formatContextForTrace(row.codeContext),
    translationContext: formatContextForTrace(row.translationContext),
    tokenUsage: response.usage,
  };

  try {
    await writeTrace(traceConfig, trace);
  } catch (error) {
    // Non-blocking: warn but continue translation
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`\nWarning: Failed to write trace for "${row.translationKey}": ${message}`);
  }
}

/**
 * Main translation loop with parallel processing
 */
async function runTranslationLoop(
  config: TranslateConfig,
  traceConfig: TraceConfig | null,
): Promise<void> {
  const store = translationStore.getState();
  const limit = pLimit(config.concurrency);
  const rowsToTranslate = store.getRowsToTranslate();

  if (rowsToTranslate.length === 0) {
    console.log('No rows to translate. All rows already have translations.');
    store.setStatus('complete');
    return;
  }

  console.log(
    `\nTranslating ${rowsToTranslate.length} rows with concurrency ${config.concurrency}...`,
  );
  if (traceConfig?.enabled) {
    console.log(`Reasoning traces will be saved to: ${traceConfig.traceDir}`);
  }
  store.setStatus('translating');

  const tasks = rowsToTranslate.map((row) =>
    limit(async () => {
      // Check for abort condition
      if (translationStore.getState().consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        return;
      }

      store.startRow(row.index);

      try {
        const response = await translateRow(row);
        store.completeRow(row.index, response.translated_value);

        // Write trace file (non-blocking)
        await writeTraceFile(traceConfig, row, response);

        // Write incrementally after each completion
        await writeOutput(translationStore.getState().rows, config.outputPath);

        // Progress update
        const state = translationStore.getState();
        const progress = Math.round((state.completedCount / state.totalToTranslate) * 100);
        process.stdout.write(
          `\rProgress: ${state.completedCount}/${state.totalToTranslate} (${progress}%)`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        store.errorRow(row.index, message);
        console.error(`\nError translating "${row.translationKey}": ${message}`);

        // Write error state
        await writeOutput(translationStore.getState().rows, config.outputPath);

        // Check abort threshold
        if (translationStore.getState().consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`\n⚠️  Aborting: ${MAX_CONSECUTIVE_ERRORS} consecutive failures`);
          store.setStatus('aborted');
        }
      }
    }),
  );

  await Promise.all(tasks);
  console.log(); // New line after progress

  const finalState = translationStore.getState();
  if (finalState.status !== 'aborted') {
    store.setStatus('complete');
  }
}

/**
 * Print completion summary
 */
function printSummary(): void {
  const state = translationStore.getState();

  console.log('\n--- Translation Summary ---');
  console.log(`Total rows: ${state.rows.length}`);
  console.log(`Translated: ${state.completedCount - state.errorCount}`);
  console.log(`Skipped: ${state.skippedCount}`);
  console.log(`Errors: ${state.errorCount}`);
  console.log(`Output: ${state.outputPath}`);

  if (state.errorCount > 0) {
    console.log('\nFailed keys:');
    for (const r of state.rows.filter((r) => r.status === 'error')) {
      console.log(`  - ${r.translationKey}: ${r.errorMessage}`);
    }
  }

  if (state.status === 'aborted') {
    console.log('\n⚠️  Translation was aborted due to consecutive errors.');
    console.log('   Run again to retry failed rows.');
  }
}

/**
 * Run translate command (exported for testing)
 */
export async function runTranslate(config: TranslateConfig): Promise<void> {
  // Validate API key
  validateApiKey();

  // Read input CSV
  const rows = await readCsv(config.inputPath);

  if (rows.length === 0) {
    console.log('No translations to process.');
    return;
  }

  // Apply force flag - reset skipped rows to pending
  if (config.force) {
    for (const row of rows) {
      if (row.status === 'skipped') {
        row.status = 'pending';
        row.translatedValue = '';
      }
    }
  }

  // Initialize trace config if --traces is enabled
  const traceConfig = config.traces ? createTraceConfig(dirname(config.outputPath)) : null;

  // Initialize store
  translationStore
    .getState()
    .initialize(rows, config.inputPath, config.outputPath, config.concurrency, config.force);

  // Run translation loop
  await runTranslationLoop(config, traceConfig);

  // Print summary
  printSummary();
}

/**
 * Translate command entry point
 */
export async function translateCommand(args: string[]): Promise<void> {
  const config = parseTranslateArgs(args);

  // Validate arguments
  const errors = validateTranslateArgs(config);
  if (errors.length > 0) {
    console.error('Error:', errors[0]);
    for (const e of errors.slice(1)) {
      console.error('      ', e);
    }
    console.error('\nRun "aitranslate translate --help" for usage information.');
    process.exit(1);
  }

  // Resolve paths
  config.inputPath = resolve(config.inputPath);
  config.outputPath = resolve(config.outputPath);

  // Confirm code context warning
  const confirmed = await confirmCodeContextWarning(config);
  if (!confirmed) {
    console.log('Translation cancelled.');
    process.exit(0);
  }

  try {
    await runTranslate(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
