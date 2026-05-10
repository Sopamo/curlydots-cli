import { describe, expect, it } from 'bun:test';
import { parsePushArgs, validatePushArgs } from '../../../src/commands/translations/push-args';

describe('translations push args', () => {
  it('does not default parser during parsing', () => {
    const parsed = parsePushArgs(['--repo', '/repo', '--translations-dir', 'locales', '--source', 'en']);

    expect(parsed.parser).toBe('');
  });

  it('parses explicit parser argument', () => {
    const parsed = parsePushArgs([
      '--repo',
      '/repo',
      '--translations-dir',
      'locales',
      '--source',
      'en',
      '--parser',
      'commonjs',
    ]);

    expect(parsed.parser).toBe('commonjs');
  });

  it('requires parser or parser file', () => {
    const errors = validatePushArgs({
      repoPath: '/repo',
      translationsDirs: [],
      source: 'en',
      parser: '',
      parserFile: undefined,
      extensions: [],
      batchSize: 100,
      help: false,
    });

    expect(errors.some((error) => error.startsWith('Missing required option: --parser'))).toBe(
      true,
    );
    expect(errors.some((error) => error.includes('/docs/cli/parsers/'))).toBe(true);
  });
});
