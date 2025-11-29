import { beforeEach, describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { clearParsers, registerParser } from '../../../src/parsers';
import { nodeModuleParser } from '../../../src/parsers/node-module';
import { compareTranslationSets, findMissingTranslations } from '../../../src/services/analyzer';
import { configStore } from '../../../src/stores';
import type { MissingTranslation } from '../../../src/types';

const FIXTURES_PATH = join(import.meta.dir, '../../fixtures/sample-repo');

describe('analyzer', () => {
  beforeEach(() => {
    clearParsers();
    registerParser(nodeModuleParser);
    configStore.getState().reset();
  });

  describe('compareTranslationSets', () => {
    it('should find missing keys', () => {
      const source = new Map([
        ['key1', 'Value 1'],
        ['key2', 'Value 2'],
        ['key3', 'Value 3'],
      ]);
      const target = new Map([
        ['key1', 'Wert 1'],
        ['key3', 'Wert 3'],
      ]);

      const missing = compareTranslationSets(source, target);

      expect(missing.length).toBe(1);
      expect(missing[0]?.key).toBe('key2');
      expect(missing[0]?.sourceValue).toBe('Value 2');
    });

    it('should return empty array when no missing keys', () => {
      const source = new Map([
        ['key1', 'Value 1'],
        ['key2', 'Value 2'],
      ]);
      const target = new Map([
        ['key1', 'Wert 1'],
        ['key2', 'Wert 2'],
      ]);

      const missing = compareTranslationSets(source, target);

      expect(missing.length).toBe(0);
    });

    it('should find all missing keys when target is empty', () => {
      const source = new Map([
        ['key1', 'Value 1'],
        ['key2', 'Value 2'],
      ]);
      const target = new Map<string, string>();

      const missing = compareTranslationSets(source, target);

      expect(missing.length).toBe(2);
    });
  });

  describe('findMissingTranslations', () => {
    it('should find missing translations between en and de', async () => {
      configStore.getState().setConfig({
        repoPath: FIXTURES_PATH,
        translationsDir: 'translations',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        parser: 'node-module',
      });

      const result = await findMissingTranslations();

      // Should find: welcome, settings.notifications, errors.serverError
      expect(result.missing.length).toBe(3);

      const missingKeys = result.missing.map((m: MissingTranslation) => m.key);
      expect(missingKeys).toContain('generic.welcome');
      expect(missingKeys).toContain('generic.settings.notifications');
      expect(missingKeys).toContain('generic.errors.serverError');
    });

    it('should return source and target key counts', async () => {
      configStore.getState().setConfig({
        repoPath: FIXTURES_PATH,
        translationsDir: 'translations',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        parser: 'node-module',
      });

      const result = await findMissingTranslations();

      expect(result.sourceKeyCount).toBe(8);
      expect(result.targetKeyCount).toBe(5);
    });

    it('should throw error for unknown parser', async () => {
      configStore.getState().setConfig({
        repoPath: FIXTURES_PATH,
        translationsDir: 'translations',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        parser: 'unknown-parser',
      });

      await expect(findMissingTranslations()).rejects.toThrow('Unknown parser');
    });

    it('should include source value in missing translations', async () => {
      configStore.getState().setConfig({
        repoPath: FIXTURES_PATH,
        translationsDir: 'translations',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        parser: 'node-module',
      });

      const result = await findMissingTranslations();

      const welcomeMissing = result.missing.find((m) => m.key === 'generic.welcome');
      expect(welcomeMissing?.sourceValue).toBe('Welcome');
    });
  });
});
