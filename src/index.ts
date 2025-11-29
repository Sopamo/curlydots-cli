#!/usr/bin/env bun
/**
 * AITranslate CLI
 *
 * Find missing translations with code context.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from 'ink';
import * as React from 'react';
import { getAvailableParsers, getParser } from './parsers';
import { findMissingTranslations } from './services/analyzer';
import { findContextForKeys } from './services/context-finder';
import { writeCsv } from './services/csv-writer';
import { analysisStore, configStore } from './stores';
import { App } from './ui';

/**
 * Parse CLI arguments
 */
function parseArgs(): {
  repoPath: string;
  source: string;
  target: string;
  translationsDir: string;
  parser: string;
  extensions: string[];
  output: string;
  help: boolean;
  version: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    repoPath: '',
    source: '',
    target: '',
    translationsDir: '',
    parser: 'node-module',
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.html'],
    output: 'missing-translations.csv',
    help: false,
    version: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '-v' || arg === '--version') {
      result.version = true;
    } else if (arg === '-s' || arg === '--source') {
      result.source = args[++i] || '';
    } else if (arg === '-t' || arg === '--target') {
      result.target = args[++i] || '';
    } else if (arg === '-d' || arg === '--translations-dir') {
      result.translationsDir = args[++i] || '';
    } else if (arg === '-p' || arg === '--parser') {
      result.parser = args[++i] || 'node-module';
    } else if (arg === '-e' || arg === '--extensions') {
      const extString = args[++i] || '';
      result.extensions = extString.split(',').map((e) => e.trim());
    } else if (arg === '-o' || arg === '--output') {
      result.output = args[++i] || 'missing-translations.csv';
    } else if (!arg?.startsWith('-') && !result.repoPath) {
      result.repoPath = arg || '';
    }
    i++;
  }

  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
aitranslate - Find missing translations with code context

USAGE:
  aitranslate <repo-path> [options]

ARGUMENTS:
  <repo-path>    Path to the repository to analyze

OPTIONS:
  -s, --source <lang>           Source language code (required)
  -t, --target <lang>           Target language code (required)
  -d, --translations-dir <path> Translations directory relative to repo (required)
  -p, --parser <name>           Parser to use [default: node-module]
  -e, --extensions <list>       File extensions to search [default: .js,.ts,.jsx,.tsx,.vue,.svelte,.html]
  -o, --output <path>           Output CSV path [default: missing-translations.csv]
  -h, --help                    Show this help message
  -v, --version                 Show version number

EXAMPLES:
  aitranslate ./my-app -s en -t de -d src/translations
  aitranslate /path/to/repo --source en --target fr --translations-dir locales --output report.csv

PARSERS:
  ${getAvailableParsers().join(', ') || 'node-module'}
`);
}

/**
 * Print version
 */
function printVersion(): void {
  console.log('aitranslate v0.1.0');
}

/**
 * Validate arguments and return errors
 */
function validateArgs(args: ReturnType<typeof parseArgs>): string[] {
  const errors: string[] = [];

  if (!args.repoPath) {
    errors.push('Missing required argument: <repo-path>');
  } else {
    const resolvedPath = resolve(args.repoPath);
    if (!existsSync(resolvedPath)) {
      errors.push(`Repository path does not exist: ${resolvedPath}`);
    }
  }

  if (!args.source) {
    errors.push('Missing required option: --source');
  }

  if (!args.target) {
    errors.push('Missing required option: --target');
  }

  if (!args.translationsDir) {
    errors.push('Missing required option: --translations-dir');
  } else if (args.repoPath) {
    const translationsPath = join(resolve(args.repoPath), args.translationsDir);
    if (!existsSync(translationsPath)) {
      errors.push(`Translations directory not found: ${translationsPath}`);
    }
  }

  if (!getParser(args.parser)) {
    errors.push(`Unknown parser: ${args.parser} (available: ${getAvailableParsers().join(', ')})`);
  }

  return errors;
}

/**
 * Run analysis (shared logic for TUI mode)
 */
async function runAnalysis(args: ReturnType<typeof parseArgs>): Promise<void> {
  const resolvedPath = resolve(args.repoPath);
  const analysis = analysisStore.getState();

  // Task 1-3: Find missing translations (handles startTask/completeTask internally)
  const result = await findMissingTranslations();

  if (result.missing.length === 0) {
    // Mark remaining tasks as complete
    analysis.completeTask('find_code_context');
    analysis.completeTask('find_translation_context');
    analysis.completeTask('export_csv');
    analysis.setStatus('complete');
    return;
  }

  // Task 4: Find code context for each missing key
  analysis.startTask('find_code_context');
  analysis.setStatus('searching_context');
  const keysWithContext = await findContextForKeys(
    result.missing.map((m) => ({ key: m.key, sourceValue: m.sourceValue })),
    resolvedPath,
  );
  analysis.completeTask('find_code_context');

  // Task 5: Find translation context (already handled in findMissingTranslations)
  analysis.startTask('find_translation_context');
  analysis.setStatus('searching_translation_context');
  // Translation context is already populated by analyzer
  analysis.completeTask('find_translation_context');

  // Merge contexts back into missing translations
  const missingWithContext = result.missing.map((m) => {
    const found = keysWithContext.find((k) => k.key === m.key);
    return {
      ...m,
      contexts: found?.contexts || [],
    };
  });

  // Task 6: Write CSV
  analysis.startTask('export_csv');
  analysis.setStatus('writing_csv');
  await writeCsv(missingWithContext, args.output);
  analysis.completeTask('export_csv');

  analysis.setStatus('complete');
}

/**
 * Run with TUI mode
 */
async function runWithTui(args: ReturnType<typeof parseArgs>): Promise<void> {
  const resolvedPath = resolve(args.repoPath);

  // Render TUI
  render(
    React.createElement(App, {
      config: {
        repoPath: resolvedPath,
        translationsDir: args.translationsDir,
        sourceLanguage: args.source,
        targetLanguage: args.target,
        parser: args.parser,
        extensions: args.extensions,
        outputPath: args.output,
      },
    }),
  );

  // Run analysis in background
  try {
    await runAnalysis(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    analysisStore.getState().setError(message);
  }

  // Wait a moment for final render then exit
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();

  // Handle help/version
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  // Validate arguments
  const errors = validateArgs(args);
  if (errors.length > 0) {
    console.error('Error:', errors[0]);
    for (const e of errors.slice(1)) {
      console.error('      ', e);
    }
    console.error('\nRun "aitranslate --help" for usage information.');
    process.exit(1);
  }

  // Configure stores
  const resolvedPath = resolve(args.repoPath);
  configStore.getState().setConfig({
    repoPath: resolvedPath,
    translationsDir: args.translationsDir,
    sourceLanguage: args.source,
    targetLanguage: args.target,
    parser: args.parser,
    extensions: args.extensions,
    outputPath: args.output,
  });

  // Run analysis with TUI (always on per spec FR-020)
  try {
    await runWithTui(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    analysisStore.getState().setError(message);
    process.exit(7);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
