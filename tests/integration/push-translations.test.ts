import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
type FetchArgs = Parameters<typeof fetch>;

describe('integration/push-translations', () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ input: FetchArgs[0]; init?: FetchArgs[1] }> = [];
  const fetchMock = mock(async (...args: FetchArgs) => {
    const [input, init] = args;
    fetchCalls.push({ input, init });
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      return new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('pushes translation keys with context payload', async () => {
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
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [getCall, postCall] = fetchCalls;
    expect(getCall?.input.toString()).toContain('/api/projects/project-123/translation-keys');
    expect(postCall?.input.toString()).toContain('/api/projects/project-123/translation-keys');
    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      keys?: Array<Record<string, unknown>>;
      current_batch?: number;
      total_batch?: number;
    };

    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys?.length).toBeGreaterThan(0);
    expect(body.current_batch).toBe(1);
    expect(body.total_batch).toBe(1);

    const first = body.keys?.[0] as Record<string, unknown> | undefined;
    expect(first?.translationKey).toBeDefined();
    expect(first?.sourceValue).toBeDefined();
    expect(first?.sourceLanguage).toBe('en');
    expect(Array.isArray(first?.codeContext)).toBe(true);
  });

  it('skips keys that already exist on the backend', async () => {
    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    fetchMock.mockImplementationOnce(async (...args: FetchArgs) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return new Response(JSON.stringify({ keys: ['generic.back', 'generic.save'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

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
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
    ]);

    const postCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') !== 'GET');
    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      keys?: Array<Record<string, unknown>>;
    };

    expect(body.keys?.some((key) => key.translationKey === 'generic.back')).toBe(false);
    expect(body.keys?.some((key) => key.translationKey === 'generic.save')).toBe(false);
  });
});
