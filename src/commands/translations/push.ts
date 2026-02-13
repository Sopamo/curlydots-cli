import { resolve } from 'node:path';
import { Glob } from 'bun';
import chalk from 'chalk';
import { getParser } from '../../parsers';
import { loadParserFromFile } from '../../parsers/parser-file-loader';
import { findContextForKeys } from '../../services/context-finder';
import {
  fetchExistingTranslationKeys,
  resolveAuthToken,
  uploadTranslationKeys,
} from '../../services/api/translation-keys';
import { buildTranslationKeyPayloads } from '../../services/translation-keys/payload-builder';
import { configStore } from '../../stores';
import { globalLogger } from '../../utils/logger';
import { formatPushSummary } from '../../ui/output';
import { HttpClient, HttpClientError } from '../../services/http/client';
import { loadCliConfig } from '../../config/cli-config';
import { getCurrentProject } from '../../config/project-config';
import { parsePushArgs, printPushHelp, validatePushArgs } from './push-args';

function renderProgressBar(current: number, total: number, width = 30): string {
  const ratio = total === 0 ? 1 : current / total;
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const pct = Math.round(ratio * 100);
  return `${bar} ${pct}% (${current}/${total})`;
}

export async function runTranslationsPush(args: string[]): Promise<void> {
  const parsedArgs = parsePushArgs(args);

  if (parsedArgs.help) {
    printPushHelp();
    return;
  }

  const errors = validatePushArgs(parsedArgs);
  if (errors.length > 0) {
    globalLogger.error(errors[0] ?? 'Invalid arguments');
    for (const error of errors.slice(1)) {
      globalLogger.error(error);
    }
    globalLogger.info('Run "curlydots translations push --help" for usage information.');
    process.exitCode = 1;
    return;
  }

  // Resolve project UUID from override or fallback to selected project
  let projectUuid = parsedArgs.projectUuid;
  if (!projectUuid) {
    const currentProject = getCurrentProject();
    if (!currentProject) {
      globalLogger.error('No project specified. Use --project or run "curlydots projects select" to choose a project.');
      process.exitCode = 1;
      return;
    }
    projectUuid = currentProject.projectId;
  }

  const resolvedPath = resolve(parsedArgs.repoPath);
  let parser = getParser(parsedArgs.parser);
  if (parsedArgs.parserFile) {
    try {
      parser = await loadParserFromFile(parsedArgs.parserFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalLogger.error(message);
      process.exitCode = 1;
      return;
    }
  }

  if (!parser) {
    globalLogger.error(`Unknown parser: ${parsedArgs.parser}`);
    process.exitCode = 1;
    return;
  }

  const config = loadCliConfig();
  const client = new HttpClient({
    baseUrl: parsedArgs.apiHost,
    timeout: config.timeout,
    retries: config.retries,
    debug: config.debug,
  });

  const token = await resolveAuthToken({ client, token: parsedArgs.apiToken });
  if (!token) {
    globalLogger.error('Missing API token. Run "curlydots auth login" or pass --api-token.');
    process.exitCode = 1;
    return;
  }

  configStore.getState().setConfig({
    repoPath: resolvedPath,
    translationsDir: parsedArgs.translationsDirs[0] ?? '',
    sourceLanguage: parsedArgs.source,
    targetLanguage: '',
    parser: parser.name,
    extensions: parsedArgs.extensions,
    outputPath: '',
  });

  try {
    // Step 1: Resolve translation directories (expand globs)
    const resolvedDirs: string[] = [];
    for (const dir of parsedArgs.translationsDirs) {
      if (dir.includes('*')) {
        const glob = new Glob(dir);
        for await (const match of glob.scan({ cwd: resolvedPath, absolute: false, onlyFiles: false })) {
          resolvedDirs.push(match);
        }
      } else {
        resolvedDirs.push(dir);
      }
    }

    if (resolvedDirs.length === 0) {
      globalLogger.error('No translation directories found after resolving glob patterns');
      process.exitCode = 1;
      return;
    }

    // Step 2: Parse source translation keys from all directories
    globalLogger.info(`Parsing ${chalk.cyan(parsedArgs.source)} translation keys using ${chalk.cyan(parser.name)} parser from ${chalk.bold(resolvedDirs.length)} location${resolvedDirs.length === 1 ? '' : 's'}...`);
    const sourceKeys = new Map<string, string>();

    for (const dir of resolvedDirs) {
      const languageDir = resolve(resolvedPath, dir, parsedArgs.source);
      try {
        const keys = await parser.export(languageDir);
        const dirLabel = chalk.dim(dir);
        globalLogger.info(`  ${dirLabel} → ${keys.size} keys`);
        for (const [key, value] of keys) {
          sourceKeys.set(key, value);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        globalLogger.warn(`  ${chalk.dim(dir)} → skipped (${message})`);
      }
    }

    const allEntries = Array.from(sourceKeys.entries()).map(([key, sourceValue]) => ({
      key,
      sourceValue,
    }));
    const entries = allEntries.filter((e) => e.sourceValue.trim() !== '');
    const emptyCount = allEntries.length - entries.length;
    if (emptyCount > 0) {
      globalLogger.warn(`Skipping ${chalk.yellow(String(emptyCount))} keys with empty source values`);
    }
    globalLogger.success(`Found ${chalk.bold(entries.length)} translation keys total`);

    if (entries.length === 0) {
      console.log('');
      console.log(formatPushSummary({ scanned: 0, skipped: 0, uploaded: 0, failed: 0, batches: 0 }));
      return;
    }

    // Step 3: Fetch existing keys from server (before context search to skip known keys)
    globalLogger.info(`Fetching existing keys from project ${chalk.cyan(projectUuid.slice(0, 8))}...`);
    const existing = await fetchExistingTranslationKeys(client, projectUuid, token);
    const existingCount = existing.data?.keys?.length ?? 0;
    globalLogger.success(`Server has ${chalk.bold(existingCount)} existing keys`);

    // Step 4: Filter out keys that already exist on server
    const existingSet = new Set(existing.data?.keys ?? []);
    const newEntries = entries.filter((e) => !existingSet.has(e.key));
    const skipped = entries.length - newEntries.length;

    if (skipped > 0) {
      globalLogger.info(`Skipping ${chalk.yellow(String(skipped))} keys that already exist`);
    }

    if (newEntries.length === 0) {
      globalLogger.success('All keys already exist on server — nothing to upload');
      console.log('');
      console.log(formatPushSummary({ scanned: entries.length, skipped, uploaded: 0, failed: 0, batches: 0 }));
      return;
    }

    // Step 5: Collect code context (only for new keys)
    globalLogger.info(`Collecting code context for ${chalk.bold(newEntries.length)} new keys...`);
    const withContext = await findContextForKeys(newEntries, resolvedPath, ({ current, total }) => {
      const progress = renderProgressBar(current, total);
      process.stdout.write(`  ${progress}\r`);
    });
    process.stdout.write('\n');
    const keysWithContext = withContext.filter((e) => e.contexts && e.contexts.length > 0).length;
    globalLogger.success(`Collected context for ${chalk.bold(keysWithContext)}/${newEntries.length} keys`);

    // Step 6: Build payloads
    const newPayloads = buildTranslationKeyPayloads(withContext, parsedArgs.source);

    // Step 7: Upload new keys with progress bar
    const totalBatches = Math.ceil(newPayloads.length / parsedArgs.batchSize);
    globalLogger.info(`Uploading ${chalk.bold(newPayloads.length)} new keys in ${chalk.bold(totalBatches)} batch${totalBatches === 1 ? '' : 'es'}...`);

    const result = await uploadTranslationKeys(
      client,
      projectUuid,
      token,
      newPayloads,
      parsedArgs.batchSize,
      ({ batch, totalBatches: total, uploaded, total: totalKeys }) => {
        const progress = renderProgressBar(uploaded, totalKeys);
        process.stdout.write(`  ${progress}  Batch ${batch}/${total}\r`);
      },
    );

    // Clear the progress line and print completion
    process.stdout.write('\n');
    globalLogger.success(`Uploaded ${chalk.bold(result.uploaded)} keys successfully`);

    console.log('');
    console.log(formatPushSummary({
      scanned: entries.length,
      skipped,
      uploaded: result.uploaded,
      failed: 0,
      batches: result.batches,
    }));
  } catch (error) {
    if (error instanceof HttpClientError) {
      const prefix = error.meta.category === 'authentication'
        ? 'Authentication failed'
        : error.meta.category === 'transient'
          ? 'Temporary network error'
          : error.meta.category === 'system'
            ? 'System error'
            : 'Request failed';
      globalLogger.error(`${prefix}: ${error.message}`);
      if (error.meta.category === 'authentication') {
        globalLogger.info('Run "curlydots auth login" or pass --api-token to authenticate.');
      }
      process.exitCode = 1;
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    globalLogger.error(`Push failed: ${message}`);
    process.exitCode = 1;
  }
}
