import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { HttpClient } from '../../../src/services/http/client';

describe('services/http/client', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  let receivedHeaders: RequestInit['headers'] | undefined;

  beforeEach(() => {
    receivedHeaders = undefined;
    process.env = { ...originalEnv, npm_package_version: '9.9.9' };
    globalThis.fetch = (async (_url, init) => {
      receivedHeaders = init?.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('always sends CLI version header', async () => {
    const client = new HttpClient({ baseUrl: 'https://example.com', timeout: 1000, retries: 0 });

    await client.get('health', {
      headers: {
        'X-Request-Source': 'unit-test',
      },
    });

    const headerMap = receivedHeaders as Record<string, string> | undefined;
    expect(headerMap?.['X-Curlydots-Cli-Version']).toBe('9.9.9');
  });

  it('aborts the request when the timeout elapses', async () => {
    let receivedSignal: AbortSignal | undefined;
    globalThis.fetch = (async (_url, init) => {
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

    const client = new HttpClient({ baseUrl: 'https://example.com', timeout: 5, retries: 0 });

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
