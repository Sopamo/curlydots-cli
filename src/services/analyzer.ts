/**
 * Translation Analyzer Service
 *
 * Compares source and target language translation files to find missing keys.
 */

import { join } from 'node:path';
import { getParser } from '../parsers';
import { analysisStore, configStore } from '../stores';
import type { MissingTranslation } from '../types';
import { findTranslationContextForKey } from './translation-context';

/**
 * Result of translation analysis
 */
export interface AnalysisResult {
  /** Number of keys in source language */
  sourceKeyCount: number;

  /** Number of keys in target language */
  targetKeyCount: number;

  /** List of missing translations */
  missing: MissingTranslation[];
}

/**
 * Compare source and target translation sets to find missing keys
 * @param source - Source language translations
 * @param target - Target language translations
 * @param includeTranslationContext - Whether to find translation context examples
 * @returns Array of missing translations
 */
export function compareTranslationSets(
  source: Map<string, string>,
  target: Map<string, string>,
  includeTranslationContext = true,
): MissingTranslation[] {
  const config = configStore.getState();
  const missing: MissingTranslation[] = [];

  for (const [key, value] of source) {
    if (!target.has(key)) {
      // Find translation context examples for nouns in source value
      const translationContexts = includeTranslationContext
        ? findTranslationContextForKey(value, source, target)
        : [];

      missing.push({
        key,
        sourceLanguage: config.sourceLanguage,
        targetLanguage: config.targetLanguage,
        sourceValue: value,
        contexts: [], // Will be filled by context-finder
        translationContexts,
      });
    }
  }

  return missing;
}

/**
 * Find missing translations between source and target languages
 * Uses configuration from config store
 * @returns Analysis result with missing translations
 */
export async function findMissingTranslations(): Promise<AnalysisResult> {
  const config = configStore.getState();
  const analysis = analysisStore.getState();

  // Get parser
  const parser = getParser(config.parser);
  if (!parser) {
    throw new Error(`Unknown parser: ${config.parser}`);
  }

  // Task 1: Parse source language
  analysis.startTask('find_source_keys');
  analysis.setStatus('parsing_source');
  const sourcePath = join(config.repoPath, config.translationsDir, config.sourceLanguage);
  const sourceKeys = await parser.parse(sourcePath);
  analysis.completeTask('find_source_keys');

  // Task 2: Parse target language
  analysis.startTask('find_target_keys');
  analysis.setStatus('parsing_target');
  const targetPath = join(config.repoPath, config.translationsDir, config.targetLanguage);
  const targetKeys = await parser.parse(targetPath);
  analysis.completeTask('find_target_keys');

  // Task 3: Compare and find missing
  analysis.startTask('find_missing');
  analysis.setStatus('comparing');
  const missing = compareTranslationSets(sourceKeys, targetKeys);
  analysis.completeTask('find_missing');

  // Update counts
  analysis.setCounts(sourceKeys.size, targetKeys.size, missing.length);

  return {
    sourceKeyCount: sourceKeys.size,
    targetKeyCount: targetKeys.size,
    missing,
  };
}
