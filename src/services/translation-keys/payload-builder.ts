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
  const seenKeys = new Set<string>();
  const payloads: TranslationKeyPayload[] = [];

  for (const entry of keys) {
    if (seenKeys.has(entry.key)) {
      continue;
    }

    seenKeys.add(entry.key);
    payloads.push({
      translationKey: entry.key,
      sourceValue: entry.sourceValue,
      sourceLanguage,
      codeContext: entry.contexts,
    });
  }

  return payloads;
}
