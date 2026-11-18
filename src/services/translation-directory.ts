import { join } from 'node:path';
import type { Parser } from '../types';

export interface TranslationDirectoryKeys {
  sourceKeys: Map<string, string>;
  targetKeys: Map<string, string>;
}

// Loads one language from one translations directory using the configured parser.
export async function loadLanguageKeysFromTranslationsDir(
  parser: Parser,
  repoPath: string,
  translationsDir: string,
  language: string,
): Promise<Map<string, string>> {
  return parser.export(join(repoPath, translationsDir, language));
}

// Loads both source and target language keys for a single translations directory
// so callers can orchestrate multiple directories without duplicating path logic.
export async function loadTranslationDirectoryKeys(
  parser: Parser,
  repoPath: string,
  translationsDir: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationDirectoryKeys> {
  const [sourceKeys, targetKeys] = await Promise.all([
    loadLanguageKeysFromTranslationsDir(parser, repoPath, translationsDir, sourceLanguage),
    loadLanguageKeysFromTranslationsDir(parser, repoPath, translationsDir, targetLanguage),
  ]);

  return {
    sourceKeys,
    targetKeys,
  };
}
