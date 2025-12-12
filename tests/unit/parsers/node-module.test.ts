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

  describe('export', () => {
    it('should export English translations', async () => {
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await nodeModuleParser.export(langDir);

      expect(keys.get('generic.back')).toBe('Back');
      expect(keys.get('generic.save')).toBe('Save');
      expect(keys.get('generic.cancel')).toBe('Cancel');
      expect(keys.get('generic.welcome')).toBe('Welcome');
    });

    it('should flatten nested objects with dot notation', async () => {
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await nodeModuleParser.export(langDir);

      expect(keys.get('generic.settings.title')).toBe('Settings');
      expect(keys.get('generic.settings.notifications')).toBe('Notifications');
      expect(keys.get('generic.errors.notFound')).toBe('Not found');
      expect(keys.get('generic.errors.serverError')).toBe('Server error');
    });

    it('should export German translations', async () => {
      const langDir = join(FIXTURES_PATH, 'de');
      const keys = await nodeModuleParser.export(langDir);

      expect(keys.get('generic.back')).toBe('Zurück');
      expect(keys.get('generic.save')).toBe('Speichern');
      expect(keys.get('generic.cancel')).toBe('Abbrechen');
    });

    it('should return Map with correct size for English', async () => {
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await nodeModuleParser.export(langDir);

      // 4 top-level + 2 settings + 2 errors = 8 keys
      expect(keys.size).toBe(8);
    });

    it('should return Map with correct size for German (missing keys)', async () => {
      const langDir = join(FIXTURES_PATH, 'de');
      const keys = await nodeModuleParser.export(langDir);

      // 3 top-level + 1 settings + 1 errors = 5 keys (3 missing)
      expect(keys.size).toBe(5);
    });

    it('should throw error for non-existent directory', async () => {
      const langDir = join(FIXTURES_PATH, 'nonexistent');

      await expect(nodeModuleParser.export(langDir)).rejects.toThrow();
    });
  });

  describe('import', () => {
    const TEMP_PATH = join(import.meta.dir, '../../fixtures/temp-import');

    beforeEach(async () => {
      // Clean up temp directory before each test
      const { rm, mkdir } = await import('node:fs/promises');
      try {
        await rm(TEMP_PATH, { recursive: true, force: true });
      } catch {
        // Ignore if doesn't exist
      }
      await mkdir(TEMP_PATH, { recursive: true });
    });

    it('should create new file with translations', async () => {
      const langDir = join(TEMP_PATH, 'de');
      const translations = new Map([
        ['generic.welcome', 'Willkommen'],
        ['generic.goodbye', 'Auf Wiedersehen'],
      ]);

      const result = await nodeModuleParser.import(langDir, translations);

      expect(result.filesCreated).toBe(1);
      expect(result.filesModified).toBe(0);
      expect(result.keysWritten).toBe(2);

      // Verify file was created and can be read back
      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('generic.welcome')).toBe('Willkommen');
      expect(exported.get('generic.goodbye')).toBe('Auf Wiedersehen');
    });

    it('should create nested key structure', async () => {
      const langDir = join(TEMP_PATH, 'de');
      const translations = new Map([
        ['auth.login.button', 'Anmelden'],
        ['auth.login.title', 'Einloggen'],
        ['auth.logout', 'Ausloggen'],
      ]);

      await nodeModuleParser.import(langDir, translations);

      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('auth.login.button')).toBe('Anmelden');
      expect(exported.get('auth.login.title')).toBe('Einloggen');
      expect(exported.get('auth.logout')).toBe('Ausloggen');
    });

    it('should merge with existing file content', async () => {
      const langDir = join(TEMP_PATH, 'de');

      // First import
      const initial = new Map([
        ['generic.hello', 'Hallo'],
        ['generic.world', 'Welt'],
      ]);
      await nodeModuleParser.import(langDir, initial);

      // Second import with new key
      const updates = new Map([['generic.goodbye', 'Tschüss']]);
      const result = await nodeModuleParser.import(langDir, updates);

      expect(result.filesModified).toBe(1);
      expect(result.filesCreated).toBe(0);

      // Verify all keys present
      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Hallo');
      expect(exported.get('generic.world')).toBe('Welt');
      expect(exported.get('generic.goodbye')).toBe('Tschüss');
    });

    it('should update existing keys', async () => {
      const langDir = join(TEMP_PATH, 'de');

      // First import
      const initial = new Map([['generic.hello', 'Hallo']]);
      await nodeModuleParser.import(langDir, initial);

      // Update same key
      const updates = new Map([['generic.hello', 'Guten Tag']]);
      await nodeModuleParser.import(langDir, updates);

      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Guten Tag');
    });

    it('should create multiple files for different prefixes', async () => {
      const langDir = join(TEMP_PATH, 'de');
      const translations = new Map([
        ['generic.welcome', 'Willkommen'],
        ['auth.login', 'Anmelden'],
        ['errors.notFound', 'Nicht gefunden'],
      ]);

      const result = await nodeModuleParser.import(langDir, translations);

      expect(result.filesCreated).toBe(3);
      expect(result.keysWritten).toBe(3);

      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('generic.welcome')).toBe('Willkommen');
      expect(exported.get('auth.login')).toBe('Anmelden');
      expect(exported.get('errors.notFound')).toBe('Nicht gefunden');
    });

    it('should create language directory if it does not exist', async () => {
      const langDir = join(TEMP_PATH, 'fr', 'nested');
      const translations = new Map([['generic.hello', 'Bonjour']]);

      const result = await nodeModuleParser.import(langDir, translations);

      expect(result.filesCreated).toBe(1);
      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Bonjour');
    });

    it('should handle empty translations map', async () => {
      const langDir = join(TEMP_PATH, 'de');
      const translations = new Map<string, string>();

      const result = await nodeModuleParser.import(langDir, translations);

      expect(result.filesCreated).toBe(0);
      expect(result.filesModified).toBe(0);
      expect(result.keysWritten).toBe(0);
    });

    it('should skip keys without file prefix and log warning', async () => {
      const langDir = join(TEMP_PATH, 'de');
      const translations = new Map([
        ['generic.hello', 'Hallo'], // valid
        ['invalidkey', 'Invalid'], // no dot - should be skipped
      ]);

      const result = await nodeModuleParser.import(langDir, translations);

      // Only the valid key should be written
      expect(result.keysWritten).toBe(1);

      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Hallo');
      expect(exported.has('invalidkey')).toBe(false);
    });

    it('should handle deeply nested keys', async () => {
      const langDir = join(TEMP_PATH, 'de');
      const translations = new Map([
        ['settings.account.profile.name', 'Name'],
        ['settings.account.profile.email', 'E-Mail'],
        ['settings.account.security.password', 'Passwort'],
      ]);

      await nodeModuleParser.import(langDir, translations);

      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('settings.account.profile.name')).toBe('Name');
      expect(exported.get('settings.account.profile.email')).toBe('E-Mail');
      expect(exported.get('settings.account.security.password')).toBe('Passwort');
    });

    it('should handle special characters in values', async () => {
      const langDir = join(TEMP_PATH, 'de');
      const translations = new Map([
        ['generic.quote', "It's a test"],
        ['generic.html', '<span>HTML</span>'],
        ['generic.unicode', '日本語テスト'],
      ]);

      await nodeModuleParser.import(langDir, translations);

      const exported = await nodeModuleParser.export(langDir);
      expect(exported.get('generic.quote')).toBe("It's a test");
      expect(exported.get('generic.html')).toBe('<span>HTML</span>');
      expect(exported.get('generic.unicode')).toBe('日本語テスト');
    });
  });
});
