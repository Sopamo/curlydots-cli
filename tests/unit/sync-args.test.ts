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
  it('parses an explicit idempotency key', () => {
    const args = parseSyncArgs([...REQUIRED_ARGS, '--idempotency-key=delivery-123']);

    expect(args.idempotencyKey).toBe('delivery-123');
    expect(validateSyncArgs(args)).toEqual([]);
  });

  it('rejects an empty or oversized idempotency key', () => {
    const missing = parseSyncArgs([...REQUIRED_ARGS, '--idempotency-key']);
    const oversized = parseSyncArgs([...REQUIRED_ARGS, '--idempotency-key', 'a'.repeat(256)]);

    expect(validateSyncArgs(missing)).toContain('Missing required value for --idempotency-key');
    expect(validateSyncArgs(oversized)).toContain('Idempotency key must not exceed 255 characters');
  });
});
