#!/usr/bin/env bun
import { runCli } from './cli';
import { globalLogger } from './utils/logger';

async function main(): Promise<void> {
  await runCli(process.argv.slice(2));
}

main().catch((error) => {
  globalLogger.error('Fatal error occurred while running Curlydots CLI.', error);
  process.exitCode = 1;
});
