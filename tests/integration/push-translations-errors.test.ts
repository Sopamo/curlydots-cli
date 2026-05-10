import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as authConfigModule from '../../src/config/auth-config';
import * as tokenManagerModule from '../../src/services/auth/token-manager';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
type FetchArgs = Parameters<typeof fetch>;
const originalAuthConfig = { ...authConfigModule };
const originalTokenManager = { ...tokenManagerModule };

mock.module('../../src/config/cli-config', () => ({
  loadCliConfig: () => ({
    apiEndpoint: 'https://curlydots.com/api',
    frontendUrl: 'https://curlydots.com',
    timeout: 500,
    retries: 0,
    debug: false,
    defaultLocale: undefined,
  }),
}));

describe('integration/push-translations-errors', () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ input: FetchArgs[0]; init?: FetchArgs[1] }> = [];
  let tempDir = '';

  beforeEach(() => {
    fetchCalls.length = 0;
    process.exitCode = 0;
    mock.restore();
    mock.module('../../src/config/auth-config', () => ({ ...originalAuthConfig }));
    mock.module('../../src/services/auth/token-manager', () => ({ ...originalTokenManager }));
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.exitCode = 0;
    mock.restore();
    mock.module('../../src/config/auth-config', () => ({ ...originalAuthConfig }));
    mock.module('../../src/services/auth/token-manager', () => ({ ...originalTokenManager }));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('sets non-zero exit code on authentication errors', async () => {
    const fetchMock = mock(async (...args: FetchArgs) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { runTranslationsPush } = await import('../../src/commands/translations/push');
    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      TEST_REPO,
      '--translations-dir',
      'translations',
      '--source',
      'en',
      '--parser',
      'commonjs',
      '--api-host',
      'https://curlydots.com',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('renews an expired stored token before fetching translation keys', async () => {
    const fetchMock = mock(async (...args: FetchArgs) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: { keys: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    mock.module('../../src/config/auth-config', () => ({
      ...originalAuthConfig,
      loadCliAuthConfig: () => ({
        authMethod: 'browser',
        tokenStorage: 'keychain',
        token: undefined,
      }),
    }));

    const getValidTokenMock = mock(async () => 'renewed-token');
    mock.module('../../src/services/auth/token-manager', () => ({
      ...originalTokenManager,
      loadAuthToken: async () => ({
        accessToken: 'expired-token',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      isTokenExpired: () => true,
      getValidToken: getValidTokenMock,
    }));

    const { runTranslationsPush } = await import('../../src/commands/translations/push');
    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      TEST_REPO,
      '--translations-dir',
      'translations',
      '--source',
      'en',
      '--parser',
      'commonjs',
      '--api-host',
      'https://curlydots.com',
    ]);

    expect(getValidTokenMock).toHaveBeenCalledTimes(1);
    const authHeaders = fetchCalls.map(
      (call) => (call.init?.headers as Record<string, string> | undefined)?.Authorization,
    );
    expect(authHeaders.filter(Boolean)).toEqual(['Bearer renewed-token', 'Bearer renewed-token']);
    expect(process.exitCode).toBe(0);
  });

  it('fails when all resolved translation directories fail to parse', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'push-translations-fail-'));
    await mkdir(join(tempDir, 'translations-a'), { recursive: true });
    await mkdir(join(tempDir, 'translations-b'), { recursive: true });

    const fetchMock = mock(async (...args: FetchArgs) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });
      return new Response(JSON.stringify({ data: { keys: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { runTranslationsPush } = await import('../../src/commands/translations/push');
    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      tempDir,
      '--translations-dir',
      'translations-a',
      '--translations-dir',
      'translations-b',
      '--source',
      'en',
      '--parser',
      'commonjs',
      '--api-host',
      'https://curlydots.com',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('succeeds without uploading when resolved directories contain no translation keys', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'push-translations-empty-'));
    await mkdir(join(tempDir, 'translations', 'en'), { recursive: true });

    const fetchMock = mock(async (...args: FetchArgs) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });
      return new Response(JSON.stringify({ data: { keys: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { runTranslationsPush } = await import('../../src/commands/translations/push');
    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      tempDir,
      '--translations-dir',
      'translations',
      '--source',
      'en',
      '--parser',
      'commonjs',
      '--api-host',
      'https://curlydots.com',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });
});
