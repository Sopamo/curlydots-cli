import { describe, expect, it } from 'bun:test';
import { parseExtractArgs, validateExtractArgs } from '../../../src/commands/extract';

describe('extract command', () => {
  it('parses repeated --translations-dir arguments', () => {
    const parsed = parseExtractArgs([
      '/repo',
      '--source',
      'en',
      '--target',
      'de',
      '--translations-dir',
      'translations',
      '--translations-dir',
      'modules/shared/translations',
    ]);

    expect(parsed.translationsDirs).toEqual(['translations', 'modules/shared/translations']);
    expect(parsed.parser).toBe('');
  });

  it('parses explicit parser argument', () => {
    const parsed = parseExtractArgs(['/repo', '--parser', 'commonjs']);

    expect(parsed.parser).toBe('commonjs');
  });

  it('validates all configured translation directories', () => {
    const errors = validateExtractArgs({
      repoPath: '/definitely-missing-repo',
      source: 'en',
      target: 'de',
      translationsDirs: ['translations', 'modules/shared/translations'],
      parser: 'commonjs',
      extensions: ['.ts'],
      output: 'missing-translations.csv',
      help: false,
    });

    expect(errors).toContain('Repository path does not exist: /definitely-missing-repo');
  });

  it('requires at least one translations directory', () => {
    const errors = validateExtractArgs({
      repoPath: '/repo',
      source: 'en',
      target: 'de',
      translationsDirs: [],
      parser: 'commonjs',
      extensions: ['.ts'],
      output: 'missing-translations.csv',
      help: false,
    });

    expect(errors).toContain('Missing required option: --translations-dir');
  });

  it('requires an explicit parser', () => {
    const errors = validateExtractArgs({
      repoPath: '/repo',
      source: 'en',
      target: 'de',
      translationsDirs: [],
      parser: '',
      extensions: ['.ts'],
      output: 'missing-translations.csv',
      help: false,
    });

    expect(errors.some((error) => error.startsWith('Missing required option: --parser'))).toBe(
      true,
    );
    expect(errors.some((error) => error.includes('/docs/cli/parsers/'))).toBe(true);
  });
});
