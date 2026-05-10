import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURES_PATH = join(import.meta.dir, '../../fixtures/sample-repo/translations');
let moduleNonce = 0;

async function loadParserModules() {
  moduleNonce += 1;
  const parsers = await import(`../../../src/parsers/index.ts?test=${moduleNonce}`);
  const commonjs = await import(`../../../src/parsers/commonjs.ts?test=${moduleNonce}`);
  return {
    clearParsers: parsers.clearParsers,
    getParser: parsers.getParser,
    registerParser: parsers.registerParser,
    commonjsParser: commonjs.commonjsParser,
  };
}

function initGitRepo(repoPath: string): void {
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
}

function addFileToGit(repoPath: string, filePath: string): void {
  execFileSync('git', ['add', filePath], { cwd: repoPath, stdio: 'ignore' });
}

describe('commonjsParser', () => {
  describe('parser registration', () => {
    it('should have name "commonjs"', async () => {
      const { commonjsParser } = await loadParserModules();
      expect(commonjsParser.name).toBe('commonjs');
    });

    it('should be registerable', async () => {
      const { clearParsers, getParser, commonjsParser, registerParser } =
        await loadParserModules();
      clearParsers();
      registerParser(commonjsParser);
      expect(getParser('commonjs')).toBe(commonjsParser);
    });
  });

  describe('export', () => {
    it('should export English translations', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await commonjsParser.export(langDir);

      expect(keys.get('generic.back')).toBe('Back');
      expect(keys.get('generic.save')).toBe('Save');
      expect(keys.get('generic.cancel')).toBe('Cancel');
      expect(keys.get('generic.welcome')).toBe('Welcome');
    });

    it('should flatten nested objects with dot notation', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await commonjsParser.export(langDir);

      expect(keys.get('generic.settings.title')).toBe('Settings');
      expect(keys.get('generic.settings.notifications')).toBe('Notifications');
      expect(keys.get('generic.errors.notFound')).toBe('Not found');
      expect(keys.get('generic.errors.serverError')).toBe('Server error');
    });

    it('should keep same leaf keys from different files as different translation keys', async () => {
      const { commonjsParser } = await loadParserModules();
      const tempDir = await mkdtemp(join(tmpdir(), 'commonjs-same-leaf-'));

      try {
        const langDir = join(tempDir, 'translations', 'en');
        await mkdir(langDir, { recursive: true });
        await writeFile(join(langDir, 'users.js'), 'module.exports = { name: "Name" };\n', 'utf8');
        await writeFile(
          join(langDir, 'products.js'),
          'module.exports = { name: "Name" };\n',
          'utf8',
        );

        const keys = await commonjsParser.export(langDir);

        expect(keys.get('users.name')).toBe('Name');
        expect(keys.get('products.name')).toBe('Name');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should export German translations', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(FIXTURES_PATH, 'de');
      const keys = await commonjsParser.export(langDir);

      expect(keys.get('generic.back')).toBe('Zurück');
      expect(keys.get('generic.save')).toBe('Speichern');
      expect(keys.get('generic.cancel')).toBe('Abbrechen');
    });

    it('should return Map with correct size for English', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(FIXTURES_PATH, 'en');
      const keys = await commonjsParser.export(langDir);

      // 4 top-level + 2 settings + 2 errors = 8 keys
      expect(keys.size).toBe(8);
    });

    it('should return Map with correct size for German (missing keys)', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(FIXTURES_PATH, 'de');
      const keys = await commonjsParser.export(langDir);

      // 3 top-level + 1 settings + 1 errors = 5 keys (3 missing)
      expect(keys.size).toBe(5);
    });

    it('should throw error for non-existent directory', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(FIXTURES_PATH, 'nonexistent');

      await expect(commonjsParser.export(langDir)).rejects.toThrow();
    });

    it('should ignore translation files excluded by .gitignore', async () => {
      const { commonjsParser } = await loadParserModules();
      const tempDir = await mkdtemp(join(tmpdir(), 'commonjs-ignore-'));

      try {
        initGitRepo(tempDir);
        await mkdir(join(tempDir, 'translations', 'en'), { recursive: true });
        await writeFile(join(tempDir, '.gitignore'), 'translations/en/ignored.js\n', 'utf8');
        await writeFile(
          join(tempDir, 'translations', 'en', 'tracked.js'),
          'module.exports = { welcome: "Welcome" };\n',
          'utf8',
        );
        await writeFile(
          join(tempDir, 'translations', 'en', 'ignored.js'),
          'module.exports = { leaked: "Ignored" };\n',
          'utf8',
        );

        const keys = await commonjsParser.export(join(tempDir, 'translations', 'en'));

        expect(keys.get('tracked.welcome')).toBe('Welcome');
        expect(keys.has('ignored.leaked')).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should ignore tracked translation files that match .gitignore', async () => {
      const { commonjsParser } = await loadParserModules();
      const tempDir = await mkdtemp(join(tmpdir(), 'commonjs-tracked-ignore-'));

      try {
        initGitRepo(tempDir);
        await mkdir(join(tempDir, 'translations', 'en'), { recursive: true });
        await writeFile(
          join(tempDir, 'translations', 'en', 'tracked.js'),
          'module.exports = { leaked: "Tracked but ignored" };\n',
          'utf8',
        );
        await writeFile(
          join(tempDir, 'translations', 'en', 'visible.js'),
          'module.exports = { welcome: "Visible" };\n',
          'utf8',
        );
        addFileToGit(tempDir, 'translations/en/tracked.js');
        await writeFile(join(tempDir, '.gitignore'), 'translations/en/tracked.js\n', 'utf8');

        const keys = await commonjsParser.export(join(tempDir, 'translations', 'en'));

        expect(keys.get('visible.welcome')).toBe('Visible');
        expect(keys.has('tracked.leaked')).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('import', () => {
    let tempPath = '';

    beforeEach(async () => {
      tempPath = await mkdtemp(join(tmpdir(), 'commonjs-import-'));
    });

    afterEach(async () => {
      await rm(tempPath, { recursive: true, force: true });
    });

    it('should create new file with translations', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');
      const translations = new Map([
        ['generic.welcome', 'Willkommen'],
        ['generic.goodbye', 'Auf Wiedersehen'],
      ]);

      const result = await commonjsParser.import(langDir, translations);

      expect(result.filesCreated).toBe(1);
      expect(result.filesModified).toBe(0);
      expect(result.keysWritten).toBe(2);

      // Verify file was created and can be read back
      const exported = await commonjsParser.export(langDir);
      expect(exported.get('generic.welcome')).toBe('Willkommen');
      expect(exported.get('generic.goodbye')).toBe('Auf Wiedersehen');
    });

    it('should create nested key structure', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');
      const translations = new Map([
        ['auth.login.button', 'Anmelden'],
        ['auth.login.title', 'Einloggen'],
        ['auth.logout', 'Ausloggen'],
      ]);

      await commonjsParser.import(langDir, translations);

      const exported = await commonjsParser.export(langDir);
      expect(exported.get('auth.login.button')).toBe('Anmelden');
      expect(exported.get('auth.login.title')).toBe('Einloggen');
      expect(exported.get('auth.logout')).toBe('Ausloggen');
    });

    it('should merge with existing file content', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');

      // First import
      const initial = new Map([
        ['generic.hello', 'Hallo'],
        ['generic.world', 'Welt'],
      ]);
      await commonjsParser.import(langDir, initial);

      // Second import with new key
      const updates = new Map([['generic.goodbye', 'Tschüss']]);
      const result = await commonjsParser.import(langDir, updates);

      expect(result.filesModified).toBe(1);
      expect(result.filesCreated).toBe(0);

      // Verify all keys present
      const exported = await commonjsParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Hallo');
      expect(exported.get('generic.world')).toBe('Welt');
      expect(exported.get('generic.goodbye')).toBe('Tschüss');
    });

    it('should update existing keys', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');

      // First import
      const initial = new Map([['generic.hello', 'Hallo']]);
      await commonjsParser.import(langDir, initial);

      // Update same key
      const updates = new Map([['generic.hello', 'Guten Tag']]);
      await commonjsParser.import(langDir, updates);

      const exported = await commonjsParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Guten Tag');
    });

    it('should create multiple files for different prefixes', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');
      const translations = new Map([
        ['generic.welcome', 'Willkommen'],
        ['auth.login', 'Anmelden'],
        ['errors.notFound', 'Nicht gefunden'],
      ]);

      const result = await commonjsParser.import(langDir, translations);

      expect(result.filesCreated).toBe(3);
      expect(result.keysWritten).toBe(3);

      const exported = await commonjsParser.export(langDir);
      expect(exported.get('generic.welcome')).toBe('Willkommen');
      expect(exported.get('auth.login')).toBe('Anmelden');
      expect(exported.get('errors.notFound')).toBe('Nicht gefunden');
    });

    it('should create language directory if it does not exist', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'fr', 'nested');
      const translations = new Map([['generic.hello', 'Bonjour']]);

      const result = await commonjsParser.import(langDir, translations);

      expect(result.filesCreated).toBe(1);
      const exported = await commonjsParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Bonjour');
    });

    it('should handle empty translations map', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');
      const translations = new Map<string, string>();

      const result = await commonjsParser.import(langDir, translations);

      expect(result.filesCreated).toBe(0);
      expect(result.filesModified).toBe(0);
      expect(result.keysWritten).toBe(0);
    });

    it('should skip keys without file prefix and log warning', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');
      const translations = new Map([
        ['generic.hello', 'Hallo'], // valid
        ['invalidkey', 'Invalid'], // no dot - should be skipped
      ]);

      const result = await commonjsParser.import(langDir, translations);

      // Only the valid key should be written
      expect(result.keysWritten).toBe(1);

      const exported = await commonjsParser.export(langDir);
      expect(exported.get('generic.hello')).toBe('Hallo');
      expect(exported.has('invalidkey')).toBe(false);
    });

    it('should handle deeply nested keys', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');
      const translations = new Map([
        ['settings.account.profile.name', 'Name'],
        ['settings.account.profile.email', 'E-Mail'],
        ['settings.account.security.password', 'Passwort'],
      ]);

      await commonjsParser.import(langDir, translations);

      const exported = await commonjsParser.export(langDir);
      expect(exported.get('settings.account.profile.name')).toBe('Name');
      expect(exported.get('settings.account.profile.email')).toBe('E-Mail');
      expect(exported.get('settings.account.security.password')).toBe('Passwort');
    });

    it('should handle special characters in values', async () => {
      const { commonjsParser } = await loadParserModules();
      const langDir = join(tempPath, 'de');
      const translations = new Map([
        ['generic.quote', "It's a test"],
        ['generic.html', '<span>HTML</span>'],
        ['generic.unicode', '日本語テスト'],
      ]);

      await commonjsParser.import(langDir, translations);

      const exported = await commonjsParser.export(langDir);
      expect(exported.get('generic.quote')).toBe("It's a test");
      expect(exported.get('generic.html')).toBe('<span>HTML</span>');
      expect(exported.get('generic.unicode')).toBe('日本語テスト');
    });
  });
});
