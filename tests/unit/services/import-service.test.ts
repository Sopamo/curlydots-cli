/**
 * Import Service Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { nodeModuleParser } from '../../../src/parsers/node-module';
// Import will be created
import { runImport } from '../../../src/services/import-service';

const TEMP_PATH = join(import.meta.dir, '../../fixtures/temp-import-service');

describe('import-service', () => {
  beforeEach(async () => {
    // Clean up and create temp directory
    try {
      await rm(TEMP_PATH, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(TEMP_PATH, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(TEMP_PATH, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('runImport', () => {
    it('should import translations from CSV to translation files', async () => {
      // Create a CSV file with translations
      const csvPath = join(TEMP_PATH, 'translations.csv');
      const translationsDir = join(TEMP_PATH, 'translations');
      const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.welcome,Welcome,en,de,[],[],"Willkommen"
generic.goodbye,Goodbye,en,de,[],[],"Auf Wiedersehen"`;

      await writeFile(csvPath, csvContent, 'utf-8');

      const result = await runImport(csvPath, translationsDir, nodeModuleParser);

      expect(result.filesCreated).toBe(1);
      expect(result.keysImported).toBe(2);
      expect(result.rowsSkipped).toBe(0);
      expect(result.errors.length).toBe(0);

      // Verify translations were written
      const exported = await nodeModuleParser.export(join(translationsDir, 'de'));
      expect(exported.get('generic.welcome')).toBe('Willkommen');
      expect(exported.get('generic.goodbye')).toBe('Auf Wiedersehen');
    });

    it('should skip rows with empty translated_value', async () => {
      const csvPath = join(TEMP_PATH, 'translations.csv');
      const translationsDir = join(TEMP_PATH, 'translations');
      const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.hello,Hello,en,de,[],[],"Hallo"
generic.world,World,en,de,[],[],""
generic.test,Test,en,de,[],[],`;

      await writeFile(csvPath, csvContent, 'utf-8');

      const result = await runImport(csvPath, translationsDir, nodeModuleParser);

      expect(result.keysImported).toBe(1);
      expect(result.rowsSkipped).toBe(2);

      const exported = await nodeModuleParser.export(join(translationsDir, 'de'));
      expect(exported.get('generic.hello')).toBe('Hallo');
      expect(exported.has('generic.world')).toBe(false);
    });

    it('should extract target language from CSV rows', async () => {
      const csvPath = join(TEMP_PATH, 'translations.csv');
      const translationsDir = join(TEMP_PATH, 'translations');
      const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.hello,Hello,en,fr,[],[],"Bonjour"`;

      await writeFile(csvPath, csvContent, 'utf-8');

      const result = await runImport(csvPath, translationsDir, nodeModuleParser);

      expect(result.targetLanguage).toBe('fr');

      // Verify written to correct language directory
      const exported = await nodeModuleParser.export(join(translationsDir, 'fr'));
      expect(exported.get('generic.hello')).toBe('Bonjour');
    });

    it('should handle multiple files (different key prefixes)', async () => {
      const csvPath = join(TEMP_PATH, 'translations.csv');
      const translationsDir = join(TEMP_PATH, 'translations');
      const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.hello,Hello,en,de,[],[],"Hallo"
auth.login,Login,en,de,[],[],"Anmelden"
errors.notFound,Not Found,en,de,[],[],"Nicht gefunden"`;

      await writeFile(csvPath, csvContent, 'utf-8');

      const result = await runImport(csvPath, translationsDir, nodeModuleParser);

      expect(result.filesCreated).toBe(3);
      expect(result.keysImported).toBe(3);

      const exported = await nodeModuleParser.export(join(translationsDir, 'de'));
      expect(exported.get('generic.hello')).toBe('Hallo');
      expect(exported.get('auth.login')).toBe('Anmelden');
      expect(exported.get('errors.notFound')).toBe('Nicht gefunden');
    });

    it('should throw error if CSV file does not exist', async () => {
      const csvPath = join(TEMP_PATH, 'nonexistent.csv');
      const translationsDir = join(TEMP_PATH, 'translations');

      await expect(runImport(csvPath, translationsDir, nodeModuleParser)).rejects.toThrow(
        'CSV file not found',
      );
    });

    it('should throw error if CSV has no rows with translations', async () => {
      const csvPath = join(TEMP_PATH, 'translations.csv');
      const translationsDir = join(TEMP_PATH, 'translations');
      const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.hello,Hello,en,de,[],[],""`;

      await writeFile(csvPath, csvContent, 'utf-8');

      await expect(runImport(csvPath, translationsDir, nodeModuleParser)).rejects.toThrow(
        'No valid translations found',
      );
    });

    it('should return summary with correct counts', async () => {
      const csvPath = join(TEMP_PATH, 'translations.csv');
      const translationsDir = join(TEMP_PATH, 'translations');
      const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.a,A,en,de,[],[],"A-de"
generic.b,B,en,de,[],[],"B-de"
generic.c,C,en,de,[],[],""
auth.login,Login,en,de,[],[],"Anmelden"`;

      await writeFile(csvPath, csvContent, 'utf-8');

      const result = await runImport(csvPath, translationsDir, nodeModuleParser);

      expect(result.filesCreated).toBe(2);
      expect(result.filesModified).toBe(0);
      expect(result.keysImported).toBe(3);
      expect(result.rowsSkipped).toBe(1);
      expect(result.targetLanguage).toBe('de');
    });
  });
});
