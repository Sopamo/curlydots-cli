import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvContent, readCsv, validateHeaders } from '../../../src/services/csv-reader';

const TEST_FIXTURES_DIR = join(import.meta.dir, '../../fixtures');
const TEST_CSV_PATH = join(TEST_FIXTURES_DIR, 'test-translation-input.csv');

describe('csv-reader', () => {
  beforeEach(() => {
    if (!existsSync(TEST_FIXTURES_DIR)) {
      mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_CSV_PATH)) {
      unlinkSync(TEST_CSV_PATH);
    }
  });

  describe('validateHeaders', () => {
    it('should return empty array when all required headers present', () => {
      const headers = [
        'translation_key',
        'source_value',
        'source_language',
        'target_language',
        'code_context',
        'translation_context',
      ];

      const missing = validateHeaders(headers);
      expect(missing).toEqual([]);
    });

    it('should return missing headers when some are absent', () => {
      const headers = ['translation_key', 'source_value'];

      const missing = validateHeaders(headers);
      expect(missing).toContain('source_language');
      expect(missing).toContain('target_language');
      expect(missing).toContain('code_context');
      expect(missing).toContain('translation_context');
    });

    it('should handle extra headers gracefully', () => {
      const headers = [
        'translation_key',
        'source_value',
        'source_language',
        'target_language',
        'code_context',
        'translation_context',
        'extra_column',
        'translated_value',
      ];

      const missing = validateHeaders(headers);
      expect(missing).toEqual([]);
    });
  });

  describe('parseCsvContent', () => {
    it('should parse valid CSV content into TranslationRows', async () => {
      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context
users.show_all,Show all users,en,de,"[]","[]"`;

      const rows = await parseCsvContent(content);

      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.translationKey).toBe('users.show_all');
      expect(row?.sourceValue).toBe('Show all users');
      expect(row?.sourceLanguage).toBe('en');
      expect(row?.targetLanguage).toBe('de');
      expect(row?.status).toBe('pending');
    });

    it('should preserve row index for ordering', async () => {
      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context
key1,Value 1,en,de,"[]","[]"
key2,Value 2,en,de,"[]","[]"
key3,Value 3,en,de,"[]","[]"`;

      const rows = await parseCsvContent(content);

      expect(rows[0]?.index).toBe(0);
      expect(rows[1]?.index).toBe(1);
      expect(rows[2]?.index).toBe(2);
    });

    it('should mark rows with existing translated_value as skipped', async () => {
      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
key1,Value 1,en,de,"[]","[]","Wert 1"
key2,Value 2,en,de,"[]","[]",""`;

      const rows = await parseCsvContent(content);

      expect(rows[0]?.status).toBe('skipped');
      expect(rows[0]?.translatedValue).toBe('Wert 1');
      expect(rows[1]?.status).toBe('pending');
      expect(rows[1]?.translatedValue).toBe('');
    });

    it('should mark ERROR rows as pending for retry', async () => {
      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
key1,Value 1,en,de,"[]","[]","ERROR"`;

      const rows = await parseCsvContent(content);

      expect(rows[0]?.status).toBe('pending');
      expect(rows[0]?.translatedValue).toBe('');
    });

    it('should handle JSON context columns', async () => {
      const codeContext = JSON.stringify([
        { filePath: '/test.ts', lineNumber: 10, snippet: 'code' },
      ]);
      const translationContext = JSON.stringify([
        { noun: 'user', sourceKey: 'k', sourceValue: 'v', targetValue: 't' },
      ]);

      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context
key1,Value,en,de,"${codeContext.replace(/"/g, '""')}","${translationContext.replace(/"/g, '""')}"`;

      const rows = await parseCsvContent(content);

      expect(rows[0]?.codeContext).toContain('filePath');
      expect(rows[0]?.translationContext).toContain('noun');
    });

    it('should reject CSV with missing required headers', async () => {
      const content = `translation_key,source_value
key1,Value 1`;

      await expect(parseCsvContent(content)).rejects.toThrow('Missing required CSV columns');
    });
  });

  describe('readCsv', () => {
    it('should read and parse CSV file', async () => {
      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context
key1,Value 1,en,de,"[]","[]"`;

      await Bun.write(TEST_CSV_PATH, content);

      const rows = await readCsv(TEST_CSV_PATH);

      expect(rows).toHaveLength(1);
      expect(rows[0]?.translationKey).toBe('key1');
    });

    it('should throw error for non-existent file', async () => {
      await expect(readCsv('/nonexistent/file.csv')).rejects.toThrow('not found');
    });

    it('should throw error for empty file', async () => {
      await Bun.write(TEST_CSV_PATH, '');

      await expect(readCsv(TEST_CSV_PATH)).rejects.toThrow('empty');
    });

    it('should handle special characters in values', async () => {
      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context
key1,"Value with ""quotes"" and, commas",en,de,"[]","[]"`;

      await Bun.write(TEST_CSV_PATH, content);

      const rows = await readCsv(TEST_CSV_PATH);

      expect(rows[0]?.sourceValue).toBe('Value with "quotes" and, commas');
    });

    it('should handle newlines within quoted fields', async () => {
      const content = `translation_key,source_value,source_language,target_language,code_context,translation_context
key1,"Line 1
Line 2",en,de,"[]","[]"`;

      await Bun.write(TEST_CSV_PATH, content);

      const rows = await readCsv(TEST_CSV_PATH);

      expect(rows[0]?.sourceValue).toContain('\n');
    });
  });
});
