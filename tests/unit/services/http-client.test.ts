import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

describe('services/http/client', () => {
  let receivedHeaders: RequestInit['headers'] | undefined;
  const moduleUrl = new URL('../../../src/services/http/client.ts', import.meta.url);

  async function loadHttpClient() {
    const { HttpClient } = await import(`${moduleUrl.href}?real=${Date.now()}`);
    return HttpClient;
  }

  beforeEach(() => {
    receivedHeaders = undefined;
  });

  afterEach(() => {
    receivedHeaders = undefined;
  });

  it('always sends CLI version header', async () => {
    const HttpClient = await loadHttpClient();
    const fetcher = (async (_url, init) => {
      receivedHeaders = init?.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const client = new HttpClient({
      baseUrl: 'https://curlydots.com',
      timeout: 1000,
      retries: 0,
      cliVersion: '9.9.9',
      fetcher,
    });

    await client.get('health', {
      headers: {
        'X-Request-Source': 'unit-test',
      },
    });

    const headerMap = receivedHeaders as Record<string, string> | undefined;
    expect(headerMap?.['X-Curlydots-Cli-Version']).toBe('9.9.9');
  });

  it('aborts the request when the timeout elapses', async () => {
    const HttpClient = await loadHttpClient();
    let receivedSignal: AbortSignal | undefined;
    const fetcher = (async (_url, init) => {
      receivedSignal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        if (!receivedSignal) {
          reject(new Error('Missing abort signal'));
          return;
        }
        receivedSignal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      }) as unknown as Response;
    }) as typeof fetch;

    const client = new HttpClient({
      baseUrl: 'https://curlydots.com',
      timeout: 5,
      retries: 0,
      fetcher,
    });

    await expect(client.get('health')).rejects.toEqual(
      expect.objectContaining({
        name: 'HttpClientError',
        meta: expect.objectContaining({ category: 'system' }),
      }),
    );

    expect(receivedSignal).toBeDefined();
    if (receivedSignal) {
      expect(receivedSignal.aborted).toBe(true);
    }
  });
});
