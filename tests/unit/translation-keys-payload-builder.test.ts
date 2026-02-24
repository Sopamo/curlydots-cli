import { describe, expect, it } from 'bun:test';
import { buildTranslationKeyPayloads } from '../../src/services/translation-keys/payload-builder';

describe('translation-keys payload-builder', () => {
  it('keeps only the first payload for duplicate translation keys', () => {
    const payloads = buildTranslationKeyPayloads(
      [
        { key: 'common.save', sourceValue: 'Save', contexts: [] },
        { key: 'common.cancel', sourceValue: 'Cancel', contexts: [] },
        { key: 'common.save', sourceValue: 'Save now', contexts: [] },
      ],
      'en',
    );

    expect(payloads).toEqual([
      {
        translationKey: 'common.save',
        sourceValue: 'Save',
        sourceLanguage: 'en',
        codeContext: [],
      },
      {
        translationKey: 'common.cancel',
        sourceValue: 'Cancel',
        sourceLanguage: 'en',
        codeContext: [],
      },
    ]);
  });
});
