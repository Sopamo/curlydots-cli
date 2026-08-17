import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { loadCliConfig } from '../../config/cli-config';
import { getParser } from '../../parsers';
import { loadParserFromFile } from '../../parsers/parser-file-loader';
import { resolveAuthToken } from '../../services/api/translation-keys';
import { startTranslationSyncRun } from '../../services/api/translation-sync-runs';
import { findContextForKeys } from '../../services/context-finder';
import { HttpClient, HttpClientError } from '../../services/http/client';
import { buildTranslationSyncPayloads } from '../../services/translation-sync/payload-builder';
import { configStore } from '../../stores';
import { globalLogger } from '../../utils/logger';
import { parseSyncArgs, printSyncHelp, validateSyncArgs } from './sync-args';

export async function runTranslationsSync(args: string[]): Promise<void> {
  const parsedArgs = parseSyncArgs(args);

  if (parsedArgs.help) {
    printSyncHelp();
    return;
  }

  const errors = validateSyncArgs(parsedArgs);
  if (errors.length > 0) {
    globalLogger.error(errors[0] ?? 'Invalid arguments');
    for (const error of errors.slice(1)) {
      globalLogger.error(error);
    }
    globalLogger.info('Run "curlydots translations sync --help" for usage information.');
    process.exitCode = 1;
    return;
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
  const apiHost = parsedArgs.apiHost || config.apiEndpoint;
  const tokenOverride =
    parsedArgs.apiToken && parsedArgs.apiToken.trim() !== '' ? parsedArgs.apiToken : config.token;

  const client = new HttpClient({
    baseUrl: apiHost,
    timeout: config.timeout,
    retries: config.retries,
    debug: config.debug,
  });

  const token = await resolveAuthToken({ client, token: tokenOverride });
  if (!token) {
    globalLogger.error('Missing API token. Run "curlydots auth login" or pass --api-token.');
    process.exitCode = 1;
    return;
  }

  configStore.getState().setConfig({
    repoPath: resolvedPath,
    translationsDir: parsedArgs.translationsDir,
    sourceLanguage: parsedArgs.source,
    targetLanguage: '',
    parser: parser.name,
    extensions: parsedArgs.extensions,
    outputPath: '',
  });

  try {
    const languageDir = resolve(resolvedPath, parsedArgs.translationsDir, parsedArgs.source);
    const sourceKeys = await parser.export(languageDir);
    const entries = Array.from(sourceKeys.entries()).map(([key, sourceValue]) => ({
      key,
      sourceValue,
    }));

    const withContext = await findContextForKeys(entries, resolvedPath);
    const payloads = buildTranslationSyncPayloads(withContext, resolvedPath);
    const idempotencyKey = process.env.CURLYDOTS_GITHUB_DELIVERY_ID?.trim() || randomUUID();

    const result = await startTranslationSyncRun(
      client,
      parsedArgs.teamSlug,
      parsedArgs.projectSlug,
      token,
      payloads,
      idempotencyKey,
    );

    globalLogger.info(
      `Translation sync started: ${result.runId} (${result.status}). Imported ${result.importedKeysCount} keys, queued ${result.queuedBatchesCount} batches.`,
    );
  } catch (error) {
    if (error instanceof HttpClientError) {
      const prefix =
        error.meta.category === 'authentication'
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
    globalLogger.error(`Sync failed: ${message}`);
    process.exitCode = 1;
  }
}
