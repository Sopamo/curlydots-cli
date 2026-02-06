import { describe, expect, it } from 'bun:test';
import { filterNewTranslationKeys } from '../../src/services/translation-keys/diff';
import type { TranslationKeyPayload } from '../../src/types/translation-keys';

describe('translation-keys diff', () => {
  it('filters payloads that already exist on the backend', () => {
    const payloads: TranslationKeyPayload[] = [
      { translationKey: 'a', sourceValue: 'A', sourceLanguage: 'en', codeContext: [] },
      { translationKey: 'b', sourceValue: 'B', sourceLanguage: 'en', codeContext: [] },
      { translationKey: 'c', sourceValue: 'C', sourceLanguage: 'en', codeContext: [] },
    ];

    const result = filterNewTranslationKeys(payloads, ['b', 'c']);

    expect(result).toEqual([
      { translationKey: 'a', sourceValue: 'A', sourceLanguage: 'en', codeContext: [] },
    ]);
  });
});
