import type { UsageContext } from './index';

export interface TranslationKeyPayload {
  translationKey: string;
  sourceValue: string;
  sourceLanguage: string;
  codeContext: UsageContext[];
}

export interface ExistingKeysResponse {
  data: {
    keys: string[];
  };
}
