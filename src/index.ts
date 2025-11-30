#!/usr/bin/env bun
/**
 * AITranslate CLI
 *
 * Subcommand router for translation tools.
 *
 * Commands:
 *   extract   - Find missing translations with code context (original functionality)
 *   translate - Translate CSV file using AI
 */

import { runExtract } from './commands/extract';
import { translateCommand } from './commands/translate';

/**
 * Print main help message
 */
function printHelp(): void {
  console.log(`
aitranslate - AI-powered translation tools

USAGE:
  aitranslate <command> [options]

COMMANDS:
  extract    Find missing translations with code context and export to CSV
  translate  Translate a CSV file using AI (OpenAI GPT-5.1)

OPTIONS:
  -h, --help     Show this help message
  -v, --version  Show version number

EXAMPLES:
  aitranslate extract ./my-app -s en -t de -d src/translations
  aitranslate translate missing-translations.csv --output translated.csv

Run 'aitranslate <command> --help' for more information on a specific command.
`);
}

/**
 * Print version
 */
function printVersion(): void {
  console.log('aitranslate v0.2.0');
}

/**
 * Main CLI entry point - subcommand router
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const firstArg = args[0];

  // No arguments - show help
  if (!firstArg) {
    printHelp();
    process.exit(0);
  }

  // Global flags
  if (firstArg === '-h' || firstArg === '--help') {
    printHelp();
    process.exit(0);
  }

  if (firstArg === '-v' || firstArg === '--version') {
    printVersion();
    process.exit(0);
  }

  // Route to subcommands
  switch (firstArg) {
    case 'extract':
      await runExtract(args.slice(1));
      break;

    case 'translate':
      await translateCommand(args.slice(1));
      break;

    default:
      console.error(`Unknown command: ${firstArg}`);
      console.error('Run "aitranslate --help" for usage information.');
      process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
