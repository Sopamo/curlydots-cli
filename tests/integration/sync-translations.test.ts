import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
type FetchArgs = Parameters<typeof fetch>;

describe('integration/sync-translations', () => {
  const originalFetch = globalThis.fetch;
  const originalCurlydotsToken = process.env.CURLYDOTS_TOKEN;
  const originalGithubDeliveryId = process.env.CURLYDOTS_GITHUB_DELIVERY_ID;
  const fetchCalls: Array<{ input: FetchArgs[0]; init?: FetchArgs[1] }> = [];
  const fetchMock = mock(async (...args: FetchArgs) => {
    const [input, init] = args;
    fetchCalls.push({ input, init });

    return new Response(
      JSON.stringify({
        data: {
          run_id: 'run-123',
          status: 'processing',
          imported_keys_count: 4,
          queued_batches_count: 2,
        },
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.CURLYDOTS_TOKEN;
    delete process.env.CURLYDOTS_GITHUB_DELIVERY_ID;
    process.exitCode = 0;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalCurlydotsToken === undefined) {
      delete process.env.CURLYDOTS_TOKEN;
    } else {
      process.env.CURLYDOTS_TOKEN = originalCurlydotsToken;
    }
    if (originalGithubDeliveryId === undefined) {
      delete process.env.CURLYDOTS_GITHUB_DELIVERY_ID;
    } else {
      process.env.CURLYDOTS_GITHUB_DELIVERY_ID = originalGithubDeliveryId;
    }
    process.exitCode = 0;
  });

  it('syncs the full default-language key set with the GitHub delivery ID', async () => {
    process.env.CURLYDOTS_GITHUB_DELIVERY_ID = '12de834a-8bd7-4fa2-92ed-2a59e27e1f98';
    const { runTranslationsSync } = await import('../../src/commands/translations/sync');

    await runTranslationsSync([
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
      '--parser',
      'node-module',
      '--api-host',
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [postCall] = fetchCalls;
    expect(postCall?.input.toString()).toContain(
      '/api/teams/team-a/projects/project-a/translation-sync-runs',
    );
    expect(postCall?.init?.method).toBe('POST');
    expect(
      (postCall?.init?.headers as Record<string, string> | undefined)?.['Idempotency-Key'],
    ).toBe('12de834a-8bd7-4fa2-92ed-2a59e27e1f98');

    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      keys?: Array<Record<string, unknown>>;
    };

    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys?.length).toBeGreaterThan(0);
    expect(body.keys?.some((key) => key.key === 'generic.back')).toBe(true);
    expect(body.keys?.some((key) => key.key === 'generic.save')).toBe(true);

    const saveKey = body.keys?.find((key) => key.key === 'generic.save');
    expect(saveKey?.default_value).toBe('Save');
    expect(typeof saveKey?.context).toBe('string');
  });

  it('uses CURLYDOTS_TOKEN when api token is not passed', async () => {
    process.env.CURLYDOTS_TOKEN = 'env-token-abc';
    const { runTranslationsSync } = await import('../../src/commands/translations/sync');

    await runTranslationsSync([
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
      '--parser',
      'node-module',
      '--api-host',
      'https://curlydots.com/api',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [postCall] = fetchCalls;
    expect((postCall?.init?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      'Bearer env-token-abc',
    );
    expect(
      (postCall?.init?.headers as Record<string, string> | undefined)?.['Idempotency-Key'],
    ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
