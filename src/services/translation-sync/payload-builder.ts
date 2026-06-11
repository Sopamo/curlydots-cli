import { relative } from 'node:path';
import type { UsageContext } from '../../types';
import type { TranslationSyncKeyPayload } from '../../types/translation-sync';

export interface SyncKeyWithContext {
  key: string;
  sourceValue: string;
  contexts: UsageContext[];
}

export function formatUsageContexts(contexts: UsageContext[], repoPath: string): string {
  if (contexts.length === 0) {
    return '';
  }

  return contexts
    .map((context) => {
      const relativeFilePath = relative(repoPath, context.filePath) || context.filePath;

      return [
        `File: ${relativeFilePath}`,
        `Line: ${context.lineNumber}`,
        `Snippet lines: ${context.snippetStartLine}-${context.snippetEndLine}`,
        'Snippet:',
        context.snippet,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

export function buildTranslationSyncPayloads(
  keys: SyncKeyWithContext[],
  repoPath: string,
): TranslationSyncKeyPayload[] {
  return keys.map((entry) => {
    const context = formatUsageContexts(entry.contexts, repoPath);

    return {
      key: entry.key,
      default_value: entry.sourceValue,
      ...(context === '' ? {} : { context }),
    };
  });
}
