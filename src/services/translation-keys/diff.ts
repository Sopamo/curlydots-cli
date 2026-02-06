import type { TranslationKeyPayload } from '../../types/translation-keys';

export function filterNewTranslationKeys(
  payloads: TranslationKeyPayload[],
  existingKeys: string[],
): TranslationKeyPayload[] {
  const existing = new Set(existingKeys);
  return payloads.filter((payload) => !existing.has(payload.translationKey));
}
