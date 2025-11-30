import { describe, expect, it } from 'bun:test';
import { buildTranslationPrompt } from '../../../../src/services/openai/prompts';
import type { TranslationRequest } from '../../../../src/types';

describe('prompts', () => {
  describe('buildTranslationPrompt', () => {
    it('should build XML prompt with all context', () => {
      const request: TranslationRequest = {
        sourceValue: 'Show all users',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        codeUsages: [
          {
            filePath: '/src/components/UserList.vue',
            lineNumber: 42,
            snippet: '<button>{{ t("users.show_all") }}</button>',
          },
        ],
        translationExamples: [
          {
            noun: 'users',
            sourceKey: 'users.title',
            sourceValue: 'Users',
            targetValue: 'Benutzer:innen',
          },
        ],
      };

      const prompt = buildTranslationPrompt(request);

      // Should be valid XML
      expect(prompt).toContain('<translation_request>');
      expect(prompt).toContain('</translation_request>');

      // Should contain language info
      expect(prompt).toContain('<source_language>en</source_language>');
      expect(prompt).toContain('<target_language>de</target_language>');

      // Should contain text to translate
      expect(prompt).toContain('<text_to_translate>Show all users</text_to_translate>');

      // Should contain code context
      expect(prompt).toContain('<code_context>');
      expect(prompt).toContain('UserList.vue');
      expect(prompt).toContain('line="42"');
      expect(prompt).toContain('t("users.show_all")');

      // Should contain translation context
      expect(prompt).toContain('<translation_context>');
      expect(prompt).toContain('noun="users"');
      expect(prompt).toContain('Benutzer:innen');
    });

    it('should handle empty code usages', () => {
      const request: TranslationRequest = {
        sourceValue: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        codeUsages: [],
        translationExamples: [],
      };

      const prompt = buildTranslationPrompt(request);

      expect(prompt).toContain('<code_context>');
      expect(prompt).toContain('<none>');
      expect(prompt).toContain('</code_context>');
    });

    it('should handle empty translation examples', () => {
      const request: TranslationRequest = {
        sourceValue: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        codeUsages: [],
        translationExamples: [],
      };

      const prompt = buildTranslationPrompt(request);

      expect(prompt).toContain('<translation_context>');
      expect(prompt).toContain('<none>');
      expect(prompt).toContain('</translation_context>');
    });

    it('should escape special XML characters in content', () => {
      const request: TranslationRequest = {
        sourceValue: 'Price: <$100 & "free"',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        codeUsages: [
          {
            filePath: '/src/test.ts',
            lineNumber: 1,
            snippet: 'const msg = "<div>&test</div>";',
          },
        ],
        translationExamples: [],
      };

      const prompt = buildTranslationPrompt(request);

      // Source value should be escaped or in CDATA
      expect(prompt).toContain('Price:');
      // Snippet should be in CDATA to preserve code
      expect(prompt).toContain('<![CDATA[');
    });

    it('should include translation instructions', () => {
      const request: TranslationRequest = {
        sourceValue: 'Submit',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        codeUsages: [],
        translationExamples: [],
      };

      const prompt = buildTranslationPrompt(request);

      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('professional translator');
      expect(prompt).toContain('translated_value');
    });

    it('should handle multiple code usages', () => {
      const request: TranslationRequest = {
        sourceValue: 'Save',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        codeUsages: [
          { filePath: '/src/a.ts', lineNumber: 10, snippet: 'save()' },
          { filePath: '/src/b.ts', lineNumber: 20, snippet: 'onSave()' },
          { filePath: '/src/c.ts', lineNumber: 30, snippet: 'handleSave()' },
        ],
        translationExamples: [],
      };

      const prompt = buildTranslationPrompt(request);

      expect(prompt).toContain('file="/src/a.ts"');
      expect(prompt).toContain('file="/src/b.ts"');
      expect(prompt).toContain('file="/src/c.ts"');
    });

    it('should handle multiple translation examples', () => {
      const request: TranslationRequest = {
        sourceValue: 'New user settings',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        codeUsages: [],
        translationExamples: [
          { noun: 'user', sourceKey: 'k1', sourceValue: 'User', targetValue: 'Benutzer' },
          {
            noun: 'settings',
            sourceKey: 'k2',
            sourceValue: 'Settings',
            targetValue: 'Einstellungen',
          },
        ],
      };

      const prompt = buildTranslationPrompt(request);

      expect(prompt).toContain('noun="user"');
      expect(prompt).toContain('noun="settings"');
      expect(prompt).toContain('Benutzer');
      expect(prompt).toContain('Einstellungen');
    });
  });
});
