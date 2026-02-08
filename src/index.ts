#!/usr/bin/env bun
import packageJson from '../package.json' with { type: 'json' };
import { runCli } from './cli';
import { maybeRunSelfUpdate } from './services/update/version-check';
import { globalLogger } from './utils/logger';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  await runCli(argv);
  await maybeRunSelfUpdate({
    argv,
    currentVersion: packageJson.version,
    packageName: packageJson.name,
  });
}

main().catch((error) => {
  globalLogger.error('Fatal error occurred while running Curlydots CLI.', error);
  process.exitCode = 1;
});
