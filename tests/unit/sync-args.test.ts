import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { parseSyncArgs, validateSyncArgs } from '../../src/commands/translations/sync-args';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
const REQUIRED_ARGS = [
  '--team',
  'team-a',
  '--project',
  'project-a',
  '--repo',
  TEST_REPO,
  '--translations-dir',
  'translations',
  '--source',
  'en',
];

describe('commands/translations/sync-args', () => {
  it('preserves defaults for optional arguments', () => {
    expect(parseSyncArgs(REQUIRED_ARGS)).toEqual({
      teamSlug: 'team-a',
      projectSlug: 'project-a',
      repoPath: TEST_REPO,
      translationsDir: 'translations',
      source: 'en',
      parser: 'node-module',
      parserFile: undefined,
      extensions: [],
      apiHost: '',
      apiToken: undefined,
      idempotencyKey: undefined,
      help: false,
    });
  });

  it('parses long options with equals syntax', () => {
    expect(
      parseSyncArgs([
        '--team=team-a',
        '--project=project-a',
        `--repo=${TEST_REPO}`,
        '--translations-dir=translations',
        '--source=en',
        '--parser=node-module',
        '--parser-file=custom-parser.ts',
        '--extensions=.ts, .vue,,',
        '--api-host=https://curlydots.com',
        '--api-token=token-abc',
        '--idempotency-key=delivery-123',
      ]),
    ).toMatchObject({
      teamSlug: 'team-a',
      projectSlug: 'project-a',
      repoPath: TEST_REPO,
      translationsDir: 'translations',
      source: 'en',
      parser: 'node-module',
      parserFile: 'custom-parser.ts',
      extensions: ['.ts', '.vue'],
      apiHost: 'https://curlydots.com',
      apiToken: 'token-abc',
      idempotencyKey: 'delivery-123',
    });
  });

  it('preserves short aliases', () => {
    const args = parseSyncArgs([
      '--team',
      'team-a',
      '--project',
      'project-a',
      '--repo',
      TEST_REPO,
      '-d',
      'translations',
      '-s',
      'en',
      '-p',
      'node-module',
      '-e',
      '.ts, .vue',
    ]);

    expect(args).toMatchObject({
      translationsDir: 'translations',
      source: 'en',
      parser: 'node-module',
      extensions: ['.ts', '.vue'],
    });
    expect(validateSyncArgs(args)).toEqual([]);
  });

  it.each(['--help', '-h'])('parses standalone help with %s', (flag) => {
    expect(parseSyncArgs([flag]).help).toBe(true);
  });

  it('parses an explicit idempotency key with either syntax', () => {
    for (const keyArgs of [
      ['--idempotency-key', 'delivery-123'],
      ['--idempotency-key=delivery-123'],
    ]) {
      const args = parseSyncArgs([...REQUIRED_ARGS, ...keyArgs]);

      expect(args.idempotencyKey).toBe('delivery-123');
      expect(validateSyncArgs(args)).toEqual([]);
    }
  });

  it('allows a value starting with a dash when equals syntax is used', () => {
    const args = parseSyncArgs([...REQUIRED_ARGS, '--idempotency-key=--help']);

    expect(args.idempotencyKey).toBe('--help');
    expect(args.help).toBe(false);
    expect(validateSyncArgs(args)).toEqual([]);
  });

  it.each([
    '--team',
    '--project',
    '--repo',
    '--translations-dir',
    '--source',
    '--parser',
    '--parser-file',
    '--extensions',
    '--api-host',
    '--api-token',
    '--idempotency-key',
  ])('rejects a missing value for %s', (option) => {
    expect(() => parseSyncArgs([...REQUIRED_ARGS, option])).toThrow(option);
    expect(() => parseSyncArgs([...REQUIRED_ARGS, option, '--help'])).toThrow(option);
  });

  it('rejects unknown flags and positional arguments', () => {
    expect(() => parseSyncArgs([...REQUIRED_ARGS, '--typo'])).toThrow('--typo');
    expect(() => parseSyncArgs([...REQUIRED_ARGS, '-idempotency-key', 'delivery-123'])).toThrow();
    expect(() => parseSyncArgs([...REQUIRED_ARGS, 'unexpected'])).toThrow();
  });

  it('rejects an empty or oversized idempotency key', () => {
    const empty = parseSyncArgs([...REQUIRED_ARGS, '--idempotency-key=']);
    const whitespace = parseSyncArgs([...REQUIRED_ARGS, '--idempotency-key', '   ']);
    const oversized = parseSyncArgs([...REQUIRED_ARGS, '--idempotency-key', 'a'.repeat(256)]);

    expect(validateSyncArgs(empty)).toContain('Missing required value for --idempotency-key');
    expect(validateSyncArgs(whitespace)).toContain('Missing required value for --idempotency-key');
    expect(validateSyncArgs(oversized)).toContain('Idempotency key must not exceed 255 characters');
  });
});
