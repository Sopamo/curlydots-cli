import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clearSecureToken, getSecureToken, saveSecureToken } from '../../../src/services/storage/secure-store';

const ORIGINAL_ENV = { ...process.env };

describe('services/storage/secure-store', () => {
  let homeDir: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'curlydots-test-'));
    process.env = {
      ...ORIGINAL_ENV,
      CURLYDOTS_HOME: homeDir,
      CURLYDOTS_DISABLE_KEYTAR: '1',
    };
    delete process.env.CURLYDOTS_TOKEN;
  });

  afterEach(async () => {
    process.env = ORIGINAL_ENV;
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('returns token from environment variable when present', async () => {
    process.env.CURLYDOTS_TOKEN = 'env-token';
    const token = await getSecureToken();
    expect(token).toBe('env-token');
  });

  it('saves and loads encrypted token from file fallback', async () => {
    await saveSecureToken('saved-token');
    const token = await getSecureToken();
    expect(token).toBe('saved-token');
  });

  it('clears stored token', async () => {
    await saveSecureToken('temp-token');
    await clearSecureToken();
    const token = await getSecureToken();
    expect(token).toBeNull();
  });
});
