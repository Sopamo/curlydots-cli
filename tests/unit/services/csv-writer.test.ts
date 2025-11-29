import { afterEach, describe, expect, it } from 'bun:test';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { escapeCsvField, formatCsvRow, writeCsv } from '../../../src/services/csv-writer';
import type { MissingTranslation } from '../../../src/types';

const TEST_OUTPUT_PATH = join(import.meta.dir, '../../fixtures/test-output.csv');

describe('csv-writer', () => {
  afterEach(() => {
    // Clean up test output file
    if (existsSync(TEST_OUTPUT_PATH)) {
      unlinkSync(TEST_OUTPUT_PATH);
    }
  });

  describe('escapeCsvField', () => {
    it('should return simple string unchanged', () => {
      expect(escapeCsvField('hello')).toBe('hello');
    });

    it('should wrap string with comma in quotes', () => {
      expect(escapeCsvField('hello, world')).toBe('"hello, world"');
    });

    it('should wrap string with quotes and escape inner quotes', () => {
      expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
    });

    it('should wrap string with newline in quotes', () => {
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('should handle complex content', () => {
      const input = 'function test() {\n  return "value";\n}';
      const result = escapeCsvField(input);
      expect(result.startsWith('"')).toBe(true);
      expect(result.endsWith('"')).toBe(true);
    });
  });

  describe('formatCsvRow', () => {
    it('should format a missing translation to CSV row', () => {
      const missing: MissingTranslation = {
        key: 'test.key',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        sourceValue: 'Test Value',
        contexts: [],
        translationContexts: [],
      };

      const row = formatCsvRow(missing);

      expect(row).toContain('test.key');
      expect(row).toContain('Test Value');
      expect(row).toContain('en');
      expect(row).toContain('de');
    });

    it('should include contexts as JSON', () => {
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

      const row = formatCsvRow(missing);

      expect(row).toContain('filePath');
      expect(row).toContain('lineNumber');
      expect(row).toContain('noun');
      expect(row).toContain('Anderer Wert');
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
