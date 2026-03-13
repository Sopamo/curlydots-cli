import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ORIGINAL_ENV = { ...process.env };
let moduleNonce = 0;

async function importFreshSecureStoreModule() {
  moduleNonce += 1;
  return import(`../../../src/services/storage/secure-store.ts?test=${moduleNonce}`);
}

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
    const { getSecureToken } = await importFreshSecureStoreModule();
    const token = await getSecureToken();
    expect(token).toBe('env-token');
  });

  it('saves and loads encrypted token from file fallback', async () => {
    const { getSecureToken, saveSecureToken } = await importFreshSecureStoreModule();
    await saveSecureToken('saved-token');
    const token = await getSecureToken();
    expect(token).toBe('saved-token');
  });

  it('clears stored token', async () => {
    const { clearSecureToken, getSecureToken, saveSecureToken } = await importFreshSecureStoreModule();
    await saveSecureToken('temp-token');
    await clearSecureToken();
    const token = await getSecureToken();
    expect(token).toBeNull();
  });

  it('falls back to file storage when keytar runtime connection fails', async () => {
    delete process.env.CURLYDOTS_DISABLE_KEYTAR;

    mock.module('keytar', () => ({
      setPassword: mock(async () => {
        throw new Error('Could not connect: No such file or directory');
      }),
      getPassword: mock(async () => {
        throw new Error('Could not connect: No such file or directory');
      }),
      deletePassword: mock(async () => {
        throw new Error('Could not connect: No such file or directory');
      }),
    }));

    const { clearSecureToken, getSecureToken, saveSecureToken } = await importFreshSecureStoreModule();

    await saveSecureToken('saved-token');
    expect(await getSecureToken()).toBe('saved-token');

    await clearSecureToken();
    expect(await getSecureToken()).toBeNull();
  });
});
