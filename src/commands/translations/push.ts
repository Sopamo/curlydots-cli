import { resolve } from 'node:path';
import { getParser } from '../../parsers';
import { loadParserFromFile } from '../../parsers/parser-file-loader';
import { findContextForKeys } from '../../services/context-finder';
import {
  fetchExistingTranslationKeys,
  resolveAuthToken,
  uploadTranslationKeys,
} from '../../services/api/translation-keys';
import { buildTranslationKeyPayloads } from '../../services/translation-keys/payload-builder';
import { filterNewTranslationKeys } from '../../services/translation-keys/diff';
import { configStore } from '../../stores';
import { globalLogger } from '../../utils/logger';
import { formatPushSummary } from '../../ui/output';
import { HttpClient, HttpClientError } from '../../services/http/client';
import { loadCliConfig } from '../../config/cli-config';
import { getCurrentProject } from '../../config/project-config';
import { parsePushArgs, printPushHelp, validatePushArgs } from './push-args';

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

    if (entries.length === 0) {
      const summary = formatPushSummary({
        scanned: 0,
        skipped: 0,
        uploaded: 0,
        failed: 0,
        batches: 0,
      });
      console.log(summary);
      return;
    }

    const withContext = await findContextForKeys(entries, resolvedPath);
    const payloads = buildTranslationKeyPayloads(withContext, parsedArgs.source);

    const existing = await fetchExistingTranslationKeys(client, projectUuid, token);
    const newPayloads = filterNewTranslationKeys(payloads, existing.keys ?? []);
    const skipped = payloads.length - newPayloads.length;

    if (newPayloads.length === 0) {
      const summary = formatPushSummary({
        scanned: payloads.length,
        skipped,
        uploaded: 0,
        failed: 0,
        batches: 0,
      });
      console.log(summary);
      return;
    }

    const result = await uploadTranslationKeys(
      client,
      projectUuid,
      token,
      newPayloads,
      parsedArgs.batchSize,
    );

    const summary = formatPushSummary({
      scanned: payloads.length,
      skipped,
      uploaded: result.uploaded,
      failed: 0,
      batches: result.batches,
    });

    console.log(summary);
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
