/**
 * Translation Context Service
 *
 * Detects nouns in source values and finds translation examples using wink-nlp.
 */

import model from 'wink-eng-lite-web-model';
import winkNLP from 'wink-nlp';
import type { TranslationContextExample } from '../types';

// Initialize wink-nlp with English model (singleton)
const nlp = winkNLP(model);
const its = nlp.its;

/** Maximum number of translation context examples per key */
const MAX_EXAMPLES = 10;

/**
 * Extract nouns from a source translation value
 * @param text - Source translation value (e.g., "Show all users")
 * @returns Array of detected nouns in lowercase, deduplicated
 */
export function extractNouns(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const doc = nlp.readDoc(text);
  const nouns: string[] = [];

  // wink-nlp doesn't export token types; callback parameter is untyped in library
  // biome-ignore lint/suspicious/noExplicitAny: wink-nlp lacks type exports
  doc.tokens().each((token: any) => {
    const pos = token.out(its.pos);
    // Include common nouns (NOUN) and proper nouns (PROPN)
    if (pos === 'NOUN' || pos === 'PROPN') {
      const normalized = token.out(its.normal); // lowercase normalized form
      if (normalized && normalized.length > 0) {
        nouns.push(normalized);
      }
    }
  });

  // Deduplicate while preserving order
  return [...new Set(nouns)];
}

/**
 * Check if a source value contains a noun (case-insensitive, handles plural/singular)
 * @param sourceValue - The source translation value
 * @param noun - The noun to search for
 * @returns True if the noun is found in the source value
 */
function containsNoun(sourceValue: string, noun: string): boolean {
  const lowerSource = sourceValue.toLowerCase();
  const lowerNoun = noun.toLowerCase();

  // Direct match
  if (lowerSource.includes(lowerNoun)) {
    return true;
  }

  // Handle simple plural/singular (add/remove 's')
  if (lowerNoun.endsWith('s')) {
    const singular = lowerNoun.slice(0, -1);
    if (lowerSource.includes(singular)) {
      return true;
    }
  } else {
    const plural = `${lowerNoun}s`;
    if (lowerSource.includes(plural)) {
      return true;
    }
  }

  return false;
}

/**
 * Find translation examples for nouns in existing translations
 * @param nouns - Nouns to find examples for
 * @param sourceTranslations - All source language translations
 * @param targetTranslations - All target language translations (only keys with translations)
 * @param maxExamples - Maximum number of examples (default: 10)
 * @returns Array of translation context examples
 */
export function findTranslationExamples(
  nouns: string[],
  sourceTranslations: Map<string, string>,
  targetTranslations: Map<string, string>,
  maxExamples: number = MAX_EXAMPLES,
): TranslationContextExample[] {
  const examples: TranslationContextExample[] = [];
  const usedKeys = new Set<string>();

  if (nouns.length === 0) {
    return examples;
  }

  // Pass 1: One example per noun (prioritize diversity)
  for (const noun of nouns) {
    if (examples.length >= maxExamples) break;

    for (const [sourceKey, sourceValue] of sourceTranslations) {
      if (usedKeys.has(sourceKey)) continue;

      // Only include keys that have translations
      const targetValue = targetTranslations.get(sourceKey);
      if (!targetValue) continue;

      if (containsNoun(sourceValue, noun)) {
        examples.push({
          noun,
          sourceKey,
          sourceValue,
          targetValue,
        });
        usedKeys.add(sourceKey);
        break; // Move to next noun
      }
    }
  }

  // Pass 2: Additional examples for same nouns until maxExamples
  for (const noun of nouns) {
    if (examples.length >= maxExamples) break;

    for (const [sourceKey, sourceValue] of sourceTranslations) {
      if (examples.length >= maxExamples) break;
      if (usedKeys.has(sourceKey)) continue;

      const targetValue = targetTranslations.get(sourceKey);
      if (!targetValue) continue;

      if (containsNoun(sourceValue, noun)) {
        examples.push({
          noun,
          sourceKey,
          sourceValue,
          targetValue,
        });
        usedKeys.add(sourceKey);
      }
    }
  }

  return examples;
}

/**
 * Find translation context for a specific missing key based on its source value
 * @param sourceValue - The source language value of the missing key
 * @param sourceTranslations - All source language translations
 * @param targetTranslations - All target language translations
 * @param maxExamples - Maximum number of examples (default: 10)
 * @returns Array of translation context examples
 */
export function findTranslationContextForKey(
  sourceValue: string,
  sourceTranslations: Map<string, string>,
  targetTranslations: Map<string, string>,
  maxExamples: number = MAX_EXAMPLES,
): TranslationContextExample[] {
  const nouns = extractNouns(sourceValue);
  return findTranslationExamples(nouns, sourceTranslations, targetTranslations, maxExamples);
}
