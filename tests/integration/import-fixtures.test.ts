/**
 * Import Command Fixture-Based Integration Tests
 *
 * Tests the import command against real CSV fixture files and verifies
 * exact output matches expected translation files.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { runImport } from '../../src/commands/import';

const FIXTURES_DIR = join(import.meta.dir, '../fixtures/import-fixtures');
const EXPECTED_DIR = join(FIXTURES_DIR, 'expected');
const TEMP_OUTPUT_DIR = join(import.meta.dir, '../fixtures/temp-import-fixtures-output');

/**
 * Normalize file content for comparison (trim whitespace, normalize line endings)
 */
function normalizeContent(content: string): string {
  return content.trim().replace(/\r\n/g, '\n');
}

describe('import-fixtures integration', () => {
  beforeEach(async () => {
    // Clean up and create temp output directory
    try {
      await rm(TEMP_OUTPUT_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(TEMP_OUTPUT_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp output directory
    try {
      await rm(TEMP_OUTPUT_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('basic-translations.csv', () => {
    it('should import basic translations and produce exact expected output', async () => {
      const csvPath = join(FIXTURES_DIR, 'basic-translations.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      const result = await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      // Verify success and counts
      expect(result.success).toBe(true);
      expect(result.summary?.targetLanguage).toBe('de');
      expect(result.summary?.keysImported).toBe(3);
      expect(result.summary?.filesCreated).toBe(1);
      expect(result.summary?.rowsSkipped).toBe(0);

      // Verify file was created
      const outputFile = join(translationsDir, 'de', 'generic.js');
      expect(existsSync(outputFile)).toBe(true);

      // Compare with expected output
      const actualContent = await readFile(outputFile, 'utf-8');
      const expectedContent = await readFile(join(EXPECTED_DIR, 'basic-de-generic.js'), 'utf-8');

      expect(normalizeContent(actualContent)).toBe(normalizeContent(expectedContent));
    });

    it('should produce valid CommonJS module that can be evaluated', async () => {
      const csvPath = join(FIXTURES_DIR, 'basic-translations.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      // Read and evaluate the generated module
      const outputFile = join(translationsDir, 'de', 'generic.js');
      const content = await readFile(outputFile, 'utf-8');

      // Evaluate as CommonJS module
      const moduleExports: { exports: Record<string, string> } = { exports: {} };
      const fn = new Function('module', 'exports', content);
      fn(moduleExports, moduleExports.exports);

      // Verify values
      expect(moduleExports.exports.welcome).toBe('Willkommen in unserer App');
      expect(moduleExports.exports.goodbye).toBe('Auf Wiedersehen');
      expect(moduleExports.exports.hello).toBe('Hallo');
    });
  });

  describe('nested-keys.csv', () => {
    it('should import deeply nested keys and produce exact expected output', async () => {
      const csvPath = join(FIXTURES_DIR, 'nested-keys.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      const result = await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      // Verify success and counts
      expect(result.success).toBe(true);
      expect(result.summary?.targetLanguage).toBe('fr');
      expect(result.summary?.keysImported).toBe(6);
      expect(result.summary?.filesCreated).toBe(1);
      expect(result.summary?.rowsSkipped).toBe(0);

      // Verify file was created
      const outputFile = join(translationsDir, 'fr', 'settings.js');
      expect(existsSync(outputFile)).toBe(true);

      // Compare with expected output
      const actualContent = await readFile(outputFile, 'utf-8');
      const expectedContent = await readFile(join(EXPECTED_DIR, 'nested-fr-settings.js'), 'utf-8');

      expect(normalizeContent(actualContent)).toBe(normalizeContent(expectedContent));
    });

    it('should produce valid CommonJS module with nested structure', async () => {
      const csvPath = join(FIXTURES_DIR, 'nested-keys.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      // Read and evaluate the generated module
      const outputFile = join(translationsDir, 'fr', 'settings.js');
      const content = await readFile(outputFile, 'utf-8');

      // Evaluate as CommonJS module
      const moduleExports: { exports: Record<string, unknown> } = { exports: {} };
      const fn = new Function('module', 'exports', content);
      fn(moduleExports, moduleExports.exports);

      // Verify nested structure
      const settings = moduleExports.exports as {
        account: {
          profile: { name: string; email: string };
          security: { password: string; twoFactor: string };
        };
        notifications: { email: string; push: string };
      };

      expect(settings.account.profile.name).toBe('Nom');
      expect(settings.account.profile.email).toBe('Adresse e-mail');
      expect(settings.account.security.password).toBe('Mot de passe');
      expect(settings.account.security.twoFactor).toBe('Authentification à deux facteurs');
      expect(settings.notifications.email).toBe('Notifications par e-mail');
      expect(settings.notifications.push).toBe('Notifications push');
    });
  });

  describe('mixed-with-skips.csv', () => {
    it('should import multiple files and skip empty translations', async () => {
      const csvPath = join(FIXTURES_DIR, 'mixed-with-skips.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      const result = await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      // Verify success and counts
      expect(result.success).toBe(true);
      expect(result.summary?.targetLanguage).toBe('es');
      expect(result.summary?.keysImported).toBe(8); // 10 rows - 2 empty
      expect(result.summary?.filesCreated).toBe(3); // auth.js, errors.js, common.js
      expect(result.summary?.rowsSkipped).toBe(2); // errors.unauthorized and common.delete

      // Verify all files were created
      expect(existsSync(join(translationsDir, 'es', 'auth.js'))).toBe(true);
      expect(existsSync(join(translationsDir, 'es', 'errors.js'))).toBe(true);
      expect(existsSync(join(translationsDir, 'es', 'common.js'))).toBe(true);
    });

    it('should produce exact expected output for auth.js', async () => {
      const csvPath = join(FIXTURES_DIR, 'mixed-with-skips.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      const actualContent = await readFile(join(translationsDir, 'es', 'auth.js'), 'utf-8');
      const expectedContent = await readFile(join(EXPECTED_DIR, 'mixed-es-auth.js'), 'utf-8');

      expect(normalizeContent(actualContent)).toBe(normalizeContent(expectedContent));
    });

    it('should produce exact expected output for errors.js (excluding skipped)', async () => {
      const csvPath = join(FIXTURES_DIR, 'mixed-with-skips.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      const actualContent = await readFile(join(translationsDir, 'es', 'errors.js'), 'utf-8');
      const expectedContent = await readFile(join(EXPECTED_DIR, 'mixed-es-errors.js'), 'utf-8');

      expect(normalizeContent(actualContent)).toBe(normalizeContent(expectedContent));
    });

    it('should produce exact expected output for common.js (excluding skipped)', async () => {
      const csvPath = join(FIXTURES_DIR, 'mixed-with-skips.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      const actualContent = await readFile(join(translationsDir, 'es', 'common.js'), 'utf-8');
      const expectedContent = await readFile(join(EXPECTED_DIR, 'mixed-es-common.js'), 'utf-8');

      expect(normalizeContent(actualContent)).toBe(normalizeContent(expectedContent));
    });

    it('should NOT include skipped translations in output files', async () => {
      const csvPath = join(FIXTURES_DIR, 'mixed-with-skips.csv');
      const translationsDir = TEMP_OUTPUT_DIR;

      await runImport({
        csvPath,
        translationsDir,
        parser: 'node-module',
      });

      // Verify skipped keys are not in the output
      const errorsContent = await readFile(join(translationsDir, 'es', 'errors.js'), 'utf-8');
      const commonContent = await readFile(join(translationsDir, 'es', 'common.js'), 'utf-8');

      expect(errorsContent).not.toContain('unauthorized');
      expect(commonContent).not.toContain('delete');
    });
  });

  describe('cross-fixture comparison', () => {
    it('should handle all fixtures without errors when run sequentially', async () => {
      const fixtures = [
        { csv: 'basic-translations.csv', lang: 'de', files: 1, keys: 3 },
        { csv: 'nested-keys.csv', lang: 'fr', files: 1, keys: 6 },
        { csv: 'mixed-with-skips.csv', lang: 'es', files: 3, keys: 8 },
      ];

      for (const fixture of fixtures) {
        // Create isolated temp dir for each fixture
        const tempDir = join(TEMP_OUTPUT_DIR, fixture.lang);
        await mkdir(tempDir, { recursive: true });

        const result = await runImport({
          csvPath: join(FIXTURES_DIR, fixture.csv),
          translationsDir: tempDir,
          parser: 'node-module',
        });

        expect(result.success).toBe(true);
        expect(result.summary?.targetLanguage).toBe(fixture.lang);
        expect(result.summary?.filesCreated).toBe(fixture.files);
        expect(result.summary?.keysImported).toBe(fixture.keys);
      }
    });
  });
});
