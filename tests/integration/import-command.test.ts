/**
 * Import Command Integration Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEST_FIXTURES_DIR = join(import.meta.dir, '../fixtures/temp-import-integration');

describe('import-command integration', () => {
  beforeEach(async () => {
    // Clean up and create temp directory
    try {
      await rm(TEST_FIXTURES_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(TEST_FIXTURES_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(TEST_FIXTURES_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should import translated CSV to translation files end-to-end', async () => {
    const csvPath = join(TEST_FIXTURES_DIR, 'translated.csv');
    const translationsDir = join(TEST_FIXTURES_DIR, 'translations');

    // Create translated CSV (simulating output from translate command)
    const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.welcome,Welcome,en,de,[],[],"Willkommen"
generic.goodbye,Goodbye,en,de,[],[],"Auf Wiedersehen"
auth.login,Login,en,de,[],[],"Anmelden"`;

    await writeFile(csvPath, csvContent, 'utf-8');

    // Import and run (dynamic import to get fresh module)
    const { runImport } = await import('../../src/commands/import');

    const result = await runImport({
      csvPath,
      translationsDir,
      parser: 'node-module',
    });

    expect(result.success).toBe(true);
    expect(result.summary?.keysImported).toBe(3);
    expect(result.summary?.filesCreated).toBe(2); // generic.js and auth.js

    // Verify files were created
    expect(existsSync(join(translationsDir, 'de', 'generic.js'))).toBe(true);
    expect(existsSync(join(translationsDir, 'de', 'auth.js'))).toBe(true);

    // Verify content
    const { nodeModuleParser } = await import('../../src/parsers/node-module');
    const exported = await nodeModuleParser.export(join(translationsDir, 'de'));

    expect(exported.get('generic.welcome')).toBe('Willkommen');
    expect(exported.get('generic.goodbye')).toBe('Auf Wiedersehen');
    expect(exported.get('auth.login')).toBe('Anmelden');
  });

  it('should handle CSV with some empty translations', async () => {
    const csvPath = join(TEST_FIXTURES_DIR, 'partial.csv');
    const translationsDir = join(TEST_FIXTURES_DIR, 'translations');

    const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.hello,Hello,en,de,[],[],"Hallo"
generic.world,World,en,de,[],[],""
generic.test,Test,en,de,[],[],"Test-de"`;

    await writeFile(csvPath, csvContent, 'utf-8');

    const { runImport } = await import('../../src/commands/import');

    const result = await runImport({
      csvPath,
      translationsDir,
      parser: 'node-module',
    });

    expect(result.success).toBe(true);
    expect(result.summary?.keysImported).toBe(2);
    expect(result.summary?.rowsSkipped).toBe(1);

    const { nodeModuleParser } = await import('../../src/parsers/node-module');
    const exported = await nodeModuleParser.export(join(translationsDir, 'de'));

    expect(exported.get('generic.hello')).toBe('Hallo');
    expect(exported.get('generic.test')).toBe('Test-de');
    expect(exported.has('generic.world')).toBe(false);
  });

  it('should merge with existing translation files', async () => {
    const csvPath = join(TEST_FIXTURES_DIR, 'updates.csv');
    const translationsDir = join(TEST_FIXTURES_DIR, 'translations');
    const deLangDir = join(translationsDir, 'de');

    // Create existing translation file
    await mkdir(deLangDir, { recursive: true });
    await writeFile(
      join(deLangDir, 'generic.js'),
      `module.exports = {\n  existing: 'Bestehend',\n};\n`,
      'utf-8',
    );

    // Create CSV with new translations
    const csvContent = `translation_key,source_value,source_language,target_language,code_context,translation_context,translated_value
generic.newKey,New Key,en,de,[],[],"Neuer Schlüssel"`;

    await writeFile(csvPath, csvContent, 'utf-8');

    const { runImport } = await import('../../src/commands/import');

    const result = await runImport({
      csvPath,
      translationsDir,
      parser: 'node-module',
    });

    expect(result.success).toBe(true);
    expect(result.summary?.filesModified).toBe(1);
    expect(result.summary?.filesCreated).toBe(0);

    const { nodeModuleParser } = await import('../../src/parsers/node-module');
    const exported = await nodeModuleParser.export(deLangDir);

    // Both old and new keys should exist
    expect(exported.get('generic.existing')).toBe('Bestehend');
    expect(exported.get('generic.newKey')).toBe('Neuer Schlüssel');
  });

  it('should fail gracefully for non-existent CSV', async () => {
    const csvPath = join(TEST_FIXTURES_DIR, 'nonexistent.csv');
    const translationsDir = join(TEST_FIXTURES_DIR, 'translations');

    const { runImport } = await import('../../src/commands/import');

    const result = await runImport({
      csvPath,
      translationsDir,
      parser: 'node-module',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
