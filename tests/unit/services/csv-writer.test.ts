import { afterEach, describe, expect, it } from 'bun:test';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { toCsvRow, writeCsv } from '../../../src/services/csv-writer';
import type { MissingTranslation } from '../../../src/types';

const TEST_OUTPUT_PATH = join(import.meta.dir, '../../fixtures/test-output.csv');

describe('csv-writer', () => {
  afterEach(() => {
    // Clean up test output file
    if (existsSync(TEST_OUTPUT_PATH)) {
      unlinkSync(TEST_OUTPUT_PATH);
    }
  });

  describe('toCsvRow', () => {
    it('should convert a missing translation to CSV row object', () => {
      const missing: MissingTranslation = {
        key: 'test.key',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        sourceValue: 'Test Value',
        contexts: [],
        translationContexts: [],
      };

      const row = toCsvRow(missing);

      expect(row.translation_key).toBe('test.key');
      expect(row.source_value).toBe('Test Value');
      expect(row.source_language).toBe('en');
      expect(row.target_language).toBe('de');
      expect(row.code_context).toBe('[]');
      expect(row.translation_context).toBe('[]');
    });

    it('should include contexts as JSON strings', () => {
      const missing: MissingTranslation = {
        key: 'test.key',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        sourceValue: 'Test Value',
        contexts: [
          {
            filePath: '/path/to/file.ts',
            lineNumber: 10,
            snippet: 'const x = t("test.key");',
            snippetStartLine: 5,
            snippetEndLine: 15,
          },
        ],
        translationContexts: [
          {
            noun: 'value',
            sourceKey: 'other.key',
            sourceValue: 'Other Value',
            targetValue: 'Anderer Wert',
          },
        ],
      };

      const row = toCsvRow(missing);

      expect(row.code_context).toContain('filePath');
      expect(row.code_context).toContain('lineNumber');
      expect(row.translation_context).toContain('noun');
      expect(row.translation_context).toContain('Anderer Wert');
    });
  });

  describe('writeCsv', () => {
    it('should write CSV file with header', async () => {
      const missing: MissingTranslation[] = [
        {
          key: 'test.key',
          sourceLanguage: 'en',
          targetLanguage: 'de',
          sourceValue: 'Test',
          contexts: [],
          translationContexts: [],
        },
      ];

      await writeCsv(missing, TEST_OUTPUT_PATH);

      expect(existsSync(TEST_OUTPUT_PATH)).toBe(true);

      const content = await Bun.file(TEST_OUTPUT_PATH).text();
      expect(content).toContain('translation_key');
      expect(content).toContain('source_value');
      expect(content).toContain('source_language');
      expect(content).toContain('target_language');
      expect(content).toContain('code_context');
      expect(content).toContain('translation_context');
    });

    it('should write multiple rows', async () => {
      const missing: MissingTranslation[] = [
        {
          key: 'key1',
          sourceLanguage: 'en',
          targetLanguage: 'de',
          sourceValue: 'Value 1',
          contexts: [],
          translationContexts: [],
        },
        {
          key: 'key2',
          sourceLanguage: 'en',
          targetLanguage: 'de',
          sourceValue: 'Value 2',
          contexts: [],
          translationContexts: [],
        },
      ];

      await writeCsv(missing, TEST_OUTPUT_PATH);

      const content = await Bun.file(TEST_OUTPUT_PATH).text();
      const lines = content.trim().split('\n');

      // Header + 2 data rows
      expect(lines.length).toBe(3);
    });

    it('should handle empty missing array', async () => {
      await writeCsv([], TEST_OUTPUT_PATH);

      expect(existsSync(TEST_OUTPUT_PATH)).toBe(true);

      const content = await Bun.file(TEST_OUTPUT_PATH).text();
      const lines = content.trim().split('\n');

      // Just header
      expect(lines.length).toBe(1);
    });
  });
});
