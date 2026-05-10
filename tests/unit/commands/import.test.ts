import { describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseImportArgs, validateImportArgs } from '../../../src/commands/import';

describe('import command', () => {
  it('does not default parser during parsing', () => {
    const parsed = parseImportArgs(['translated.csv', '--translations-dir', 'locales']);

    expect(parsed.parser).toBe('');
  });

  it('parses explicit parser argument', () => {
    const parsed = parseImportArgs([
      'translated.csv',
      '--translations-dir',
      'locales',
      '--parser',
      'commonjs',
    ]);

    expect(parsed.parser).toBe('commonjs');
  });

  it('requires an explicit parser', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'curlydots-import-parser-required-'));
    const csvPath = join(tempDir, 'translated.csv');
    try {
      await writeFile(csvPath, 'translation_key,translated_value\ncommon.hello,Hallo\n', 'utf8');

      const error = validateImportArgs({
        csvPath,
        translationsDir: tempDir,
        parser: '',
        help: false,
      });

      expect(error).toContain('Parser (-p, --parser) is required');
      expect(error).toContain('/docs/cli/parsers/');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
