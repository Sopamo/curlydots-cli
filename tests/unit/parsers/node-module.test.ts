import { beforeEach, describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { clearParsers, getParser, registerParser } from '../../../src/parsers';
import { nodeModuleParser } from '../../../src/parsers/node-module';

const FIXTURES_PATH = join(import.meta.dir, '../../fixtures/sample-repo/translations');

describe('nodeModuleParser', () => {
  beforeEach(() => {
    clearParsers();
  });

  describe('parser registration', () => {
    it('should have name "node-module"', () => {
      expect(nodeModuleParser.name).toBe('node-module');
    });

    it('should be registerable', () => {
      registerParser(nodeModuleParser);
      expect(getParser('node-module')).toBe(nodeModuleParser);
    });
  });

  describe('parse', () => {
    it('should parse English translations', async () => {
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await nodeModuleParser.parse(langDir);

      expect(keys.get('generic.back')).toBe('Back');
      expect(keys.get('generic.save')).toBe('Save');
      expect(keys.get('generic.cancel')).toBe('Cancel');
      expect(keys.get('generic.welcome')).toBe('Welcome');
    });

    it('should flatten nested objects with dot notation', async () => {
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await nodeModuleParser.parse(langDir);

      expect(keys.get('generic.settings.title')).toBe('Settings');
      expect(keys.get('generic.settings.notifications')).toBe('Notifications');
      expect(keys.get('generic.errors.notFound')).toBe('Not found');
      expect(keys.get('generic.errors.serverError')).toBe('Server error');
    });

    it('should parse German translations', async () => {
      const langDir = join(FIXTURES_PATH, 'de');
      const keys = await nodeModuleParser.parse(langDir);

      expect(keys.get('generic.back')).toBe('Zurück');
      expect(keys.get('generic.save')).toBe('Speichern');
      expect(keys.get('generic.cancel')).toBe('Abbrechen');
    });

    it('should return Map with correct size for English', async () => {
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await nodeModuleParser.parse(langDir);

      // 4 top-level + 2 settings + 2 errors = 8 keys
      expect(keys.size).toBe(8);
    });

    it('should return Map with correct size for German (missing keys)', async () => {
      const langDir = join(FIXTURES_PATH, 'de');
      const keys = await nodeModuleParser.parse(langDir);

      // 3 top-level + 1 settings + 1 errors = 5 keys (3 missing)
      expect(keys.size).toBe(5);
    });

    it('should throw error for non-existent directory', async () => {
      const langDir = join(FIXTURES_PATH, 'nonexistent');

      await expect(nodeModuleParser.parse(langDir)).rejects.toThrow();
    });
  });
});
