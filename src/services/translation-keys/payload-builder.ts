import type { UsageContext } from '../../types';
import type { TranslationKeyPayload } from '../../types/translation-keys';

export interface KeyWithContext {
  key: string;
  sourceValue: string;
  contexts: UsageContext[];
}

export function buildTranslationKeyPayloads(
  keys: KeyWithContext[],
  sourceLanguage: string,
): TranslationKeyPayload[] {
  return keys.map((entry) => ({
    translationKey: entry.key,
    sourceValue: entry.sourceValue,
    sourceLanguage,
    codeContext: entry.contexts,
  }));
}
