import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
type FetchArgs = Parameters<typeof fetch>;

mock.module('../../src/config/cli-config', () => ({
  loadCliConfig: () => ({
    apiEndpoint: 'https://curlydots.com',
    timeout: 500,
    retries: 0,
    debug: false,
    defaultLocale: undefined,
  }),
}));

describe('integration/push-translations-errors', () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ input: FetchArgs[0]; init?: FetchArgs[1] }> = [];

  beforeEach(() => {
    fetchCalls.length = 0;
    process.exitCode = 0;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.exitCode = 0;
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
      'node-module',
      '--api-host',
      'https://curlydots.com',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
